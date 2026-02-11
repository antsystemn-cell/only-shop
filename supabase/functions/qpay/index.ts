import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QPAY_BASE = "https://merchant.qpay.mn/v2";

// Token cache (per cold start)
let cachedToken: { access_token: string; refresh_token: string; expires_at: number } | null = null;

async function getQPayToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60000) {
    return cachedToken.access_token;
  }

  // Try refresh if we have a refresh token
  if (cachedToken?.refresh_token) {
    try {
      const refreshRes = await fetch(`${QPAY_BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cachedToken.refresh_token}`,
        },
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

  // Fresh token request
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

  // Handle 401 with retry
  if (res.status === 401 && !retried) {
    cachedToken = null; // Force re-auth
    return qpayRequest(path, method, body, true);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QPay API error [${res.status}] ${path}: ${text}`);
  }

  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();

    // Create supabase admin client for DB updates
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === "createInvoice") {
      const { orderId } = params;
      if (!orderId) throw new Error("orderId is required");

      // Fetch order from DB
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .single();

      if (orderErr || !order) throw new Error("Order not found");

      // Validate: must be pending payment
      if (order.payment_status !== "pending" && order.payment_status !== "failed") {
        throw new Error(`Cannot create invoice: payment status is ${order.payment_status}`);
      }

      // Prevent duplicate: if already has valid invoice
      if (order.qpay_invoice_id && order.payment_status === "pending") {
        // Return existing invoice data
        return new Response(JSON.stringify({
          invoice_id: order.qpay_invoice_id,
          qr_image: order.qpay_qr_image,
          urls: order.qpay_urls,
          amount: order.total,
          order_number: order.order_number,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const invoiceCode = Deno.env.get("QPAY_INVOICE_CODE");
      if (!invoiceCode) throw new Error("QPAY_INVOICE_CODE not configured");

      // Build callback URL
      const callbackUrl = `${supabaseUrl}/functions/v1/qpay?action=callback&orderId=${orderId}`;

      // Create QPay invoice
      const invoicePayload = {
        invoice_code: invoiceCode,
        sender_invoice_no: order.order_number,
        invoice_description: `Only.mn захиалга ${order.order_number} - ${order.total}₮`,
        amount: Number(order.total),
        callback_url: callbackUrl,
      };

      console.log("Creating QPay invoice:", JSON.stringify(invoicePayload));
      const invoiceResult = await qpayRequest("/invoice", "POST", invoicePayload);
      console.log("QPay invoice created:", JSON.stringify({
        invoice_id: invoiceResult.invoice_id,
        has_qr: !!invoiceResult.qr_image,
        urls_count: invoiceResult.urls?.length || 0,
      }));

      // Store invoice data in order
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          qpay_invoice_id: invoiceResult.invoice_id,
          qpay_qr_image: invoiceResult.qr_image,
          qpay_urls: invoiceResult.urls || null,
          payment_status: "pending",
        })
        .eq("id", orderId);

      if (updateErr) {
        console.error("Failed to update order with invoice:", updateErr);
      }

      return new Response(JSON.stringify({
        invoice_id: invoiceResult.invoice_id,
        qr_image: invoiceResult.qr_image,
        urls: invoiceResult.urls,
        amount: order.total,
        order_number: order.order_number,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "checkPayment") {
      const { orderId } = params;
      if (!orderId) throw new Error("orderId is required");

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("qpay_invoice_id, payment_status, id")
        .eq("id", orderId)
        .single();

      if (orderErr || !order) throw new Error("Order not found");
      if (!order.qpay_invoice_id) throw new Error("No QPay invoice for this order");

      // Already paid? Return immediately
      if (order.payment_status === "paid") {
        return new Response(JSON.stringify({ status: "PAID" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const checkResult = await qpayRequest("/payment/check", "POST", {
        object_type: "INVOICE",
        object_id: order.qpay_invoice_id,
        offset: { page_number: 1, page_limit: 100 },
      });

      console.log("QPay payment check result:", JSON.stringify(checkResult));

      // Check if payment rows exist
      const payments = checkResult.rows || [];
      const paidPayment = payments.find((p: any) => p.payment_status === "PAID");

      if (paidPayment) {
        // Update order to PAID
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            payment_reference: paidPayment.payment_id,
            qpay_payment_id: paidPayment.payment_id,
            status: "processing",
          })
          .eq("id", orderId);

        return new Response(JSON.stringify({ status: "PAID", payment_id: paidPayment.payment_id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "PENDING", count: payments.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      // QPay callback - verify payment server-side
      const orderId = params?.orderId || new URL(req.url).searchParams.get("orderId");
      if (!orderId) throw new Error("orderId is required in callback");

      const { data: order } = await supabase
        .from("orders")
        .select("qpay_invoice_id, payment_status")
        .eq("id", orderId)
        .single();

      if (!order?.qpay_invoice_id) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Don't process if already paid
      if (order.payment_status === "paid") {
        return new Response(JSON.stringify({ status: "already_paid" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify via payment/check
      const checkResult = await qpayRequest("/payment/check", "POST", {
        object_type: "INVOICE",
        object_id: order.qpay_invoice_id,
        offset: { page_number: 1, page_limit: 100 },
      });

      const payments = checkResult.rows || [];
      const paidPayment = payments.find((p: any) => p.payment_status === "PAID");

      if (paidPayment) {
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            payment_reference: paidPayment.payment_id,
            qpay_payment_id: paidPayment.payment_id,
            status: "processing",
          })
          .eq("id", orderId);
      }

      return new Response(JSON.stringify({ status: paidPayment ? "PAID" : "PENDING" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("QPay edge function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
