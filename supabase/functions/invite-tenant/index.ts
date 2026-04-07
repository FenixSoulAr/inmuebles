import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Verify the calling user (property owner/admin)
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace("Bearer ", "")
    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const userId = claimsData.claims.sub

    const { tenant_id, email, project_id } = await req.json()

    if (!tenant_id || !email || !project_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id, email and project_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Service role client for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Verify tenant belongs to the caller's project
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, email, project_id")
      .eq("id", tenant_id)
      .eq("project_id", project_id)
      .single()

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found or access denied" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Verify caller is a member of the project
    const { data: isMember } = await supabaseAdmin.rpc("is_project_member", {
      _uid: userId,
      _pid: project_id,
    })

    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "Not a member of this project" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Check if tenant already has auth_user_id
    const { data: existingTenant } = await supabaseAdmin
      .from("tenants")
      .select("auth_user_id")
      .eq("id", tenant_id)
      .single()

    if (existingTenant?.auth_user_id) {
      return new Response(
        JSON.stringify({ error: "tenant_already_invited" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Invite user via Supabase Auth Admin
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { role: "tenant", tenant_id },
      })

    if (inviteError) {
      // If user already exists, try to link
      if (inviteError.message?.includes("already been registered")) {
        // Look up existing user
        const { data: existingUsers } =
          await supabaseAdmin.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(
          (u) => u.email === email
        )

        if (existingUser) {
          // Update tenant with auth_user_id
          await supabaseAdmin
            .from("tenants")
            .update({ auth_user_id: existingUser.id })
            .eq("id", tenant_id)

          // Update user metadata to include tenant role
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            user_metadata: {
              ...existingUser.user_metadata,
              role: "tenant",
              tenant_id,
            },
          })

          return new Response(
            JSON.stringify({
              success: true,
              message: "existing_user_linked",
              user_id: existingUser.id,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }
      }

      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Update tenant with auth_user_id from the invite
    if (inviteData?.user?.id) {
      await supabaseAdmin
        .from("tenants")
        .update({ auth_user_id: inviteData.user.id })
        .eq("id", tenant_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: inviteData?.user?.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
