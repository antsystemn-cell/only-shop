import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAdmin(): any {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Phone helpers ──────────────────────────────────────────────
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-\+\(\)]/g, "");
  if (/^976\d{8}$/.test(digits)) return digits.slice(3);
  if (/^\d{8}$/.test(digits)) return digits;
  return null;
}

function phoneToEmail(phone: string): string {
  return `976${phone}@phone.only.mn`;
}

function isValidMnPhone(phone: string): boolean {
  return /^[89]\d{7}$/.test(phone);
}

// ── OTP helpers ───────────────────────────────────────────────
function generateOtp(length: number): string {
  const chars = "0123456789";
  let code = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    code += chars[arr[i] % 10];
  }
  return code;
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── SMS sending ───────────────────────────────────────────────
async function sendSms(
  supabase: any,
  to: string,
  text: string,
  type: string = "otp"
): Promise<{ success: boolean; error?: string; response?: unknown }> {
  // Get gateway settings
  const { data: settingsRaw } = await supabase
    .from("admin_settings")
    .select("setting_key, setting_value")
    .in("setting_key", [
      "sms_base_url",
      "sms_sender_number",
      "sms_enabled",
    ]);
  const settings: any[] = (settingsRaw as any) || [];

  const getVal = (key: string) => {
    const s = settings.find((s: any) => s.setting_key === key);
    try {
      return s ? JSON.parse(String(s.setting_value)) : "";
    } catch {
      return s?.setting_value || "";
    }
  };

  const smsEnabled = getVal("sms_enabled") === "true" || getVal("sms_enabled") === true;
  if (!smsEnabled) {
    return { success: false, error: "SMS илгээх боломж идэвхгүй байна" };
  }

  const baseUrl = getVal("sms_base_url") || "https://api.messagepro.mn/send";
  const senderNumber = getVal("sms_sender_number");
  const apiKey = Deno.env.get("MESSAGEPRO_API_KEY");

  if (!apiKey) {
    return { success: false, error: "SMS API key тохируулаагүй байна" };
  }
  if (!senderNumber) {
    return { success: false, error: "SMS илгээгчийн дугаар тохируулаагүй байна" };
  }

  const fullPhone = to.length === 8 ? `976${to}` : to;
  const url = `${baseUrl}?from=${encodeURIComponent(senderNumber)}&to=${encodeURIComponent(fullPhone)}&text=${encodeURIComponent(text)}`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });

    const respText = await resp.text();
    let respJson: unknown;
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = respText;
    }

    const success = resp.status === 200;

    // Log SMS
    await supabase.from("sms_logs").insert({
      type,
      to_phone: to,
      message: text,
      provider_status: String(resp.status),
      provider_response: typeof respJson === "object" ? respJson : { raw: respText },
      success,
    });

    return { success, response: respJson, error: success ? undefined : `HTTP ${resp.status}` };
  } catch (e: any) {
    await supabase.from("sms_logs").insert({
      type,
      to_phone: to,
      message: text,
      provider_status: "error",
      provider_response: { error: e.message },
      success: false,
    });
    return { success: false, error: e.message };
  }
}

// ── Auth settings helper ──────────────────────────────────────
async function getAuthSettings(supabase: any) {
  const { data } = await supabase
    .from("admin_settings")
    .select("setting_key, setting_value")
    .eq("category", "auth");

  const settings: Record<string, any> = {};
  for (const row of data || []) {
    try {
      settings[row.setting_key] = JSON.parse(String(row.setting_value));
    } catch {
      settings[row.setting_key] = row.setting_value;
    }
  }
  return settings;
}

// ── Require admin auth from request ───────────────────────────
async function requireAdmin(
  supabase: any,
  req: Request
): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .single();
  return role ? user.id : null;
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = getAdmin();

    switch (action) {
      // ── Public: get auth settings ─────────────────────────
      case "get-auth-settings": {
        const settings = await getAuthSettings(supabase);
        return json({ settings });
      }

      // ── Public: resolve phone → email for password login ──
      case "resolve-phone": {
        const phone = normalizePhone(body.phone || "");
        if (!phone || !isValidMnPhone(phone)) {
          return json({ error: "Утасны дугаар буруу байна" }, 400);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, email")
          .eq("phone", phone)
          .single();

        if (!profile) {
          return json({ error: "Энэ утасны дугаартай бүртгэл олдсонгүй" }, 404);
        }

        return json({ email: profile.email });
      }

      // ── Public: register with phone ───────────────────────
      case "register-phone": {
        const phone = normalizePhone(body.phone || "");
        if (!phone || !isValidMnPhone(phone)) {
          return json({ error: "Утасны дугаар буруу байна" }, 400);
        }
        if (!body.password || body.password.length < 6) {
          return json({ error: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" }, 400);
        }

        const settings = await getAuthSettings(supabase);

        if (settings.phone_registration_enabled === "false" || settings.phone_registration_enabled === false) {
          return json({ error: "Утасны дугаараар бүртгүүлэх боломж идэвхгүй байна" }, 403);
        }

        // Check if phone already registered
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .single();

        if (existing) {
          return json({ error: "Энэ утасны дугаараар бүртгэл үүссэн байна" }, 409);
        }

        // If OTP required, verify OTP was completed
        const otpRequired =
          settings.phone_registration_otp_required === "true" ||
          settings.phone_registration_otp_required === true;
        if (otpRequired && body.otp_verified !== true) {
          return json({ error: "OTP баталгаажуулалт шаардлагатай", otp_required: true }, 400);
        }

        // Create Supabase user with generated email
        const fakeEmail = phoneToEmail(phone);
        const userEmail = body.email?.trim() || fakeEmail;

        // Check if email user exists
        if (body.email) {
          const { data: emailExists } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", body.email.trim())
            .single();
          if (emailExists) {
            return json({ error: "Энэ имэйл хаягаар бүртгэл үүссэн байна" }, 409);
          }
        }

        const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
          email: userEmail,
          password: body.password,
          email_confirm: true,
          user_metadata: {
            full_name: body.full_name || "",
            phone: phone,
          },
        });

        if (createErr) {
          if (createErr.message?.includes("already been registered")) {
            return json({ error: "Энэ мэдээллээр бүртгэл үүссэн байна" }, 409);
          }
          return json({ error: createErr.message }, 500);
        }

        // Update profile with phone
        if (authUser.user) {
          await supabase
            .from("profiles")
            .update({ phone, email: userEmail })
            .eq("user_id", authUser.user.id);
        }

        return json({ success: true, message: "Бүртгэл амжилттай" });
      }

      // ── Public: send OTP ──────────────────────────────────
      case "send-otp": {
        const phone = normalizePhone(body.phone || "");
        if (!phone || !isValidMnPhone(phone)) {
          return json({ error: "Утасны дугаар буруу байна" }, 400);
        }

        const purpose = body.purpose || "login";
        const settings = await getAuthSettings(supabase);

        // Check if OTP login is enabled (for login purpose)
        if (purpose === "login") {
          const otpEnabled =
            settings.phone_otp_login_enabled === "true" ||
            settings.phone_otp_login_enabled === true;
          if (!otpEnabled) {
            return json({ error: "OTP нэвтрэлт идэвхгүй байна" }, 403);
          }

          // Check user exists for login
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("phone", phone)
            .single();
          if (!profile) {
            return json({ error: "Энэ утасны дугаартай бүртгэл олдсонгүй" }, 404);
          }
        }

        // For reset_password, check user exists
        if (purpose === "reset_password") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("phone", phone)
            .single();
          if (!profile) {
            return json({ error: "Энэ утасны дугаартай бүртгэл олдсонгүй" }, 404);
          }
        }

        // Rate limit: check cooldown
        const cooldown = parseInt(settings.otp_resend_cooldown_seconds) || 60;
        const { data: recentOtp } = await supabase
          .from("otp_codes")
          .select("created_at")
          .eq("phone_number", phone)
          .eq("purpose", purpose)
          .is("used_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (recentOtp) {
          const elapsed =
            (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000;
          if (elapsed < cooldown) {
            const remaining = Math.ceil(cooldown - elapsed);
            return json(
              { error: `${remaining} секундын дараа дахин оролдоно уу`, cooldown_remaining: remaining },
              429
            );
          }
        }

        // Generate OTP
        const otpLength = parseInt(settings.otp_length) || 4;
        const otpExpiry = parseInt(settings.otp_expiry_seconds) || 180;
        const maxAttempts = parseInt(settings.otp_max_attempts) || 5;
        const code = generateOtp(otpLength);
        const codeHash = await hashCode(code);

        // Store OTP
        await supabase.from("otp_codes").insert({
          phone_number: phone,
          purpose,
          code_hash: codeHash,
          expires_at: new Date(Date.now() + otpExpiry * 1000).toISOString(),
          max_attempts: maxAttempts,
        });

        // Build message from template
        const template =
          settings.otp_message_template ||
          "Таны баталгаажуулах код: {{CODE}}. Хугацаа: {{MINUTES}} минут.";
        const message = template
          .replace("{{CODE}}", code)
          .replace("{{MINUTES}}", String(Math.ceil(otpExpiry / 60)));

        // Send SMS
        const result = await sendSms(supabase, phone, message, "otp");
        if (!result.success) {
          return json({ error: result.error || "SMS илгээхэд алдаа гарлаа" }, 500);
        }

        return json({
          success: true,
          message: "OTP код илгээгдлээ",
          expires_in: otpExpiry,
          cooldown: cooldown,
        });
      }

      // ── Public: verify OTP ────────────────────────────────
      case "verify-otp": {
        const phone = normalizePhone(body.phone || "");
        if (!phone || !isValidMnPhone(phone)) {
          return json({ error: "Утасны дугаар буруу байна" }, 400);
        }
        if (!body.code) {
          return json({ error: "OTP код оруулна уу" }, 400);
        }

        const purpose = body.purpose || "login";
        const codeHash = await hashCode(body.code);

        // Find valid OTP
        const { data: otpRecord, error: otpErr } = await supabase
          .from("otp_codes")
          .select("*")
          .eq("phone_number", phone)
          .eq("purpose", purpose)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!otpRecord || otpErr) {
          return json({ error: "Кодын хугацаа дууссан байна. Дахин код авна уу." }, 400);
        }

        // Check attempts
        if (otpRecord.attempts_count >= otpRecord.max_attempts) {
          await supabase
            .from("otp_codes")
            .update({ used_at: new Date().toISOString() })
            .eq("id", otpRecord.id);
          return json({ error: "Оролдлогын тоо хэтэрсэн байна. Дахин код авна уу." }, 429);
        }

        // Increment attempts
        await supabase
          .from("otp_codes")
          .update({ attempts_count: otpRecord.attempts_count + 1 })
          .eq("id", otpRecord.id);

        if (otpRecord.code_hash !== codeHash) {
          const remaining = otpRecord.max_attempts - otpRecord.attempts_count - 1;
          return json({ error: `OTP код буруу байна. ${remaining} оролдлого үлдлээ.` }, 400);
        }

        // Mark as used
        await supabase
          .from("otp_codes")
          .update({ used_at: new Date().toISOString() })
          .eq("id", otpRecord.id);

        // For login purpose, generate session
        if (purpose === "login") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, email")
            .eq("phone", phone)
            .single();

          if (!profile) {
            return json({ error: "Хэрэглэгч олдсонгүй" }, 404);
          }

          // Generate magic link token for session creation
          const { data: linkData, error: linkErr } =
            await supabase.auth.admin.generateLink({
              type: "magiclink",
              email: profile.email,
            });

          if (linkErr || !linkData) {
            return json({ error: "Сессия үүсгэхэд алдаа гарлаа" }, 500);
          }

          return json({
            success: true,
            verified: true,
            token_hash: linkData.properties?.hashed_token,
            email: profile.email,
          });
        }

        // For register purpose, just confirm verification
        return json({ success: true, verified: true });
      }

      // ── Public: reset password via phone OTP ─────────────
      case "reset-password": {
        const phone = normalizePhone(body.phone || "");
        if (!phone || !isValidMnPhone(phone)) {
          return json({ error: "Утасны дугаар буруу байна" }, 400);
        }
        if (!body.code) {
          return json({ error: "OTP код оруулна уу" }, 400);
        }
        if (!body.new_password || body.new_password.length < 6) {
          return json({ error: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" }, 400);
        }

        const codeHash = await hashCode(body.code);

        // Find valid OTP for reset_password purpose
        const { data: otpRecord, error: otpErr } = await supabase
          .from("otp_codes")
          .select("*")
          .eq("phone_number", phone)
          .eq("purpose", "reset_password")
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!otpRecord || otpErr) {
          return json({ error: "Кодын хугацаа дууссан байна. Дахин код авна уу." }, 400);
        }

        if (otpRecord.attempts_count >= otpRecord.max_attempts) {
          await supabase
            .from("otp_codes")
            .update({ used_at: new Date().toISOString() })
            .eq("id", otpRecord.id);
          return json({ error: "Оролдлогын тоо хэтэрсэн байна. Дахин код авна уу." }, 429);
        }

        await supabase
          .from("otp_codes")
          .update({ attempts_count: otpRecord.attempts_count + 1 })
          .eq("id", otpRecord.id);

        if (otpRecord.code_hash !== codeHash) {
          const remaining = otpRecord.max_attempts - otpRecord.attempts_count - 1;
          return json({ error: `OTP код буруу байна. ${remaining} оролдлого үлдлээ.` }, 400);
        }

        // Mark OTP as used
        await supabase
          .from("otp_codes")
          .update({ used_at: new Date().toISOString() })
          .eq("id", otpRecord.id);

        // Find user by phone
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("phone", phone)
          .single();

        if (!profile) {
          return json({ error: "Хэрэглэгч олдсонгүй" }, 404);
        }

        // Update password
        const { error: updateErr } = await supabase.auth.admin.updateUserById(
          profile.user_id,
          { password: body.new_password }
        );

        if (updateErr) {
          return json({ error: "Нууц үг солиход алдаа гарлаа: " + updateErr.message }, 500);
        }

        return json({ success: true, message: "Нууц үг амжилттай солигдлоо" });
      }

      // ── Internal: notify admin about payment ─────────────
      case "notify-admin-payment": {
        const settings = await getAuthSettings(supabase);

        // Also get notification settings
        const { data: notifSettings } = await supabase
          .from("admin_settings")
          .select("setting_key, setting_value")
          .in("setting_key", ["order_payment_sms_enabled", "order_notification_phones", "order_notification_template"]);

        const getNotifVal = (key: string) => {
          const s = notifSettings?.find((s: any) => s.setting_key === key);
          try { return s ? JSON.parse(String(s.setting_value)) : ""; }
          catch { return s?.setting_value || ""; }
        };

        const enabled = getNotifVal("order_payment_sms_enabled") === "true" || getNotifVal("order_payment_sms_enabled") === true;
        if (!enabled) {
          return json({ success: false, reason: "notification_disabled" });
        }

        const phonesRaw = getNotifVal("order_notification_phones");
        if (!phonesRaw) {
          return json({ success: false, reason: "no_phones_configured" });
        }

        const phones = String(phonesRaw).split(",").map((p: string) => p.trim()).filter(Boolean);
        if (phones.length === 0) {
          return json({ success: false, reason: "no_valid_phones" });
        }

        const template = getNotifVal("order_notification_template") ||
          "Шинэ төлбөр! {{ORDER_NUMBER}} захиалга {{AMOUNT}} төлөгдлөө. Арга: {{METHOD}}";

        const message = template
          .replace("{{ORDER_NUMBER}}", body.order_number || "—")
          .replace("{{AMOUNT}}", body.amount || "—")
          .replace("{{METHOD}}", body.method || "—");

        const results: any[] = [];
        for (const phone of phones) {
          const normalized = normalizePhone(phone);
          if (normalized && isValidMnPhone(normalized)) {
            const result = await sendSms(supabase, normalized, message, "notification");
            results.push({ phone: normalized, ...result });
          }
        }

        return json({ success: true, results });
      }

      // ── Admin: send test SMS ──────────────────────────────
      case "send-test-sms": {
        const adminId = await requireAdmin(supabase, req);
        if (!adminId) {
          return json({ error: "Эрх хүрэхгүй байна" }, 403);
        }

        const phone = normalizePhone(body.phone || "");
        if (!phone || !isValidMnPhone(phone)) {
          return json({ error: "Утасны дугаар буруу байна" }, 400);
        }

        const text = body.text || "Only.mn тест мессеж";
        const result = await sendSms(supabase, phone, text, "test");

        return json({
          success: result.success,
          error: result.error,
          response: result.response,
        });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e: any) {
    console.error("[phone-auth] Error:", e);
    return json({ error: e.message || "Internal error" }, 500);
  }
});
