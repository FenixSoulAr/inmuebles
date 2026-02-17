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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_user_id", user.id);

    if (propError) throw propError;
    if (!properties?.length) {
      return new Response(
        JSON.stringify({ message: "No properties", generated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const propertyIds = properties.map((p: { id: string }) => p.id);

    const { data: contracts, error: contractError } = await supabase
      .from("contracts")
      .select("id, property_id, tenant_id, start_date, end_date, current_rent, rent_due_day, currency")
      .in("property_id", propertyIds)
      .eq("is_active", true);

    if (contractError) throw contractError;
    if (!contracts?.length) {
      return new Response(
        JSON.stringify({ message: "No active contracts", generated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    let totalGenerated = 0;

    // Filter only truly active contracts (is_active AND not expired)
    const activeContracts = contracts.filter((c: any) => {
      const endDate = new Date(c.end_date);
      return todayStr <= c.end_date; // already filtered by is_active in query
    });

    console.log(`Active & not-expired contracts: ${activeContracts.length} of ${contracts.length}`);

    for (const contract of activeContracts) {
      const startDate = new Date(contract.start_date);
      const endDate = new Date(contract.end_date);
      const rentDueDay = contract.rent_due_day || 5;

      // Generate periods: -1 to +1 months only, bounded by contract dates
      const periods: string[] = [];
      for (let offset = -1; offset <= 1; offset++) {
        const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        if (periodEnd >= startDate && d <= endDate) {
          periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
      }

      // Get existing obligations for this contract to avoid duplicates
      const { data: existingObls } = await supabase
        .from("obligations")
        .select("period, kind, service_type")
        .eq("contract_id", contract.id);

      const existingKeys = new Set(
        (existingObls || []).map((o: any) => `${o.period}|${o.kind}|${o.service_type || ""}`)
      );

      // Get contract services
      const { data: services } = await supabase
        .from("contract_services")
        .select("service_type, due_day, expected_amount")
        .eq("contract_id", contract.id)
        .eq("active", true);

      const toInsert: Array<Record<string, unknown>> = [];

      for (const period of periods) {
        const [year, month] = period.split("-").map(Number);

        // RENT
        const rentKey = `${period}|rent|`;
        if (!existingKeys.has(rentKey)) {
          const dueDate = new Date(year, month - 1, Math.min(rentDueDay, 28));
          const dueDateStr = dueDate.toISOString().split("T")[0];
          toInsert.push({
            contract_id: contract.id,
            tenant_id: contract.tenant_id,
            property_id: contract.property_id,
            period,
            kind: "rent",
            service_type: null,
            due_date: dueDateStr,
            expected_amount: contract.current_rent,
            currency: contract.currency || "ARS",
            status: dueDateStr < todayStr ? "pending_send" : "upcoming",
          });
        }

        // SERVICES
        if (services) {
          for (const svc of services) {
            const svcKey = `${period}|service|${svc.service_type}`;
            if (!existingKeys.has(svcKey)) {
              const svcDueDay = svc.due_day || rentDueDay;
              const dueDate = new Date(year, month - 1, Math.min(svcDueDay, 28));
              const svcDueDateStr = dueDate.toISOString().split("T")[0];
              toInsert.push({
                contract_id: contract.id,
                tenant_id: contract.tenant_id,
                property_id: contract.property_id,
                period,
                kind: "service",
                service_type: svc.service_type,
                due_date: svcDueDateStr,
                expected_amount: svc.expected_amount || null,
                currency: contract.currency || "ARS",
                status: svcDueDateStr < todayStr ? "pending_send" : "upcoming",
              });
            }
          }
        }
      }

      if (toInsert.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("obligations")
          .insert(toInsert)
          .select("id");

        if (insertError) {
          console.error("Insert error for contract", contract.id, insertError);
        } else {
          totalGenerated += inserted?.length || 0;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Obligations ensured",
        generated: totalGenerated,
        contracts_processed: contracts.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
