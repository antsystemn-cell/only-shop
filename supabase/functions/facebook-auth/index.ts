import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, redirect_uri, return_to } = await req.json();

    const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID")!;
    const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ─── Action: get-login-url ─────────────────────────────────
    if (action === "get-login-url") {
      // State encodes the return_to path for post-login redirect
      const state = JSON.stringify({ return_to: return_to || "/" });
      const stateB64 = btoa(state);

      const params = new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        redirect_uri: redirect_uri,
        scope: "email,public_profile",
        response_type: "code",
        state: stateB64,
      });

      const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
      return new Response(JSON.stringify({ url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: exchange-code ─────────────────────────────────
    if (action === "exchange-code") {
      if (!code || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: "Missing code or redirect_uri" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 1. Exchange code for access token
      const tokenParams = new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: redirect_uri,
        code: code,
      });

      const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`
      );
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error("Facebook token exchange error:", tokenData.error);
        return new Response(
          JSON.stringify({ error: tokenData.error.message || "Token exchange failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;

      // 2. Get user profile from Facebook
      const profileRes = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
      );
      const profile = await profileRes.json();

      if (!profile.id) {
        return new Response(
          JSON.stringify({ error: "Failed to get Facebook profile" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const email = profile.email;
      const fullName = profile.name || "";
      const avatarUrl = profile.picture?.data?.url || null;
      const facebookId = profile.id;

      // 3. Create or sign in user via Supabase Admin
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      let userId: string | null = null;
      let sessionData: any = null;

      const userEmail = email || `fb_${facebookId}@facebook.placeholder`;

      // Try to create user first; if exists, just proceed
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: userEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          avatar_url: avatarUrl,
          facebook_id: facebookId,
        },
      });

      if (createErr) {
        // User already exists - this is fine, just update profile
        console.log("User exists, proceeding with login:", userEmail);

        // Update profile with Facebook avatar
        await supabaseAdmin
          .from("profiles")
          .update({ avatar_url: avatarUrl })
          .eq("email", userEmail);
      } else {
        userId = newUser.user!.id;
      }


      // Generate a magic link / session for the user
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
      });

      if (linkErr || !linkData) {
        console.error("Generate link error:", linkErr);
        return new Response(
          JSON.stringify({ error: "Сессия үүсгэхэд алдаа гарлаа" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract the token_hash from the generated link
      const linkUrl = new URL(linkData.properties.action_link);
      const tokenHash = linkUrl.searchParams.get("token_hash") || linkUrl.hash?.match(/token_hash=([^&]+)/)?.[1];
      const type = linkUrl.searchParams.get("type") || "magiclink";

      return new Response(
        JSON.stringify({
          success: true,
          token_hash: tokenHash,
          type: type,
          email: userEmail,
          profile: { full_name: fullName, avatar_url: avatarUrl },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Facebook auth error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
