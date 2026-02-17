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
      .select("id, is_active, token_status, property_id, tenant_id, rent_due_day, current_rent, currency")
      .eq("public_submission_token", token)
      .maybeSingle();

    if (contractError) throw contractError;

    if (!contract || !contract.is_active || contract.token_status !== "active") {
      return new Response(
        JSON.stringify({ error: "link_invalid" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve or create the obligation
    const kind = type;
    const svcType = type === "service" ? service_type : null;
    const [year, month] = period.split("-").map(Number);
    const dueDay = contract.rent_due_day || 5;
    const dueDate = new Date(year, month - 1, Math.min(dueDay, 28));

    // Try to find existing obligation
    let oblQuery = supabase
      .from("obligations")
      .select("id, payment_proof_id, status")
      .eq("contract_id", contract.id)
      .eq("period", period)
      .eq("kind", kind);

    if (svcType) {
      oblQuery = oblQuery.eq("service_type", svcType);
    } else {
      oblQuery = oblQuery.is("service_type", null);
    }

    const { data: existingObls } = await oblQuery;
    let obligation = existingObls?.[0] || null;

    // Create obligation if it doesn't exist
    if (!obligation) {
      const expectedAmount = kind === "rent" ? contract.current_rent : null;
      const { data: newObl, error: oblError } = await supabase
        .from("obligations")
        .insert({
          contract_id: contract.id,
          tenant_id: contract.tenant_id,
          property_id: contract.property_id,
          period,
          kind,
          service_type: svcType,
          due_date: dueDate.toISOString().split("T")[0],
          expected_amount: expectedAmount,
          currency: contract.currency || "ARS",
          status: "pending_send",
        })
        .select("id, payment_proof_id, status")
        .single();

      if (oblError) throw oblError;
      obligation = newObl;
    }

    // Check for duplicates - obligation already has a proof linked
    if (obligation.payment_proof_id && !action) {
      // Check the linked proof status
      const { data: linkedProof } = await supabase
        .from("payment_proofs")
        .select("id, status")
        .eq("id", obligation.payment_proof_id)
        .single();

      if (linkedProof && ["pending", "approved"].includes(linkedProof.status)) {
        return new Response(
          JSON.stringify({
            duplicate: true,
            existing_proof_id: linkedProof.id,
            existing_status: linkedProof.status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If replacing, mark old as replaced
    if (action === "replace" && replaces_proof_id) {
      await supabase
        .from("payment_proofs")
        .update({ status: "replaced" })
        .eq("id", replaces_proof_id);
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
        obligation_id: obligation.id,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Update obligation to link to this proof and set status
    await supabase
      .from("obligations")
      .update({
        payment_proof_id: proof.id,
        status: "awaiting_review",
      })
      .eq("id", obligation.id);

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
