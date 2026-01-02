import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateEstimate, type EstimateInput } from "@/lib/pricing";


const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // kun server
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input: EstimateInput = body.input;
    const customer = body.customer ?? {};

    const result = calculateEstimate(input);

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        customer_name: customer.name ?? null,
        phone: customer.phone ?? null,
        email: customer.email ?? null,

        job_type: input.jobType,
        operation: input.operation,
        condition: input.condition,
        area_m2: input.areaM2,
        wall_area_m2: input.wallAreaM2 ?? null,
        windows_count: input.windowsCount ?? 0,
        doors_count: input.doorsCount ?? 0,
        needs_scaffold: input.needsScaffold ?? false,
        scaffold_weeks: input.scaffoldWeeks ?? null,
        include_materials: input.includeMaterials ?? true,
      })
      .select("id")
      .single();

    if (leadErr) throw leadErr;

    const { data: est, error: estErr } = await supabase
      .from("estimates")
      .insert({
        lead_id: lead.id,
        base_subtotal_nok: result.baseSubtotalNok,
        total_low_nok: result.totalLowNok,
        total_high_nok: result.totalHighNok,
        items: result.items,
        explanation: result.explanation,
      })
      .select("id")
      .single();

    if (estErr) throw estErr;

    return NextResponse.json({ lead_id: lead.id, estimate_id: est.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

