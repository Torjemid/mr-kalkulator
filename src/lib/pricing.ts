export type Unit = "m2" | "stk" | "lm" | "fixed";

export type PriceItem = {
  code: string;
  name: string;
  category: "work" | "material" | "rental" | "addon";
  unit: Unit;
  unitPriceNok: number;
  tags?: string[];
};

export const PRICE_ITEMS: Record<string, PriceItem> = {
  "work.sparking_og_maling": { code: "work.sparking_og_maling", name: "Sparkling + maling", category: "work", unit: "m2", unitPriceNok: 290, tags: ["interior"] },
  "work.sparking":           { code: "work.sparking",           name: "Sparkling",         category: "work", unit: "m2", unitPriceNok: 240, tags: ["interior"] },
  "work.helsparkling":       { code: "work.helsparkling",       name: "Helsparkling",      category: "work", unit: "m2", unitPriceNok: 548, tags: ["interior"] },
  "work.innvendig_maling":   { code: "work.innvendig_maling",   name: "Innvendig maling",  category: "work", unit: "m2", unitPriceNok: 150, tags: ["interior"] },
  "work.utvendig_maling":    { code: "work.utvendig_maling",    name: "Utvendig maling",   category: "work", unit: "m2", unitPriceNok: 350, tags: ["exterior"] },

  "work.vindu_listefritt":   { code: "work.vindu_listefritt",   name: "Vindu listefritt",  category: "work", unit: "stk", unitPriceNok: 800 },
  "work.dor_listefritt":     { code: "work.dor_listefritt",     name: "Dør listefritt",    category: "work", unit: "stk", unitPriceNok: 550 },

  "rental.stillas_m2_week":  { code: "rental.stillas_m2_week",  name: "Stillas leie (85 kr per m² vegg per uke)", category: "rental", unit: "m2", unitPriceNok: 85, tags: ["exterior"] },

  "addon.helsparkling":      { code: "addon.helsparkling",      name: "Tilvalg helsparkling", category: "addon", unit: "m2", unitPriceNok: 80 },
};

export type Condition = "good" | "normal" | "bad";
export type JobType = "interior" | "exterior";

export type Operation =
  | "paint_interior"
  | "spackle_only"
  | "spackle_and_paint"
  | "full_spackle"
  | "paint_exterior";

export type EstimateInput = {
  jobType: JobType;
  operation: Operation;

  areaM2: number;
  wallAreaM2?: number;
  windowsCount?: number;
  doorsCount?: number;

  condition: Condition;

  includeMaterials?: boolean;

  needsScaffold?: boolean;
  scaffoldWeeks?: number; // default 1
};

export type LineItem = {
  code: string;
  name: string;
  unit: Unit;
  qty: number;
  unitPriceNok: number;
  subtotalNok: number;
};

export type EstimateResult = {
  items: LineItem[];
  baseSubtotalNok: number;
  totalLowNok: number;
  totalHighNok: number;
  explanation: string[];
};

const CONDITION_MULTIPLIER: Record<Condition, { low: number; high: number }> = {
  good:   { low: 0.95, high: 1.05 },
  normal: { low: 1.00, high: 1.15 },
  bad:    { low: 1.10, high: 1.35 },
};

const MATERIAL_MARKUP: Record<JobType, { low: number; high: number }> = {
  interior: { low: 0.10, high: 0.15 },
  exterior: { low: 0.12, high: 0.20 },
};

const MIN_PRICE_NOK = 4000;

function addItem(items: LineItem[], code: string, qty: number, nameOverride?: string) {
  if (!qty || qty <= 0) return;
  const p = PRICE_ITEMS[code];
  if (!p) throw new Error(`Unknown price item: ${code}`);
  items.push({
    code: p.code,
    name: nameOverride ?? p.name,
    unit: p.unit,
    qty,
    unitPriceNok: p.unitPriceNok,
    subtotalNok: Math.round(qty * p.unitPriceNok),
  });
}

function getScaffoldWeeks(input: EstimateInput): { low: number; high: number } {
  const base = input.scaffoldWeeks ?? 1;
  let low = base;
  let high = base;

  const wallArea = input.wallAreaM2 ?? input.areaM2;
  if (input.condition === "bad") high = Math.max(high, 2);
  if (wallArea >= 200) high = Math.max(high, 2);

  low = Math.max(1, Math.round(low));
  high = Math.max(low, Math.round(high));
  return { low, high };
}

function operationToMainWorkCode(op: Operation): string {
  switch (op) {
    case "paint_interior":     return "work.innvendig_maling";
    case "spackle_only":       return "work.sparking";
    case "spackle_and_paint":  return "work.sparking_og_maling";
    case "full_spackle":       return "work.helsparkling";
    case "paint_exterior":     return "work.utvendig_maling";
  }
}

export function calculateEstimate(input: EstimateInput): EstimateResult {
  const area = Math.max(0, Number(input.areaM2) || 0);
  const windows = Math.max(0, Number(input.windowsCount ?? 0) || 0);
  const doors = Math.max(0, Number(input.doorsCount ?? 0) || 0);

  const items: LineItem[] = [];

  const mainCode = operationToMainWorkCode(input.operation);
  addItem(items, mainCode, area);

  addItem(items, "work.vindu_listefritt", windows);
  addItem(items, "work.dor_listefritt", doors);

  if (input.jobType === "exterior" && input.needsScaffold) {
    const wallArea = Math.max(0, Number(input.wallAreaM2 ?? input.areaM2) || 0);
    const weeks = getScaffoldWeeks(input);

    addItem(items, "rental.stillas_m2_week", wallArea * weeks.low, `Stillas (85 kr/m²/uke) – ${weeks.low} uke`);
    if (weeks.high > weeks.low) {
      addItem(items, "rental.stillas_m2_week", wallArea * (weeks.high - weeks.low), `Stillas (85 kr/m²/uke) – ekstra ${weeks.high - weeks.low} uke`);
    }
  }

  const baseSubtotal = items.reduce((sum, it) => sum + it.subtotalNok, 0);

  const mult = CONDITION_MULTIPLIER[input.condition];
  let low = Math.round(baseSubtotal * mult.low);
  let high = Math.round(baseSubtotal * mult.high);

  const expl: string[] = [];
  if (input.includeMaterials) {
    const mm = MATERIAL_MARKUP[input.jobType];
    low += Math.round(low * mm.low);
    high += Math.round(high * mm.high);
    expl.push(`Materialer estimert som ${Math.round(mm.low * 100)}–${Math.round(mm.high * 100)}% av sum.`);
  }

  if (low < MIN_PRICE_NOK) low = MIN_PRICE_NOK;
  if (high < MIN_PRICE_NOK) high = MIN_PRICE_NOK;

  expl.unshift("Pris er et estimat (intervall) basert på areal, valg og tilstand. Befaring kan gi fastpris.");
  if (input.jobType === "exterior" && input.needsScaffold) {
    expl.push("Stillas beregnes som 85 kr per m² vegg per uke (vanligvis 1 uke, ved større jobb/tilstand kan det bli 2).");
  }

  return { items, baseSubtotalNok: baseSubtotal, totalLowNok: low, totalHighNok: high, explanation: expl };
}





