"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  calculateEstimate,
  type EstimateInput,
  type JobType,
  type Operation,
  type Condition,
  type LineItem,
} from "@/lib/pricing";

function formatNok(n: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function EstimatePage() {
  const [jobType, setJobType] = useState<JobType>("interior");
  const [operation, setOperation] = useState<Operation>("paint_interior");

  // Areal = veggareal/fasadeflate (ikke gulvareal)
  const [areaM2, setAreaM2] = useState<number>(80);

  // Ekstra felt for utvendig (valgfritt) – brukes for stillasberegning
  const [wallAreaM2, setWallAreaM2] = useState<number>(80);

  const [condition, setCondition] = useState<Condition>("normal");

  // Listefritt (kun relevant for enkelte innvendige operasjoner)
  const [windowsCount, setWindowsCount] = useState<number>(0);
  const [doorsCount, setDoorsCount] = useState<number>(0);

  // Utvendig stillas
  const [needsScaffold, setNeedsScaffold] = useState<boolean>(false);

  // Materialer skal være standard PÅ
  const [includeMaterials, setIncludeMaterials] = useState<boolean>(true);

  // Kontaktinfo
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const isExterior = jobType === "exterior";

  // Listefrie vinduer/dører er kun relevant for: sparkling, sparkling + maling, helsparkling
  const showListFree =
    jobType === "interior" &&
    (operation === "spackle_only" ||
      operation === "spackle_and_paint" ||
      operation === "full_spackle");

  // Hold operation i sync med jobType (enkelt MVP)
  useEffect(() => {
    if (jobType === "exterior") setOperation("paint_exterior");
    if (jobType === "interior" && operation === "paint_exterior") {
      setOperation("paint_interior");
    }
  }, [jobType, operation]);

  // Nullstill listefritt når det ikke er relevant
  useEffect(() => {
    if (!showListFree) {
      setWindowsCount(0);
      setDoorsCount(0);
    }
  }, [showListFree]);

  const input: EstimateInput = useMemo(() => {
    const baseArea = Math.max(0, Number(areaM2) || 0);
    const exteriorWallArea = Math.max(0, Number(wallAreaM2) || 0);

    return {
      jobType,
      operation,

      // For enkelhet: areaM2 er alltid "veggareal/fasadeflate"
      areaM2: baseArea,

      // For stillas: bruk veggflate på utsiden (fallback til areaM2 hvis 0)
      wallAreaM2: isExterior ? (exteriorWallArea > 0 ? exteriorWallArea : baseArea) : undefined,

      condition,

      windowsCount: showListFree ? Math.max(0, Number(windowsCount) || 0) : 0,
      doorsCount: showListFree ? Math.max(0, Number(doorsCount) || 0) : 0,

      includeMaterials,

      needsScaffold: isExterior ? needsScaffold : false,
      scaffoldWeeks: 1,
    };
  }, [
    jobType,
    operation,
    areaM2,
    wallAreaM2,
    isExterior,
    condition,
    windowsCount,
    doorsCount,
    includeMaterials,
    needsScaffold,
    showListFree,
  ]);

  const result = useMemo(() => calculateEstimate(input), [input]);

  // Auto-height til Squarespace iframe når ?embed=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embed = params.get("embed") === "1";
    if (!embed) return;

    const send = () => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      window.parent?.postMessage({ type: "MR_IFRAME_HEIGHT", height: h }, "*");
    };

    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    window.addEventListener("load", send);

    return () => {
      ro.disconnect();
      window.removeEventListener("load", send);
    };
  }, [result.totalLowNok, result.totalHighNok, showListFree, isExterior]);

  async function submitLead() {
    if (!name.trim() || !phone.trim()) {
      alert("Fyll inn navn og mobilnummer, så kan vi kontakte deg.");
      return;
    }

    const payload = {
      input,
      customer: { name, phone, email },
    };

    const r = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      alert("Kunne ikke sende forespørsel. Prøv igjen.\n" + msg);
      return;
    }

    alert("Forespørsel sendt! Vi tar kontakt snart.");
  }

  const areaLabel = isExterior ? "Fasadeflate / veggareal (ca. m²)" : "Veggareal (ca. m²)";
  const areaHelp = isExterior
    ? "Tips: dette er veggflate på utsiden som skal males (ikke grunnflate/gulvareal)."
    : "Tips: dette er veggflate som skal behandles (ikke gulvareal).";

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Priskalkulator</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Svar på noen få spørsmål, så får du et prisintervall. Bestill befaring for fastpris.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Type jobb</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setJobType("interior")} style={btn(jobType === "interior")}>
              Innvendig
            </button>
            <button type="button" onClick={() => setJobType("exterior")} style={btn(jobType === "exterior")}>
              Utvendig
            </button>
          </div>
        </label>

        {/* ✅ Her er dropdown uten priser i parentes (kun navn) */}
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Type arbeid</div>

          {jobType === "interior" ? (
            <select value={operation} onChange={(e) => setOperation(e.target.value as any)} style={selectStyle}>
              <option value="paint_interior">Innvendig maling</option>
              <option value="spackle_only">Sparkling</option>
              <option value="spackle_and_paint">Sparkling + maling</option>
              <option value="full_spackle">Helsparkling</option>
            </select>
          ) : (
            <select value={operation} onChange={(e) => setOperation(e.target.value as any)} style={selectStyle}>
              <option value="paint_exterior">Utvendig maling</option>
            </select>
          )}

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Pris beregnes automatisk basert på valgt arbeid og areal.
          </div>
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{areaLabel}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: -2, marginBottom: 6 }}>{areaHelp}</div>

          <input inputMode="numeric" value={areaM2} onChange={(e) => setAreaM2(Number(e.target.value))} style={inputStyle} />

          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setAreaM2(80)} style={chipStyle}>
              Liten (80 m2 veggareal)
            </button>
            <button type="button" onClick={() => setAreaM2(140)} style={chipStyle}>
              Medium (140 m2 veggareal)
            </button>
            <button type="button" onClick={() => setAreaM2(220)} style={chipStyle}>
              Stor (220 m2 veggareal)
            </button>
          </div>
        </label>

        {jobType === "exterior" && (
          <label>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Fasadeflate for stillas (m² vegg)</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: -2, marginBottom: 6 }}>
              Bruk ca. veggflate som skal ha stillas. Hvis du er usikker, bruk samme som fasadeflate over.
            </div>
            <input
              inputMode="numeric"
              value={wallAreaM2}
              onChange={(e) => setWallAreaM2(Number(e.target.value))}
              style={inputStyle}
            />
          </label>
        )}

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Tilstand</div>
          <select value={condition} onChange={(e) => setCondition(e.target.value as Condition)} style={selectStyle}>
            <option value="good">God</option>
            <option value="normal">Normal</option>
            <option value="bad">Dårlig (mer forarbeid)</option>
          </select>
        </label>

        {showListFree && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Vindu listefritt (stk)</div>
              <input
                inputMode="numeric"
                value={windowsCount}
                onChange={(e) => setWindowsCount(Number(e.target.value))}
                style={inputStyle}
              />
            </label>

            <label>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Dør listefritt (stk)</div>
              <input
                inputMode="numeric"
                value={doorsCount}
                onChange={(e) => setDoorsCount(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
          </div>
        )}

        {jobType === "exterior" && (
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={needsScaffold} onChange={(e) => setNeedsScaffold(e.target.checked)} />
            <span>
              <b>Trenger stillas</b> (beregnes automatisk)
            </span>
          </label>
        )}

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={includeMaterials} onChange={(e) => setIncludeMaterials(e.target.checked)} />
          <span>Inkluder materialer (estimert)</span>
        </label>

        <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Ca. pris</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
            {formatNok(result.totalLowNok)} – {formatNok(result.totalHighNok)}
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Beregning</div>

            {/* ✅ HER er endringen du ønsket: kun antall, ingen pris */}
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {result.items.map((it: LineItem) => (
                <li key={it.code + it.name}>
                  {it.name}: {Math.round(it.qty)} {it.unit}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            {result.explanation.map((t: string, idx: number) => (
              <div key={idx}>• {t}</div>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Send forespørsel</div>

          <label>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Navn</div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Ditt navn" />
          </label>

          <label>
            <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 10 }}>Mobil</div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
              placeholder="Mobilnummer"
            />
          </label>

          <label>
            <div style={{ fontWeight: 600, marginBottom: 6, marginTop: 10 }}>E-post (valgfritt)</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="navn@epost.no"
            />
          </label>

          <button type="button" onClick={submitLead} style={{ ...primaryCta, width: "100%", marginTop: 12 }}>
            Send forespørsel
          </button>

          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
            Ved innsending samtykker du til at vi kan kontakte deg om forespørselen.
          </div>
        </div>
      </div>
    </div>
  );
}

function btn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: active ? "rgba(0,0,0,0.08)" : "white",
    fontWeight: 700,
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  fontSize: 16,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  background: "white",
};

const chipStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  fontWeight: 700,
};

const primaryCta: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "black",
  color: "white",
  fontWeight: 800,
};

