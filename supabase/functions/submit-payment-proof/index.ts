import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Input validation helpers ---
function validateBody(body: unknown): { valid: true; data: ValidatedInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "invalid_body" };
  }

  const b = body as Record<string, unknown>;

  // token: required, 32-128 char hex string
  if (typeof b.token !== "string" || !/^[0-9a-f]{32,128}$/i.test(b.token)) {
    return { valid: false, error: "invalid_token_format" };
  }

  // type: required enum
  if (!["rent", "service"].includes(b.type as string)) {
    return { valid: false, error: "invalid_type" };
  }

  // service_type: required when type=service
  if (b.type === "service") {
    if (typeof b.service_type !== "string" || b.service_type.length === 0 || b.service_type.length > 100) {
      return { valid: false, error: "missing_service_type" };
    }
  }

  // period: required, YYYY-MM format
  if (typeof b.period !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.period)) {
    return { valid: false, error: "invalid_period_format" };
  }

  // amount: required, positive number, reasonable max
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999) {
    return { valid: false, error: "invalid_amount" };
  }

  // paid_at: required, YYYY-MM-DD format
  if (typeof b.paid_at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.paid_at)) {
    return { valid: false, error: "invalid_paid_at_format" };
  }

  // comment: optional, max 1000 chars
  if (b.comment !== undefined && b.comment !== null) {
    if (typeof b.comment !== "string" || b.comment.length > 1000) {
      return { valid: false, error: "invalid_comment" };
    }
  }

  // files: required array of strings, 1-10 items, each max 500 chars
  if (!Array.isArray(b.files) || b.files.length === 0 || b.files.length > 10) {
    return { valid: false, error: "invalid_files" };
  }
  for (const f of b.files) {
    if (typeof f !== "string" || f.length === 0 || f.length > 500) {
      return { valid: false, error: "invalid_file_entry" };
    }
  }

  // action: optional enum
  if (b.action !== undefined && b.action !== null && !["replace", "add"].includes(b.action as string)) {
    return { valid: false, error: "invalid_action" };
  }

  // replaces_proof_id: optional uuid
  if (b.replaces_proof_id !== undefined && b.replaces_proof_id !== null) {
    if (typeof b.replaces_proof_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.replaces_proof_id)) {
      return { valid: false, error: "invalid_replaces_proof_id" };
    }
  }

  return {
    valid: true,
    data: {
      token: b.token as string,
      type: b.type as "rent" | "service",
      service_type: b.type === "service" ? (b.service_type as string) : null,
      period: b.period as string,
      amount,
      paid_at: b.paid_at as string,
      comment: (b.comment as string) || null,
      files: b.files as string[],
      action: (b.action as string) || null,
      replaces_proof_id: (b.replaces_proof_id as string) || null,
    },
  };
}

interface ValidatedInput {
  token: string;
  type: "rent" | "service";
  service_type: string | null;
  period: string;
  amount: number;
  paid_at: string;
  comment: string | null;
  files: string[];
  action: string | null;
  replaces_proof_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const validation = validateBody(rawBody);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token, type, service_type: svcType, period, amount, paid_at, comment, files, action, replaces_proof_id } = validation.data;

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
        service_type: svcType,
        period,
        amount,
        paid_at,
        comment,
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
