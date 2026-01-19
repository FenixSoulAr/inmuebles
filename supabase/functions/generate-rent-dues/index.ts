import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Contract {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  current_rent: number;
  is_active: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header to verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { contract_id } = body;

    let contracts: Contract[] = [];

    if (contract_id) {
      // Generate for a specific contract
      console.log("Generating rent dues for contract:", contract_id);
      
      const { data, error } = await supabase
        .from("contracts")
        .select("id, property_id, tenant_id, start_date, end_date, current_rent, is_active")
        .eq("id", contract_id)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching contract:", error);
        throw error;
      }
      
      contracts = data || [];
    } else {
      // Generate for all active contracts owned by user
      console.log("Generating rent dues for all active contracts");
      
      // Get properties owned by user
      const { data: properties, error: propError } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_user_id", user.id);

      if (propError) {
        console.error("Error fetching properties:", propError);
        throw propError;
      }

      if (!properties || properties.length === 0) {
        return new Response(
          JSON.stringify({ message: "No properties found", generated: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const propertyIds = properties.map((p) => p.id);

      const { data, error } = await supabase
        .from("contracts")
        .select("id, property_id, tenant_id, start_date, end_date, current_rent, is_active")
        .in("property_id", propertyIds)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching contracts:", error);
        throw error;
      }
      
      contracts = data || [];
    }

    console.log("Found contracts:", contracts.length);

    if (contracts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active contracts found", generated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalGenerated = 0;
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    for (const contract of contracts) {
      console.log("Processing contract:", contract.id);
      
      const startDate = new Date(contract.start_date);
      const endDate = new Date(contract.end_date);
      
      // Start from the later of contract start or current month
      let monthToGenerate = new Date(Math.max(startDate.getTime(), currentMonth.getTime()));
      monthToGenerate = new Date(monthToGenerate.getFullYear(), monthToGenerate.getMonth(), 1);

      const rentDuesToInsert = [];
      const maxMonths = 12;
      let monthCount = 0;

      while (monthToGenerate <= endDate && monthCount < maxMonths) {
        const periodMonth = `${monthToGenerate.getFullYear()}-${String(monthToGenerate.getMonth() + 1).padStart(2, "0")}`;
        
        // Due date is the 5th of each month
        const dueDate = new Date(monthToGenerate.getFullYear(), monthToGenerate.getMonth(), 5);
        
        // Determine status based on due date
        let status = "pending";
        if (dueDate < today) {
          status = "overdue";
        }

        rentDuesToInsert.push({
          contract_id: contract.id,
          property_id: contract.property_id,
          tenant_id: contract.tenant_id,
          period_month: periodMonth,
          due_date: dueDate.toISOString().split("T")[0],
          expected_amount: contract.current_rent,
          balance_due: contract.current_rent,
          status: status,
        });

        monthToGenerate.setMonth(monthToGenerate.getMonth() + 1);
        monthCount++;
      }

      console.log("Rent dues to insert for contract:", rentDuesToInsert.length);

      // Upsert to handle duplicates gracefully (unique constraint on contract_id + period_month)
      if (rentDuesToInsert.length > 0) {
        const { error: insertError, data: insertedData } = await supabase
          .from("rent_dues")
          .upsert(rentDuesToInsert, {
            onConflict: "contract_id,period_month",
            ignoreDuplicates: true,
          })
          .select();

        if (insertError) {
          console.error("Error inserting rent dues:", insertError);
          // Continue with other contracts
        } else {
          totalGenerated += insertedData?.length || 0;
          console.log("Inserted rent dues:", insertedData?.length || 0);
        }
      }
    }

    console.log("Total rent dues generated:", totalGenerated);

    return new Response(
      JSON.stringify({ 
        message: "Rent schedule updated", 
        generated: totalGenerated,
        contracts_processed: contracts.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in generate-rent-dues:", error);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
