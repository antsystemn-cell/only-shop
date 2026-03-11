import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OMNIWAY_BASE = "https://payment.omnitech.mn";

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

function getOmniWayAuth(): string {
  const username = Deno.env.get("OMNIWAY_USERNAME");
  const password = Deno.env.get("OMNIWAY_PASSWORD");
  if (!username || !password) {
    throw new Error("OMNIWAY_USERNAME or OMNIWAY_PASSWORD not configured");
  }
  return "Basic " + btoa(`${username}:${password}`);
}

async function omniWayRequest(
  path: string,
  method: string,
  body?: any
): Promise<any> {
  const auth = getOmniWayAuth();
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${OMNIWAY_BASE}${path}`, opts);
  const text = await res.text();

  if (!res.ok) {
    console.error(`OmniWay API error [${res.status}] ${path}:`, text);
    throw new Error(`OmniWay API error [${res.status}]: ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    const supabase = getSupabaseAdmin();

    // Callback from OmniWay does not require user auth
    const publicActions = ["callback"];
    if (!publicActions.includes(action)) {
      // Verify user authentication
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (claimsErr || !claimsData?.claims?.sub) {
        return jsonResponse({ error: "Invalid authentication" }, 401);
      }
    }

    // ===========================
    // CREATE INVOICE via PaymentIntent
    // ===========================
    if (action === "createInvoice") {
      const { paymentIntentId } = params;
      if (!paymentIntentId) throw new Error("paymentIntentId is required");

      const { data: pi, error: piErr } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (piErr || !pi) throw new Error("Payment intent not found");

      if (pi.status !== "initiated" && pi.status !== "failed") {
        if (pi.invoice_id && pi.status === "processing") {
          return jsonResponse({
            invoiceNumber: pi.invoice_id,
            qr_image: pi.qr_image,
            qr_content: pi.urls?.qrContent || null,
            amount: pi.amount,
            payment_intent_id: pi.id,
          });
        }
        throw new Error(`Cannot create invoice: status is ${pi.status}`);
      }

      // Build request body
      let description = "";
      let orderNumber = `PI-${pi.id.slice(0, 8)}`;
      let phone = "";
      let email = "";
      let shippingAddress = "";

      if (pi.type === "order") {
        const { data: order } = await supabase
          .from("orders")
          .select("order_number, total, delivery_address")
          .eq("id", pi.reference_id)
          .single();
        if (order) {
          orderNumber = order.order_number;
          description = `Only.mn захиалга ${order.order_number}`;
          const addr = order.delivery_address as any;
          if (addr) {
            phone = addr.phone || "";
            shippingAddress = `${addr.city || ""} ${addr.district || ""} ${addr.street_address || ""}`.trim();
          }
        }
      } else if (pi.type === "wallet_topup") {
        orderNumber = `WALLET-${pi.id.slice(0, 8)}`;
        description = `Only.mn данс цэнэглэх - ${pi.amount}₮`;
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const callbackUrl = `${supabaseUrl}/functions/v1/omniway`;

      const invoiceBody: Record<string, any> = {
        amount: Number(pi.amount),
        orderNumber,
        description: description || `Only.mn төлбөр - ${pi.amount}₮`,
        callbackUrl,
      };
      if (phone) invoiceBody.mobileNumber = phone;
      if (email) invoiceBody.email = email;
      if (shippingAddress) invoiceBody.shippingAddress = shippingAddress;

      console.log("Creating OmniWay invoice:", JSON.stringify(invoiceBody));
      const result = await omniWayRequest("/ecommerce/invoices", "POST", invoiceBody);
      console.log("OmniWay invoice created:", JSON.stringify(result));

      // Update payment intent
      await supabase
        .from("payment_intents")
        .update({
          invoice_id: result.invoiceNumber,
          qr_image: result.imageBase64 || null,
          urls: { qrContent: result.qrContent } || null,
          status: "processing",
        })
        .eq("id", pi.id);

      // Update order if applicable
      if (pi.type === "order") {
        await supabase
          .from("orders")
          .update({ payment_status: "pending" })
          .eq("id", pi.reference_id);
      }

      return jsonResponse({
        invoiceNumber: result.invoiceNumber,
        qr_image: result.imageBase64 || null,
        qr_content: result.qrContent || null,
        amount: pi.amount,
        payment_intent_id: pi.id,
      });
    }

    // ===========================
    // CHECK PAYMENT STATUS
    // ===========================
    if (action === "checkPayment") {
      const { paymentIntentId } = params;
      if (!paymentIntentId) throw new Error("paymentIntentId is required");

      const { data: pi, error: piErr } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (piErr || !pi) throw new Error("Payment intent not found");
      if (!pi.invoice_id) throw new Error("No invoice for this payment intent");

      if (pi.status === "paid") {
        return jsonResponse({ status: "PAID" });
      }

      // GET /ecommerce/invoices/{invoiceNumber}
      const result = await omniWayRequest(
        `/ecommerce/invoices/${pi.invoice_id}`,
        "GET"
      );

      console.log("OmniWay status check:", JSON.stringify(result));

      // 301=UNPAID, 302=PAID, 303=CANCELLED
      if (result.statusId === 302) {
        await finalizePayment(supabase, pi);
        return jsonResponse({ status: "PAID" });
      }

      if (result.statusId === 303) {
        await supabase
          .from("payment_intents")
          .update({ status: "failed" })
          .eq("id", pi.id);
        return jsonResponse({ status: "CANCELLED" });
      }

      return jsonResponse({ status: "UNPAID", statusId: result.statusId });
    }

    // ===========================
    // CALLBACK from OmniWay
    // ===========================
    if (action === "callback") {
      // OmniWay callback - we need to find the PI by checking request data
      // The callback doesn't have a standard format, so we verify via status check
      const { invoiceNumber } = params || {};
      if (!invoiceNumber) {
        return jsonResponse({ error: "invoiceNumber required" }, 400);
      }

      const { data: pi } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("invoice_id", invoiceNumber)
        .eq("provider", "omniway")
        .single();

      if (!pi) {
        return jsonResponse({ error: "Payment intent not found" }, 404);
      }

      if (pi.status === "paid") {
        return jsonResponse({ status: "already_paid" });
      }

      // Verify via status check
      const result = await omniWayRequest(
        `/ecommerce/invoices/${invoiceNumber}`,
        "GET"
      );

      if (result.statusId === 302) {
        await finalizePayment(supabase, pi);
      }

      return jsonResponse({ status: result.statusId === 302 ? "PAID" : "PENDING" });
    }

    // ===========================
    // CANCEL INVOICE
    // ===========================
    if (action === "cancelInvoice") {
      const { paymentIntentId } = params;
      if (!paymentIntentId) throw new Error("paymentIntentId is required");

      const { data: pi } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (!pi?.invoice_id) throw new Error("Payment intent or invoice not found");

      await omniWayRequest(
        `/ecommerce/invoices/${pi.invoice_id}/cancel`,
        "POST"
      );

      await supabase
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("id", pi.id);

      if (pi.type === "order") {
        await supabase
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("id", pi.reference_id);
      }

      return jsonResponse({ status: "CANCELLED" });
    }

    // ===========================
    // ORDER DELIVERED
    // ===========================
    if (action === "orderDelivered") {
      const { paymentIntentId, orderAmount } = params;
      if (!paymentIntentId) throw new Error("paymentIntentId is required");

      const { data: pi } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (!pi?.invoice_id) throw new Error("Payment intent or invoice not found");

      await omniWayRequest(
        `/ecommerce/invoices/${pi.invoice_id}/order-delivered`,
        "POST",
        { orderAmount: orderAmount || Number(pi.amount) }
      );

      return jsonResponse({ status: "DELIVERED" });
    }

    // ===========================
    // SALES RETURN
    // ===========================
    if (action === "salesReturn") {
      const { paymentIntentId, returnAmount } = params;
      if (!paymentIntentId || !returnAmount)
        throw new Error("paymentIntentId and returnAmount are required");

      const { data: pi } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (!pi?.invoice_id) throw new Error("Payment intent or invoice not found");

      await omniWayRequest(
        `/ecommerce/invoices/${pi.invoice_id}/sales-return`,
        "POST",
        { returnAmount: Number(returnAmount) }
      );

      return jsonResponse({ status: "RETURNED" });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("OmniWay edge function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===========================
// FINALIZE PAYMENT HELPER
// ===========================
async function finalizePayment(supabase: any, pi: any) {
  await supabase
    .from("payment_intents")
    .update({ status: "paid" })
    .eq("id", pi.id);

  if (pi.type === "order") {
    const { data: order } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_reference: pi.invoice_id,
        status: "processing",
      })
      .eq("id", pi.reference_id)
      .select("order_number, total")
      .single();

    // Notify admin (fire-and-forget)
    notifyAdminPayment(supabase, order?.order_number, order?.total, "OmniWay").catch(console.error);
  } else if (pi.type === "wallet_topup") {
    await supabase.rpc("credit_wallet", {
      p_user_id: pi.user_id,
      p_amount: Number(pi.amount),
    });

    await supabase
      .from("wallet_topups")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", pi.reference_id);
  }
}

async function notifyAdminPayment(supabase: any, orderNumber?: string, amount?: number, method?: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${supabaseUrl}/functions/v1/phone-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        action: "notify-admin-payment",
        order_number: orderNumber || "—",
        amount: amount ? new Intl.NumberFormat("mn-MN").format(Math.round(Number(amount))) + "₮" : "—",
        method: method || "—",
      }),
    });
  } catch (e: any) {
    console.error("[omniway] Admin notification failed:", e.message);
  }
}
