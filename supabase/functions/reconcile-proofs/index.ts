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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all payment_proofs without an obligation link
    const { data: orphanProofs, error: fetchErr } = await supabase
      .from("payment_proofs")
      .select("id, contract_id, period, type, service_type, status")
      .is("obligation_id", null);

    if (fetchErr) throw fetchErr;
    if (!orphanProofs || orphanProofs.length === 0) {
      return new Response(
        JSON.stringify({ reconciled: 0, message: "No orphan proofs found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get contract details for creating missing obligations
    const contractIds = [...new Set(orphanProofs.map((p) => p.contract_id))];
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, property_id, tenant_id, rent_due_day, current_rent, currency")
      .in("id", contractIds);

    const contractMap = new Map(contracts?.map((c) => [c.id, c]) || []);

    let reconciled = 0;
    const errors: string[] = [];

    for (const proof of orphanProofs) {
      try {
        const kind = proof.type; // "rent" or "service"
        const svcType = kind === "service" ? proof.service_type : null;

        // Find existing obligation
        let oblQuery = supabase
          .from("obligations")
          .select("id, payment_proof_id, status")
          .eq("contract_id", proof.contract_id)
          .eq("period", proof.period)
          .eq("kind", kind);

        if (svcType) {
          oblQuery = oblQuery.eq("service_type", svcType);
        } else {
          oblQuery = oblQuery.is("service_type", null);
        }

        const { data: existingObls } = await oblQuery;
        let obligation = existingObls?.[0] || null;

        // Create if missing
        if (!obligation) {
          const contract = contractMap.get(proof.contract_id);
          if (!contract) {
            errors.push(`No contract found for proof ${proof.id}`);
            continue;
          }

          const [year, month] = proof.period.split("-").map(Number);
          const dueDay = contract.rent_due_day || 5;
          const dueDate = new Date(year, month - 1, Math.min(dueDay, 28));
          const expectedAmount = kind === "rent" ? contract.current_rent : null;

          const { data: newObl, error: oblErr } = await supabase
            .from("obligations")
            .insert({
              contract_id: proof.contract_id,
              tenant_id: contract.tenant_id,
              property_id: contract.property_id,
              period: proof.period,
              kind,
              service_type: svcType,
              due_date: dueDate.toISOString().split("T")[0],
              expected_amount: expectedAmount,
              currency: contract.currency || "ARS",
              status: "pending_send",
            })
            .select("id, payment_proof_id, status")
            .single();

          if (oblErr) {
            errors.push(`Failed to create obligation for proof ${proof.id}: ${oblErr.message}`);
            continue;
          }
          obligation = newObl;
        }

        // Map proof status to obligation status
        const statusMap: Record<string, string> = {
          pending: "awaiting_review",
          approved: "confirmed",
          rejected: "rejected",
          replaced: "replaced",
        };
        const oblStatus = statusMap[proof.status] || "awaiting_review";

        // Link proof to obligation
        await supabase
          .from("payment_proofs")
          .update({ obligation_id: obligation.id })
          .eq("id", proof.id);

        // Update obligation to point to this proof
        await supabase
          .from("obligations")
          .update({
            payment_proof_id: proof.id,
            status: oblStatus,
          })
          .eq("id", obligation.id);

        reconciled++;
      } catch (err) {
        errors.push(`Error processing proof ${proof.id}: ${String(err)}`);
      }
    }

    // --- Phase 2: Sync rent obligation statuses from actual payments ---
    let rentSynced = 0;
    try {
      // Get all rent obligations that might need status sync
      const { data: rentObls } = await supabase
        .from("obligations")
        .select("id, status, expected_amount, due_date, payment_proof_id")
        .eq("kind", "rent")
        .in("status", ["pending_send", "upcoming", "awaiting_review"]);

      if (rentObls && rentObls.length > 0) {
        for (const obl of rentObls) {
          // Sum actual payments from the payments table
          const { data: payments } = await supabase
            .from("payments")
            .select("amount")
            .eq("obligation_id", obl.id);

          const totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
          if (totalPaid <= 0) continue; // No payments recorded, skip

          const expected = obl.expected_amount ?? 0;
          const balanceDue = Math.max(expected - totalPaid, 0);

          let newStatus: string;
          if (balanceDue <= 0) {
            newStatus = "confirmed";
          } else {
            newStatus = "partial";
          }

          if (newStatus !== obl.status) {
            await supabase
              .from("obligations")
              .update({ status: newStatus })
              .eq("id", obl.id);

            if (newStatus === "confirmed" && obl.payment_proof_id) {
              await supabase
                .from("payment_proofs")
                .update({ status: "approved" })
                .eq("id", obl.payment_proof_id);
            }
            rentSynced++;
          }
        }
      }
    } catch (syncErr) {
      errors.push(`Rent sync error: ${String(syncErr)}`);
    }

    return new Response(
      JSON.stringify({
        reconciled,
        rent_synced: rentSynced,
        total_orphans: orphanProofs.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Reconciliation error:", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
