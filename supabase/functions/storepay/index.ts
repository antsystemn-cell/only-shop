import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STOREPAY_AUTH_URL =
  "https://service.storepay.mn:8778/merchant-uaa/oauth/token";
const STOREPAY_BASE =
  "https://service.storepay.mn:8778/lend-merchant";

// Token cache (per cold start)
let cachedToken: { access_token: string; expires_at: number } | null = null;

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getStorepayToken(): Promise<string> {
  // Return cached if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60000) {
    return cachedToken.access_token;
  }

  const username = Deno.env.get("STOREPAY_USERNAME");
  const password = Deno.env.get("STOREPAY_PASSWORD");
  const appUsername = Deno.env.get("STOREPAY_APP_USERNAME");
  const appPassword = Deno.env.get("STOREPAY_APP_PASSWORD");

  if (!username || !password || !appUsername || !appPassword) {
    throw new Error("Storepay credentials not configured");
  }

  const basicAuth = btoa(`${appUsername}:${appPassword}`);
  const url = `${STOREPAY_AUTH_URL}?grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Storepay auth failed [${res.status}]:`, text);
    throw new Error(`Storepay auth failed [${res.status}]`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.access_token;
}

async function storepayRequest(
  path: string,
  method: string,
  body?: any,
  retried = false
): Promise<any> {
  const token = await getStorepayToken();
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${STOREPAY_BASE}${path}`, opts);

  // Retry once on 401
  if (res.status === 401 && !retried) {
    cachedToken = null;
    return storepayRequest(path, method, body, true);
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`Storepay API error [${res.status}] ${path}:`, text);
    throw new Error(`Storepay API error [${res.status}]: ${text}`);
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

    // ===========================
    // CREATE LOAN (INVOICE) via PaymentIntent
    // ===========================
    if (action === "createLoan") {
      const { paymentIntentId } = params;
      if (!paymentIntentId) throw new Error("paymentIntentId is required");

      const { data: pi, error: piErr } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (piErr || !pi) throw new Error("Payment intent not found");

      // If already processing with a loanId, return existing
      if (pi.status === "processing" && pi.invoice_id) {
        const storeId = Deno.env.get("STOREPAY_STORE_ID") || "";
        return jsonResponse({
          loanId: pi.invoice_id,
          amount: pi.amount,
          payment_intent_id: pi.id,
          qrData: JSON.stringify({
            storeCode: storeId,
            description: `Only.mn төлбөр`,
            amount: String(pi.amount),
            callbackUrl: "",
          }),
        });
      }

      if (pi.status !== "initiated" && pi.status !== "failed") {
        throw new Error(`Cannot create loan: status is ${pi.status}`);
      }

      const storeId = Deno.env.get("STOREPAY_STORE_ID");
      if (!storeId) throw new Error("STOREPAY_STORE_ID not configured");

      // Build loan request
      let description = "";
      let phone = "";
      const requestId = crypto.randomUUID();

      if (pi.type === "order") {
        const { data: order } = await supabase
          .from("orders")
          .select("order_number, total, delivery_address")
          .eq("id", pi.reference_id)
          .single();
        if (order) {
          description = `Only.mn захиалга ${order.order_number}`;
          const addr = order.delivery_address as any;
          if (addr?.phone) phone = addr.phone;
        }
      } else if (pi.type === "wallet_topup") {
        description = `Only.mn данс цэнэглэх - ${pi.amount}₮`;
      }

      if (!phone) {
        // Try to get phone from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", pi.user_id)
          .single();
        if (profile?.phone) phone = profile.phone;
      }

      if (!phone) {
        throw new Error("Утасны дугаар шаардлагатай. Профайл хэсэгт утасны дугаараа оруулна уу.");
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const callbackUrl = `${supabaseUrl}/functions/v1/storepay`;

      const loanBody = {
        storeId: Number(storeId),
        mobileNumber: phone,
        description: description || `Only.mn төлбөр - ${pi.amount}₮`,
        amount: Number(pi.amount),
        callbackUrl,
        requestId,
      };

      console.log("Creating Storepay loan:", JSON.stringify(loanBody));
      const result = await storepayRequest("/merchant/loan", "POST", loanBody);
      console.log("Storepay loan result:", JSON.stringify(result));

      if (result.status !== "Success") {
        const msg =
          result.msgList?.[0]?.code || result.msgList?.[0]?.text || "Нэхэмжлэл үүсгэхэд алдаа гарлаа";
        throw new Error(msg);
      }

      const loanId = String(result.value);

      // Update payment intent
      await supabase
        .from("payment_intents")
        .update({
          invoice_id: loanId,
          payment_id: requestId, // store requestId for later checking
          status: "processing",
        })
        .eq("id", pi.id);

      if (pi.type === "order") {
        await supabase
          .from("orders")
          .update({ payment_status: "pending" })
          .eq("id", pi.reference_id);
      }

      // Build QR data per Storepay docs
      const qrData = JSON.stringify({
        storeCode: storeId,
        description: description || `Only.mn төлбөр - ${pi.amount}₮`,
        amount: String(pi.amount),
        callbackUrl,
      });

      return jsonResponse({
        loanId,
        amount: pi.amount,
        payment_intent_id: pi.id,
        qrData,
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

      if (pi.status === "paid") {
        return jsonResponse({ status: "PAID" });
      }

      if (!pi.invoice_id) throw new Error("No loan for this payment intent");

      // Check by loanId
      const result = await storepayRequest(
        `/merchant/loan/check/${pi.invoice_id}`,
        "GET"
      );

      console.log("Storepay check result:", JSON.stringify(result));

      if (result.status === "Success" && result.value === true) {
        // Payment confirmed
        await finalizePayment(supabase, pi);
        return jsonResponse({ status: "PAID" });
      }

      return jsonResponse({ status: "PENDING" });
    }

    // ===========================
    // CALLBACK from Storepay
    // ===========================
    if (action === "callback") {
      const loanId = params?.id || params?.loanId;
      if (!loanId) {
        // Try URL params (Storepay sends ?id=xxxxx)
        return jsonResponse({ error: "loanId required" }, 400);
      }

      const { data: pi } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("invoice_id", String(loanId))
        .eq("provider", "storepay")
        .single();

      if (!pi) {
        return jsonResponse({ error: "Payment intent not found" }, 404);
      }

      if (pi.status === "paid") {
        return jsonResponse({ status: "already_paid" });
      }

      // Verify via API
      const result = await storepayRequest(
        `/merchant/loan/check/${loanId}`,
        "GET"
      );

      if (result.status === "Success" && result.value === true) {
        await finalizePayment(supabase, pi);
        return jsonResponse({ status: "PAID" });
      }

      return jsonResponse({ status: "PENDING" });
    }

    // ===========================
    // CANCEL LOAN
    // ===========================
    if (action === "cancelLoan") {
      const { paymentIntentId } = params;
      if (!paymentIntentId) throw new Error("paymentIntentId is required");

      const { data: pi } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("id", paymentIntentId)
        .single();

      if (!pi?.invoice_id) throw new Error("Payment intent or loan not found");

      // Storepay cancel endpoint
      await storepayRequest("/merchant/account/cancel", "POST", {
        loanId: Number(pi.invoice_id),
      });

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
    // Handle GET callback from Storepay (webhook ?id=xxx)
    // ===========================
    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("Storepay edge function error:", error);

    // Check if this is a GET callback from Storepay (?id=xxx)
    if (req.method === "GET" || req.method === "POST") {
      const url = new URL(req.url);
      const callbackId = url.searchParams.get("id");
      if (callbackId) {
        try {
          const supabase = getSupabaseAdmin();
          const { data: pi } = await supabase
            .from("payment_intents")
            .select("*")
            .eq("invoice_id", callbackId)
            .eq("provider", "storepay")
            .single();

          if (pi && pi.status !== "paid") {
            const result = await storepayRequest(
              `/merchant/loan/check/${callbackId}`,
              "GET"
            );
            if (result.status === "Success" && result.value === true) {
              await finalizePayment(supabase, pi);
            }
          }
          return jsonResponse({ status: "ok" });
        } catch (cbErr) {
          console.error("Storepay callback error:", cbErr);
          return jsonResponse({ status: "error" }, 500);
        }
      }
    }

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
    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_reference: `storepay-${pi.invoice_id}`,
        status: "processing",
      })
      .eq("id", pi.reference_id);
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
