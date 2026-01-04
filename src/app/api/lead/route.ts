import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateEstimate, type EstimateInput } from "@/lib/pricing";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // kun server
);

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ SETT DENNE:
const TO_EMAIL = "frikk.midtsaeter@gmail.com";

function escapeHtml(value: any) {
  const s = String(value ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input: EstimateInput = body.input;
    const customer = body.customer ?? {};

    const result = calculateEstimate(input);

    // 1) Lagre lead
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

    // 2) Lagre estimate
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

    // 3) Send e-post (ikke la dette stoppe lagringen hvis Resend feiler)
    try {
      if (!process.env.RESEND_API_KEY) {
        console.warn("RESEND_API_KEY mangler i env, hopper over e-post.");
      } else if (!TO_EMAIL || TO_EMAIL.includes("DIN_EPOST")) {
        console.warn("TO_EMAIL er ikke satt riktig, hopper over e-post.");
      } else {
        const subject = `Nytt lead (${input.jobType}) – ${customer.name ?? "Ukjent"}`;

        const lines = [
          { k: "Lead ID", v: lead.id },
          { k: "Estimate ID", v: est.id },
          { k: "Navn", v: customer.name ?? "-" },
          { k: "Telefon", v: customer.phone ?? "-" },
          { k: "E-post", v: customer.email ?? "-" },
          { k: "Jobbtype", v: input.jobType },
          { k: "Arbeid", v: input.operation },
          { k: "Tilstand", v: input.condition },
          { k: "Veggareal (m²)", v: input.areaM2 },
          { k: "Fasadeflate (m²)", v: input.wallAreaM2 ?? "-" },
          { k: "Vinduer (stk)", v: input.windowsCount ?? 0 },
          { k: "Dører (stk)", v: input.doorsCount ?? 0 },
          { k: "Stillas", v: input.needsScaffold ? `Ja (${input.scaffoldWeeks ?? 1} uke)` : "Nei" },
          { k: "Materialer inkludert", v: input.includeMaterials ? "Ja" : "Nei" },
          { k: "Estimert pris", v: `${result.totalLowNok} – ${result.totalHighNok} kr` },
        ];

        const html = `
          <div style="font-family:Arial, sans-serif; line-height:1.4">
            <h2>Nytt lead fra kalkulator</h2>
            <p><strong>Estimert pris:</strong> ${escapeHtml(result.totalLowNok)} – ${escapeHtml(
          result.totalHighNok
        )} kr</p>

            <table cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; max-width:720px">
              ${lines
                .map(
                  (row) => `
                    <tr>
                      <td style="border:1px solid #ddd; width:220px; background:#f7f7f7"><strong>${escapeHtml(
                        row.k
                      )}</strong></td>
                      <td style="border:1px solid #ddd">${escapeHtml(row.v)}</td>
                    </tr>
                  `
                )
                .join("")}
            </table>

            <h3 style="margin-top:18px">Beregning</h3>
            <ul>
              ${result.items
                .map(
                  (it: any) =>
                    `<li>${escapeHtml(it.label)}: ${escapeHtml(it.qty)} × ${escapeHtml(
                      it.unitPrice
                    )} = ${escapeHtml(it.total)} kr</li>`
                )
                .join("")}
            </ul>
          </div>
        `;

        await resend.emails.send({
          // For testing kan denne brukes:
          from: "Midtsæter Risnes <onboarding@resend.dev>",
          to: [TO_EMAIL],
          subject,
          html,
        });
      }
    } catch (mailErr) {
      console.error("Resend feilet:", mailErr);
      // vi kaster ikke error her – lead/estimate er allerede lagret
    }

    // 4) Returner response
    return NextResponse.json({ lead_id: lead.id, estimate_id: est.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}


