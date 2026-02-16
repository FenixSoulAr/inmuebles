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
    const body = await req.json();
    const {
      token,
      type,
      service_type,
      period,
      amount,
      paid_at,
      comment,
      files,
      action,
      replaces_proof_id,
    } = body;

    // Validate required fields
    if (!token || !type || !period || !amount || !paid_at || !files?.length) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["rent", "service"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "invalid_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "service" && !service_type) {
      return new Response(
        JSON.stringify({ error: "missing_service_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, is_active, token_status")
      .eq("public_submission_token", token)
      .maybeSingle();

    if (contractError) throw contractError;

    if (!contract || !contract.is_active || contract.token_status !== "active") {
      return new Response(
        JSON.stringify({ error: "link_invalid" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicates
    let duplicateQuery = supabase
      .from("payment_proofs")
      .select("id, status, created_at")
      .eq("contract_id", contract.id)
      .eq("period", period)
      .eq("type", type)
      .in("status", ["pending", "approved"]);

    if (type === "service" && service_type) {
      duplicateQuery = duplicateQuery.eq("service_type", service_type);
    }

    const { data: duplicates, error: dupError } = await duplicateQuery;
    if (dupError) throw dupError;

    if (duplicates && duplicates.length > 0 && !action) {
      // Return duplicate info - let client decide
      return new Response(
        JSON.stringify({
          duplicate: true,
          existing_proof_id: duplicates[0].id,
          existing_status: duplicates[0].status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If replacing, mark old as replaced
    if (action === "replace" && replaces_proof_id) {
      const { error: replaceError } = await supabase
        .from("payment_proofs")
        .update({ status: "replaced" })
        .eq("id", replaces_proof_id);

      if (replaceError) throw replaceError;
    }

    // Create new proof
    const { data: proof, error: insertError } = await supabase
      .from("payment_proofs")
      .insert({
        contract_id: contract.id,
        type,
        service_type: type === "service" ? service_type : null,
        period,
        amount: parseFloat(amount),
        paid_at,
        comment: comment || null,
        files,
        status: "pending",
        replaces_proof_id: action === "replace" ? replaces_proof_id : null,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, proof_id: proof.id }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
