import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || token.length < 32) {
      return new Response(
        JSON.stringify({ error: "invalid_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: contract, error } = await supabase
      .from("contracts")
      .select(`
        id, is_active, token_status,
        properties(internal_identifier, full_address),
        tenants(full_name, preferred_language)
      `)
      .eq("public_submission_token", token)
      .maybeSingle();

    if (error) throw error;

    if (!contract || !contract.is_active || contract.token_status !== "active") {
      return new Response(
        JSON.stringify({ error: "link_invalid" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantData = contract.tenants as any;
    const language = tenantData?.preferred_language || "es";

    return new Response(
      JSON.stringify({
        contract_id: contract.id,
        property: contract.properties,
        tenant: contract.tenants,
        language,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
