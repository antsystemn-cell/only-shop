import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, fullName, phone } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get anonymous session for OT API registration
    const otResponse = await callOtApiViaProxy("registerUser", {
      login: email,
      email,
      password,
      phone: phone || "",
    });

    // Extract OT user ID from response
    const otUserId = otResponse?.Result?.UserId?.Value
      || otResponse?.EmailConfirmationInfo?.UserId?.Value
      || otResponse?.UserId?.Value
      || null;

    console.log("[register-ot-user] OT registration result:", {
      hasUserId: !!otUserId,
      errorCode: otResponse?.ErrorCode,
    });

    // 2. If we got an OT user ID, save it to the profiles table
    if (otUserId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get the user by email from auth header
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();

        if (user) {
          await supabase
            .from("profiles")
            .update({ ot_user_id: otUserId })
            .eq("user_id", user.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        otUserId,
        // Don't expose full response, just success status
        registered: !!otUserId || otResponse?.ErrorCode === "Ok",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[register-ot-user] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Call OT API via the existing ot-api edge function ───────

async function callOtApiViaProxy(action: string, params: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/ot-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ action, params }),
  });

  if (!response.ok) {
    throw new Error(`OT API proxy returned ${response.status}`);
  }

  return response.json();
}
