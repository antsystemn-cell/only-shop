import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QPAY_BASE = "https://merchant.qpay.mn/v2";

// Token cache (per cold start)
let cachedToken: { access_token: string; refresh_token: string; expires_at: number } | null = null;

async function getQPayToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60000) {
    return cachedToken.access_token;
  }

  if (cachedToken?.refresh_token) {
    try {
      const refreshRes = await fetch(`${QPAY_BASE}/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cachedToken.refresh_token}` },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        cachedToken = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        };
        return cachedToken.access_token;
      }
    } catch (e) {
      console.error("QPay token refresh failed:", e);
    }
  }

  const clientId = Deno.env.get("QPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("QPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("QPAY_CLIENT_ID or QPAY_CLIENT_SECRET not configured");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${QPAY_BASE}/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: "",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QPay auth failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.access_token;
}

async function qpayRequest(path: string, method: string, body?: any, retried = false): Promise<any> {
  const token = await getQPayToken();
  const res = await fetch(`${QPAY_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !retried) {
    cachedToken = null;
    return qpayRequest(path, method, body, true);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QPay API error [${res.status}] ${path}: ${text}`);
  }

  return res.json();
}

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action: string;
    let params: Record<string, any>;

    // QPay sends GET callback requests — handle them separately
    if (req.method === "GET") {
      action = url.searchParams.get("action") || "callback";
      params = Object.fromEntries(url.searchParams.entries());
      console.log("[qpay] GET callback received, params:", JSON.stringify(params));
    } else {
      // POST requests from our frontend
      const body = await req.json();
      action = body.action;
      params = body.params || {};
    }

    const supabase = getSupabaseAdmin();

    // Callback from QPay does not require user auth
    const publicActions = ["callback"];
    if (!publicActions.includes(action)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser(token);
      if (userErr || !userData?.user?.id) {
        console.error("[qpay] Auth error:", userErr?.message);
        return jsonResponse({ error: "Invalid authentication" }, 401);
      }
    }

    // ===========================
    // CREATE INVOICE via PaymentIntent
    // ===========================
    if (action === "createInvoice") {
      const { paymentIntentId } = params;
      if (!paymentIntentId) throw new Error("paymentIntentId is required");

      // Fetch payment intent
      const { data: pi, error: piErr } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (piErr || !pi) throw new Error("Payment intent not found");

      // Only allow initiated or failed intents
      if (pi.status !== "initiated" && pi.status !== "failed") {
        // If already has invoice and is processing, return existing
        if (pi.invoice_id && pi.status === "processing") {
          return jsonResponse({
            invoice_id: pi.invoice_id,
            qr_image: pi.qr_image,
            urls: pi.urls,
            amount: pi.amount,
            payment_intent_id: pi.id,
          });
        }
        throw new Error(`Cannot create invoice: status is ${pi.status}`);
      }

      // Build description based on type
      let description = "";
      let senderInvoiceNo = pi.id;

      if (pi.type === "order") {
        const { data: order } = await supabase
          .from("orders")
          .select("order_number, total")
          .eq("id", pi.reference_id)
          .single();
        if (order) {
          description = `Only.mn захиалга ${order.order_number} - ${pi.amount}₮`;
          senderInvoiceNo = order.order_number || pi.id;
        }
      } else if (pi.type === "wallet_topup") {
        description = `Only.mn данс цэнэглэх - ${pi.amount}₮`;
      }

      const invoiceCode = Deno.env.get("QPAY_INVOICE_CODE");
      if (!invoiceCode) throw new Error("QPAY_INVOICE_CODE not configured");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const callbackUrl = `${supabaseUrl}/functions/v1/qpay?action=callback&paymentIntentId=${pi.id}`;

      const invoicePayload = {
        invoice_code: invoiceCode,
        sender_invoice_no: senderInvoiceNo,
        invoice_receiver_code: "terminal",
        invoice_description: description || `Only.mn төлбөр - ${pi.amount}₮`,
        amount: Number(pi.amount),
        callback_url: callbackUrl,
      };

      console.log("[qpay] Creating invoice:", JSON.stringify(invoicePayload));
      const invoiceResult = await qpayRequest("/invoice", "POST", invoicePayload);
      console.log("[qpay] Invoice created:", JSON.stringify({
        invoice_id: invoiceResult.invoice_id,
        has_qr: !!invoiceResult.qr_image,
        urls_count: invoiceResult.urls?.length || 0,
      }));

      // Update payment intent with invoice data
      await supabase
        .from("payment_intents")
        .update({
          invoice_id: invoiceResult.invoice_id,
          qr_image: invoiceResult.qr_image,
          urls: invoiceResult.urls || null,
          status: "processing",
        })
        .eq("id", pi.id);

      // Also update order payment status if applicable
      if (pi.type === "order") {
        await supabase
          .from("orders")
          .update({
            payment_status: "pending",
            qpay_invoice_id: invoiceResult.invoice_id,
            qpay_qr_image: invoiceResult.qr_image,
            qpay_urls: invoiceResult.urls || null,
          })
          .eq("id", pi.reference_id);
      }

      return jsonResponse({
        invoice_id: invoiceResult.invoice_id,
        qr_image: invoiceResult.qr_image,
        urls: invoiceResult.urls,
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

      // Already paid? Return immediately
      if (pi.status === "paid") {
        return jsonResponse({ status: "PAID" });
      }

      try {
        const checkResult = await qpayRequest("/payment/check", "POST", {
          object_type: "INVOICE",
          object_id: pi.invoice_id,
          offset: { page_number: 1, page_limit: 100 },
        });

        console.log("[qpay] Payment check result:", JSON.stringify(checkResult));

        // QPay returns count and rows for payment check
        const payments = checkResult.rows || [];
        const paidPayment = payments.find((p: any) => p.payment_status === "PAID");

        if (paidPayment) {
          await finalizePayment(supabase, pi, String(paidPayment.payment_id));
          return jsonResponse({ status: "PAID", payment_id: paidPayment.payment_id });
        }

        return jsonResponse({ 
          status: "PENDING", 
          count: checkResult.count || payments.length,
          paid_amount: checkResult.paid_amount || 0,
        });
      } catch (checkErr: any) {
        console.error("[qpay] Payment check error:", checkErr.message);
        // Don't throw — return PENDING so polling continues
        return jsonResponse({ status: "PENDING", error: checkErr.message });
      }
    }

    // ===========================
    // CALLBACK from QPay (GET request)
    // ===========================
    if (action === "callback") {
      const paymentIntentId = params?.paymentIntentId;
      console.log("[qpay] Callback for paymentIntentId:", paymentIntentId);

      if (!paymentIntentId) {
        console.error("[qpay] Callback missing paymentIntentId");
        return jsonResponse({ error: "paymentIntentId is required" }, 400);
      }

      const { data: pi, error: piErr } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (piErr || !pi?.invoice_id) {
        console.error("[qpay] Callback: PI not found or no invoice_id", piErr?.message);
        return jsonResponse({ error: "Payment intent not found" }, 404);
      }

      if (pi.status === "paid") {
        console.log("[qpay] Callback: already paid");
        return jsonResponse({ status: "already_paid" });
      }

      try {
        const checkResult = await qpayRequest("/payment/check", "POST", {
          object_type: "INVOICE",
          object_id: pi.invoice_id,
          offset: { page_number: 1, page_limit: 100 },
        });

        console.log("[qpay] Callback check result:", JSON.stringify(checkResult));

        const payments = checkResult.rows || [];
        const paidPayment = payments.find((p: any) => p.payment_status === "PAID");

        if (paidPayment) {
          await finalizePayment(supabase, pi, String(paidPayment.payment_id));
          console.log("[qpay] Callback: payment finalized successfully");
        }

        return jsonResponse({ status: paidPayment ? "PAID" : "PENDING" });
      } catch (callbackErr: any) {
        console.error("[qpay] Callback check error:", callbackErr.message);
        return jsonResponse({ error: callbackErr.message }, 500);
      }
    }

    // ===========================
    // LEGACY: createInvoice by orderId (backward compat)
    // ===========================
    if (action === "createInvoiceByOrder") {
      const { orderId } = params;
      if (!orderId) throw new Error("orderId is required");

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .single();

      if (orderErr || !order) throw new Error("Order not found");

      if (order.payment_status !== "pending" && order.payment_status !== "failed") {
        throw new Error(`Cannot create invoice: payment status is ${order.payment_status}`);
      }

      if (order.qpay_invoice_id && order.payment_status === "pending") {
        return jsonResponse({
          invoice_id: order.qpay_invoice_id,
          qr_image: order.qpay_qr_image,
          urls: order.qpay_urls,
          amount: order.total,
          order_number: order.order_number,
        });
      }

      const invoiceCode = Deno.env.get("QPAY_INVOICE_CODE");
      if (!invoiceCode) throw new Error("QPAY_INVOICE_CODE not configured");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const callbackUrl = `${supabaseUrl}/functions/v1/qpay?action=callback&orderId=${orderId}`;

      const invoicePayload = {
        invoice_code: invoiceCode,
        sender_invoice_no: order.order_number,
        invoice_receiver_code: "terminal",
        invoice_description: `Only.mn захиалга ${order.order_number} - ${order.total}₮`,
        amount: Number(order.total),
        callback_url: callbackUrl,
      };

      const invoiceResult = await qpayRequest("/invoice", "POST", invoicePayload);

      await supabase
        .from("orders")
        .update({
          qpay_invoice_id: invoiceResult.invoice_id,
          qpay_qr_image: invoiceResult.qr_image,
          qpay_urls: invoiceResult.urls || null,
          payment_status: "pending",
        })
        .eq("id", orderId);

      return jsonResponse({
        invoice_id: invoiceResult.invoice_id,
        qr_image: invoiceResult.qr_image,
        urls: invoiceResult.urls,
        amount: order.total,
        order_number: order.order_number,
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("[qpay] Edge function error:", error);
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
async function finalizePayment(supabase: any, pi: any, qpayPaymentId: string) {
  console.log("[qpay] Finalizing payment:", { piId: pi.id, type: pi.type, qpayPaymentId });

  // Update payment intent
  await supabase
    .from("payment_intents")
    .update({
      status: "paid",
      payment_id: qpayPaymentId,
    })
    .eq("id", pi.id);

  if (pi.type === "order") {
    // Update order
    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_reference: qpayPaymentId,
        qpay_payment_id: qpayPaymentId,
        status: "processing",
      })
      .eq("id", pi.reference_id);
  } else if (pi.type === "wallet_topup") {
    // Credit wallet
    const { data: walletResult, error: walletErr } = await supabase.rpc("credit_wallet", {
      p_user_id: pi.user_id,
      p_amount: Number(pi.amount),
    });
    
    if (walletErr) {
      console.error("[qpay] credit_wallet error:", walletErr.message);
    } else {
      console.log("[qpay] Wallet credited, new balance:", walletResult);
    }

    // Mark topup as completed
    await supabase
      .from("wallet_topups")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", pi.reference_id);
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}