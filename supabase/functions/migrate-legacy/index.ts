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
    // Auth check - admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, jobId, params } = body;

    switch (action) {
      case "migrate_users":
        return await migrateUsers(adminClient, jobId, params, userId);
      case "migrate_orders":
        return await migrateOrders(adminClient, jobId, params, userId);
      case "migrate_wallets":
        return await migrateWallets(adminClient, jobId, params, userId);
      case "migrate_addresses":
        return await migrateAddresses(adminClient, jobId, params, userId);
      case "get_job_status":
        return await getJobStatus(adminClient, jobId);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error: unknown) {
    console.error("[migrate-legacy] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callOtApi(action: string, params: Record<string, unknown> = {}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/ot-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ action, params }),
  });

  if (!response.ok) {
    throw new Error(`OT API returned ${response.status}`);
  }
  return response.json();
}

// ─── Migrate Users ──────────────────────────────────────
async function migrateUsers(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  params: { framePosition?: number; frameSize?: number },
  createdBy: string
) {
  const frameSize = params?.frameSize || 50;
  const framePosition = params?.framePosition || 0;

  // Create or update job
  if (!jobId) {
    const { data: job } = await supabase
      .from("migration_jobs")
      .insert({
        job_type: "users",
        status: "running",
        started_at: new Date().toISOString(),
        created_by: createdBy,
        params: { frameSize, framePosition },
      })
      .select()
      .single();
    jobId = job?.id;
  }

  try {
    const result = await callOtApi("searchUsers", {
      framePosition,
      frameSize,
    });

    const users = result?.data?.Result?.Items?.Content?.Item;
    const totalCount = result?.data?.Result?.Items?.TotalCount || 0;
    const items = Array.isArray(users) ? users : users ? [users] : [];

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ item: string; error: string }> = [];

    for (const user of items) {
      try {
        const otUserId = user?.Id?.Value || user?.Id;
        const email = user?.Email?.Value || user?.Email || "";
        const login = user?.Login?.Value || user?.Login || "";
        const phone = user?.Phone?.Value || user?.Phone || "";
        const fullName = user?.FullName?.Value || user?.FullName || login || "";

        if (!email && !login) {
          errorCount++;
          errors.push({ item: otUserId || "unknown", error: "No email or login" });
          continue;
        }

        // Upsert into profiles by ot_user_id
        const { error: upsertError } = await supabase
          .from("profiles")
          .upsert(
            {
              ot_user_id: otUserId,
              email: email || `${login}@imported.local`,
              full_name: fullName,
              phone: phone,
              user_id: crypto.randomUUID(), // placeholder if no auth user
            },
            { onConflict: "ot_user_id", ignoreDuplicates: true }
          );

        if (upsertError) {
          // Try update existing
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ full_name: fullName, phone: phone })
            .eq("ot_user_id", otUserId);
          
          if (updateError) {
            errorCount++;
            errors.push({ item: otUserId, error: updateError.message });
            continue;
          }
        }
        successCount++;
      } catch (e: unknown) {
        errorCount++;
        errors.push({
          item: String(user?.Id?.Value || "unknown"),
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    await supabase
      .from("migration_jobs")
      .update({
        total_count: totalCount,
        processed_count: framePosition + items.length,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.slice(0, 100),
        status: framePosition + items.length >= totalCount ? "completed" : "running",
        completed_at:
          framePosition + items.length >= totalCount
            ? new Date().toISOString()
            : null,
      })
      .eq("id", jobId);

    return json({
      success: true,
      jobId,
      totalCount,
      processed: framePosition + items.length,
      successCount,
      errorCount,
      hasMore: framePosition + items.length < totalCount,
      nextPosition: framePosition + items.length,
    });
  } catch (error: unknown) {
    await supabase
      .from("migration_jobs")
      .update({ status: "failed", errors: [{ error: String(error) }] })
      .eq("id", jobId);
    throw error;
  }
}

// ─── Migrate Orders ─────────────────────────────────────
async function migrateOrders(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  params: { framePosition?: number; frameSize?: number; userId?: string },
  createdBy: string
) {
  const frameSize = params?.frameSize || 20;
  const framePosition = params?.framePosition || 0;

  if (!jobId) {
    const { data: job } = await supabase
      .from("migration_jobs")
      .insert({
        job_type: "orders",
        status: "running",
        started_at: new Date().toISOString(),
        created_by: createdBy,
        params,
      })
      .select()
      .single();
    jobId = job?.id;
  }

  try {
    const searchParams: Record<string, unknown> = {
      framePosition,
      frameSize,
    };
    if (params?.userId) {
      searchParams.userId = params.userId;
    }

    const result = await callOtApi("searchOrders", searchParams);
    const orders = result?.data?.Result?.Items?.Content?.Item;
    const totalCount = result?.data?.Result?.Items?.TotalCount || 0;
    const items = Array.isArray(orders) ? orders : orders ? [orders] : [];

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ item: string; error: string }> = [];

    for (const order of items) {
      try {
        const orderId = order?.Id?.Value || order?.Id || "";
        const orderNumber = order?.DisplayId?.Value || order?.DisplayId || orderId;
        const status = mapOtOrderStatus(order?.StatusId?.Value || order?.StatusId);
        const total = parseFloat(order?.TotalCostInUserCurrency?.Value || "0");
        const subtotal = parseFloat(order?.GoodsCostInUserCurrency?.Value || "0");
        const deliveryFee = parseFloat(order?.DeliveryCostInUserCurrency?.Value || "0");

        // Check if already exists
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("order_number", `OT-${orderNumber}`)
          .maybeSingle();

        if (existing) {
          successCount++;
          continue; // Skip duplicates
        }

        // Find local user by ot_user_id
        const otUserId = order?.UserId?.Value || order?.UserId;
        let localUserId = null;
        if (otUserId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("ot_user_id", otUserId)
            .maybeSingle();
          localUserId = profile?.user_id;
        }

        const { error: insertError } = await supabase.from("orders").insert({
          order_number: `OT-${orderNumber}`,
          status,
          subtotal,
          delivery_fee: deliveryFee,
          total,
          user_id: localUserId,
          payment_status: "paid",
          payment_method: "legacy",
          notes: `Imported from legacy OT order ${orderId}`,
        });

        if (insertError) {
          errorCount++;
          errors.push({ item: orderNumber, error: insertError.message });
        } else {
          successCount++;
        }
      } catch (e: unknown) {
        errorCount++;
        errors.push({
          item: String(order?.DisplayId?.Value || "unknown"),
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    const processed = framePosition + items.length;
    await supabase
      .from("migration_jobs")
      .update({
        total_count: totalCount,
        processed_count: processed,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.slice(0, 100),
        status: processed >= totalCount ? "completed" : "running",
        completed_at: processed >= totalCount ? new Date().toISOString() : null,
      })
      .eq("id", jobId);

    return json({
      success: true,
      jobId,
      totalCount,
      processed,
      successCount,
      errorCount,
      hasMore: processed < totalCount,
      nextPosition: processed,
    });
  } catch (error: unknown) {
    await supabase
      .from("migration_jobs")
      .update({ status: "failed", errors: [{ error: String(error) }] })
      .eq("id", jobId);
    throw error;
  }
}

// ─── Migrate Wallets ────────────────────────────────────
async function migrateWallets(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  params: { framePosition?: number; frameSize?: number },
  createdBy: string
) {
  const frameSize = params?.frameSize || 50;
  const framePosition = params?.framePosition || 0;

  if (!jobId) {
    const { data: job } = await supabase
      .from("migration_jobs")
      .insert({
        job_type: "wallets",
        status: "running",
        started_at: new Date().toISOString(),
        created_by: createdBy,
        params,
      })
      .select()
      .single();
    jobId = job?.id;
  }

  try {
    const result = await callOtApi("searchUsers", { framePosition, frameSize });
    const users = result?.data?.Result?.Items?.Content?.Item;
    const totalCount = result?.data?.Result?.Items?.TotalCount || 0;
    const items = Array.isArray(users) ? users : users ? [users] : [];

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ item: string; error: string }> = [];

    for (const user of items) {
      try {
        const otUserId = user?.Id?.Value || user?.Id;
        const balance = parseFloat(user?.Balance?.Value || user?.Balance || "0");

        if (balance <= 0) {
          successCount++;
          continue;
        }

        // Find local user
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("ot_user_id", otUserId)
          .maybeSingle();

        if (!profile?.user_id) {
          errorCount++;
          errors.push({ item: otUserId, error: "No matching local user" });
          continue;
        }

        // Credit wallet
        await supabase.rpc("credit_wallet", {
          p_user_id: profile.user_id,
          p_amount: balance,
        });
        successCount++;
      } catch (e: unknown) {
        errorCount++;
        errors.push({
          item: String(user?.Id?.Value || "unknown"),
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    const processed = framePosition + items.length;
    await supabase
      .from("migration_jobs")
      .update({
        total_count: totalCount,
        processed_count: processed,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.slice(0, 100),
        status: processed >= totalCount ? "completed" : "running",
        completed_at: processed >= totalCount ? new Date().toISOString() : null,
      })
      .eq("id", jobId);

    return json({
      success: true,
      jobId,
      totalCount,
      processed,
      successCount,
      errorCount,
      hasMore: processed < totalCount,
      nextPosition: processed,
    });
  } catch (error: unknown) {
    await supabase
      .from("migration_jobs")
      .update({ status: "failed", errors: [{ error: String(error) }] })
      .eq("id", jobId);
    throw error;
  }
}

// ─── Migrate Addresses ──────────────────────────────────
async function migrateAddresses(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  params: { framePosition?: number; frameSize?: number },
  createdBy: string
) {
  const frameSize = params?.frameSize || 50;
  const framePosition = params?.framePosition || 0;

  if (!jobId) {
    const { data: job } = await supabase
      .from("migration_jobs")
      .insert({
        job_type: "addresses",
        status: "running",
        started_at: new Date().toISOString(),
        created_by: createdBy,
        params,
      })
      .select()
      .single();
    jobId = job?.id;
  }

  try {
    const result = await callOtApi("searchUsers", { framePosition, frameSize });
    const users = result?.data?.Result?.Items?.Content?.Item;
    const totalCount = result?.data?.Result?.Items?.TotalCount || 0;
    const items = Array.isArray(users) ? users : users ? [users] : [];

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ item: string; error: string }> = [];

    for (const user of items) {
      try {
        const otUserId = user?.Id?.Value || user?.Id;
        const address = user?.Address?.Value || user?.Address || "";
        const city = user?.City?.Value || user?.City || "";
        const phone = user?.Phone?.Value || user?.Phone || "";

        if (!address && !city) {
          successCount++;
          continue;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("ot_user_id", otUserId)
          .maybeSingle();

        if (!profile?.user_id) {
          errorCount++;
          errors.push({ item: otUserId, error: "No matching local user" });
          continue;
        }

        // Check if address already exists
        const { data: existing } = await supabase
          .from("user_addresses")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("street_address", address || "Imported")
          .maybeSingle();

        if (existing) {
          successCount++;
          continue;
        }

        const { error: insertError } = await supabase.from("user_addresses").insert({
          user_id: profile.user_id,
          city: city || "Улаанбаатар",
          street_address: address || "Imported from legacy",
          phone: phone,
          label: "Legacy",
          is_default: false,
        });

        if (insertError) {
          errorCount++;
          errors.push({ item: otUserId, error: insertError.message });
        } else {
          successCount++;
        }
      } catch (e: unknown) {
        errorCount++;
        errors.push({
          item: String(user?.Id?.Value || "unknown"),
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    const processed = framePosition + items.length;
    await supabase
      .from("migration_jobs")
      .update({
        total_count: totalCount,
        processed_count: processed,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.slice(0, 100),
        status: processed >= totalCount ? "completed" : "running",
        completed_at: processed >= totalCount ? new Date().toISOString() : null,
      })
      .eq("id", jobId);

    return json({
      success: true,
      jobId,
      totalCount,
      processed,
      successCount,
      errorCount,
      hasMore: processed < totalCount,
      nextPosition: processed,
    });
  } catch (error: unknown) {
    await supabase
      .from("migration_jobs")
      .update({ status: "failed", errors: [{ error: String(error) }] })
      .eq("id", jobId);
    throw error;
  }
}

// ─── Get Job Status ─────────────────────────────────────
async function getJobStatus(
  supabase: ReturnType<typeof createClient>,
  jobId: string
) {
  const { data, error } = await supabase
    .from("migration_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) return json({ error: error.message }, 404);
  return json({ success: true, job: data });
}

// ─── Helpers ────────────────────────────────────────────
function mapOtOrderStatus(statusId: string | number): string {
  const map: Record<string, string> = {
    "0": "pending",
    "1": "processing",
    "2": "processing",
    "3": "shipped",
    "4": "delivered",
    "5": "cancelled",
    "-1": "cancelled",
  };
  return map[String(statusId)] || "pending";
}
