import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, AreaChart, Area
} from "recharts";

// ── Storage ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "laufanalyse_v3";
async function loadWorkouts() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function saveWorkouts(ws) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ws)); } catch {}
}

// ── Body Metrics Storage ───────────────────────────────────────────────────────
const METRICS_KEY = "laufanalyse_metrics_v1";
async function loadMetrics() {
  try { const raw = localStorage.getItem(METRICS_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function saveMetrics(ms) {
  try { localStorage.setItem(METRICS_KEY, JSON.stringify(ms)); } catch {}
}

// ── Constants ──────────────────────────────────────────────────────────────────
const HRZ = [
  { label: "Z1", key: "z1", color: "#60efff", min: 0,   max: 113, name: "Regeneration" },
  { label: "Z2", key: "z2", color: "#4ade80", min: 114, max: 133, name: "Grundlage" },
  { label: "Z3", key: "z3", color: "#facc15", min: 134, max: 152, name: "Aerob" },
  { label: "Z4", key: "z4", color: "#fb923c", min: 153, max: 171, name: "Schwelle" },
  { label: "Z5", key: "z5", color: "#f43f5e", min: 172, max: 999, name: "VO2max" },
];

// Pace-Zonen (Strava SAT — basierend auf Patrick's Profil)
const PACEZ = [
  { label: "Z1", key: "pz1", color: "#60efff", name: "Regeneration", range: "> 8:34" },
  { label: "Z2", key: "pz2", color: "#4ade80", name: "Ausdauer",     range: "7:23–8:34" },
  { label: "Z3", key: "pz3", color: "#facc15", name: "Tempo",        range: "6:37–7:23" },
  { label: "Z4", key: "pz4", color: "#fb923c", name: "Schwelle",     range: "6:12–6:37" },
  { label: "Z5", key: "pz5", color: "#f43f5e", name: "VO2 Max",      range: "5:50–6:12" },
  { label: "Z6", key: "pz6", color: "#c084fc", name: "Anaerob",      range: "< 5:50" },
];
const TYPE_GROUPS = [
  { group: "🏃 Laufen",      types: ["Easy Run", "Long Run", "Tempo", "Intervall", "Progression Run", "Music Run", "HIIT Run", "Walking", "Recovery"] },
  { group: "🚴 Bike / Bike+", types: ["Cycling", "Power Zone", "Power Zone Endurance", "Power Zone Max", "HIIT & Hills", "Climb", "Intervals (Bike)", "Tabata", "Low Impact", "Beginner Ride", "Groove", "Theme Ride"] },
  { group: "🏃 Tread",        types: ["Tread Running", "Tread Walking", "Bootcamp (Tread)", "Intervals (Tread)"] },
  { group: "💪 Strength",     types: ["Full Body", "Upper Body", "Lower Body", "Core", "Glutes & Legs", "Arms & Shoulders", "Bootcamp (Floor)"] },
  { group: "🧘 Mind & Body",  types: ["Yoga", "Pilates", "Barre", "Stretching", "Meditation", "Foam Rolling"] },
  { group: "🚣 Row",          types: ["Rowing", "Intervals (Row)", "Bootcamp (Row)"] },
];
const TYPES = TYPE_GROUPS.flatMap(g => g.types);

const PELOTON_INSTRUCTORS = [
  "Mayla Wedekind", "Becs Gentry", "Ben Parker", "Susie Chan",
  "Matt Wilpers", "Denis Morton", "Emma Lovewell", "Ally Love",
  "Alex Toussaint", "Robin Arzón", "Cody Rigsby", "Leanne Hainsby",
  "Jess Sims", "Adrian Williams", "Andy Speer", "Hannah Corbin",
  "Olivia Amato", "Sam Yo", "Tunde Oyeneyin", "Kendall Toole",
  "Christine D'Ercole", "Kirra Michel", "Rad Lopez", "Marcel Dinkins",
  "Andere / Kein Instructor",
];

const TYPE_COLOR = {
  "Easy Run": "#4ade80", "Long Run": "#60efff", "Tempo": "#facc15",
  "Intervall": "#f43f5e", "Progression Run": "#4ade80", "Music Run": "#a78bfa",
  "HIIT Run": "#f43f5e", "Walking": "#4ade80", "Recovery": "#5a6480",
  "Cycling": "#a78bfa", "Power Zone": "#a78bfa", "Power Zone Endurance": "#a78bfa",
  "Power Zone Max": "#f43f5e", "HIIT & Hills": "#f43f5e", "Climb": "#fb923c",
  "Intervals (Bike)": "#f43f5e", "Tabata": "#f43f5e", "Low Impact": "#60efff",
  "Beginner Ride": "#4ade80", "Groove": "#facc15", "Theme Ride": "#a78bfa",
  "Tread Running": "#4ade80", "Tread Walking": "#60efff", "Bootcamp (Tread)": "#fb923c",
  "Intervals (Tread)": "#f43f5e", "Full Body": "#fb923c", "Upper Body": "#fb923c",
  "Lower Body": "#fb923c", "Core": "#fb923c", "Glutes & Legs": "#fb923c",
  "Arms & Shoulders": "#fb923c", "Bootcamp (Floor)": "#f43f5e",
  "Yoga": "#60efff", "Pilates": "#60efff", "Barre": "#60efff",
  "Stretching": "#4ade80", "Meditation": "#60efff", "Foam Rolling": "#4a5475",
  "Rowing": "#a78bfa", "Intervals (Row)": "#f43f5e", "Bootcamp (Row)": "#fb923c",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function paceToSecs(s) {
  if (!s || !s.includes(":")) return null;
  const [m, sec] = s.split(":").map(Number);
  return m * 60 + (sec || 0);
}
function secsToMmSs(s) {
  if (!s && s !== 0) return "—";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}
function fmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtShort(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function getMondayKey(d) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - ((dt.getDay() || 7) - 1));
  return dt.toISOString().slice(0, 10);
}
function getMonthKey(d) { return d.slice(0, 7); }
function getYearKey(d) { return d.slice(0, 4); }
function haversineKm(la1, lo1, la2, lo2) {
  const R = 6371, dL = (la2 - la1) * Math.PI / 180, dO = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dL/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function buildPeriodRows(workouts, keyFn) {
  const map = {};
  workouts.forEach(w => {
    const k = keyFn(w.date || "");
    if (!map[k]) map[k] = { key: k, km: 0, count: 0, minutes: 0, hrSum: 0, hrCount: 0, paceSum: 0, paceCount: 0 };
    const r = map[k];
    r.km += parseFloat(w.distance) || 0;
    r.count++;
    r.minutes += parseFloat(w.duration) || 0;
    if (w.avgHr) { r.hrSum += parseFloat(w.avgHr); r.hrCount++; }
    const ps = paceToSecs(w.avgPace);
    if (ps) { r.paceSum += ps; r.paceCount++; }
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).map(r => ({
    ...r,
    km: parseFloat(r.km.toFixed(2)),
    avgHr: r.hrCount ? Math.round(r.hrSum / r.hrCount) : null,
    avgPace: r.paceCount ? secsToMmSs(r.paceSum / r.paceCount) : null,
  }));
}
function periodLabel(key, mode) {
  if (mode === "week") {
    const e = new Date(key); e.setDate(e.getDate() + 6);
    return `${new Date(key).toLocaleDateString("de-DE",{day:"2-digit",month:"short"})}–${e.toLocaleDateString("de-DE",{day:"2-digit",month:"short"})}`;
  }
  if (mode === "month") {
    const [y, m] = key.split("-");
    return new Date(y, m - 1).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
  }
  return key;
}

// ── GPX Parser ─────────────────────────────────────────────────────────────────
function parseGPX(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const firstTime = doc.querySelector("trkpt time");
  const timeMeta = doc.querySelector("metadata time");
  const rawTime = timeMeta?.textContent || firstTime?.textContent;
  const dateStr = rawTime ? rawTime.slice(0, 10) : "";
  const nameEl = doc.querySelector("trk name");
  const trkName = nameEl?.textContent?.toLowerCase() || "";
  let type = "Easy Run";
  if (trkName.includes("long")) type = "Long Run";
  else if (trkName.includes("tempo") || trkName.includes("threshold")) type = "Tempo";
  else if (trkName.includes("interval")) type = "Intervall";
  else if (trkName.includes("recovery")) type = "Recovery";
  const pts = Array.from(doc.querySelectorAll("trkpt"));
  if (pts.length < 2) return null;
  let distKm = 0, eleUp = 0, eleDown = 0, prevEle = null;
  const hrVals = [];
  pts.forEach((pt, i) => {
    if (i > 0) {
      const p = pts[i - 1];
      const la1 = parseFloat(p.getAttribute("lat")), lo1 = parseFloat(p.getAttribute("lon"));
      const la2 = parseFloat(pt.getAttribute("lat")), lo2 = parseFloat(pt.getAttribute("lon"));
      if (!isNaN(la1) && !isNaN(la2)) distKm += haversineKm(la1, lo1, la2, lo2);
    }
    const hrEl = pt.querySelector("hr") || pt.getElementsByTagNameNS("*", "hr")[0];
    if (hrEl) { const v = parseInt(hrEl.textContent); if (!isNaN(v) && v > 30 && v < 250) hrVals.push(v); }
    const eleEl = pt.querySelector("ele");
    if (eleEl) {
      const e = parseFloat(eleEl.textContent);
      if (!isNaN(e)) {
        if (prevEle !== null) { const d = e - prevEle; if (d > 0.5) eleUp += d; else if (d < -0.5) eleDown += Math.abs(d); }
        prevEle = e;
      }
    }
  });
  const allTimes = Array.from(doc.querySelectorAll("trkpt time"));
  const lastTime = allTimes[allTimes.length - 1];
  let durationMin = "";
  if (firstTime && lastTime) {
    durationMin = Math.round((new Date(lastTime.textContent) - new Date(firstTime.textContent)) / 60000);
  }
  const avgPace = distKm > 0 && durationMin ? secsToMmSs((durationMin * 60) / distKm) : "";
  let avgHr = "";
  const zones = { z1: "", z2: "", z3: "", z4: "", z5: "" };
  if (hrVals.length > 0) {
    avgHr = String(Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length));
    const counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    hrVals.forEach(hr => { const z = HRZ.find(z => hr >= z.min && hr <= z.max); if (z) counts[z.key]++; });
    HRZ.forEach(z => { zones[z.key] = Math.round((counts[z.key] / hrVals.length) * 100); });
  }
  return { date: dateStr, type, distance: distKm > 0 ? distKm.toFixed(2) : "", duration: durationMin ? String(durationMin) : "", avgPace, avgHr, eleUp: eleUp > 0 ? Math.round(eleUp) : "", eleDown: eleDown > 0 ? Math.round(eleDown) : "", ...zones, notes: nameEl?.textContent || "" };
}

// ── TCX Parser ─────────────────────────────────────────────────────────────────
function parseTCX(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  // Name / type
  const nameEl = doc.querySelector("Activity Notes") || doc.querySelector("Lap Notes");
  const trkName = nameEl?.textContent?.toLowerCase() || "";
  let type = "Easy Run";
  if (trkName.includes("long")) type = "Long Run";
  else if (trkName.includes("tempo") || trkName.includes("threshold")) type = "Tempo";
  else if (trkName.includes("interval")) type = "Intervall";
  else if (trkName.includes("recovery")) type = "Recovery";

  // Date from first Lap StartTime or Id
  const idEl = doc.querySelector("Activity > Id");
  const lapEl = doc.querySelector("Lap");
  const rawTime = idEl?.textContent || lapEl?.getAttribute("StartTime") || "";
  const dateStr = rawTime ? rawTime.slice(0, 10) : "";

  // Trackpoints
  const pts = Array.from(doc.querySelectorAll("Trackpoint"));
  if (pts.length < 2) return null;

  let distKm = 0, eleUp = 0, eleDown = 0, prevEle = null;
  const hrVals = [];
  const times = [];

  pts.forEach((pt, i) => {
    const hrEl = pt.querySelector("HeartRateBpm Value") || pt.querySelector("HeartRateBpm");
    if (hrEl) { const v = parseInt(hrEl.textContent); if (!isNaN(v) && v > 30 && v < 250) hrVals.push(v); }
    const timeEl = pt.querySelector("Time");
    if (timeEl) times.push(new Date(timeEl.textContent));
    const altEl = pt.querySelector("AltitudeMeters");
    if (altEl) {
      const e = parseFloat(altEl.textContent);
      if (!isNaN(e)) {
        if (prevEle !== null) { const d = e - prevEle; if (d > 0.5) eleUp += d; else if (d < -0.5) eleDown += Math.abs(d); }
        prevEle = e;
      }
    }
    if (i > 0) {
      const prev = pts[i - 1];
      const la1 = parseFloat(prev.querySelector("LatitudeDegrees")?.textContent);
      const lo1 = parseFloat(prev.querySelector("LongitudeDegrees")?.textContent);
      const la2 = parseFloat(pt.querySelector("LatitudeDegrees")?.textContent);
      const lo2 = parseFloat(pt.querySelector("LongitudeDegrees")?.textContent);
      if (!isNaN(la1) && !isNaN(la2)) distKm += haversineKm(la1, lo1, la2, lo2);
    }
  });

  // Try to get total distance from last DistanceMeters if GPS failed
  if (distKm < 0.1) {
    const lastDist = Array.from(doc.querySelectorAll("Trackpoint DistanceMeters")).at(-1);
    if (lastDist) distKm = parseFloat(lastDist.textContent) / 1000;
  }

  // Duration
  let durationMin = "";
  if (times.length >= 2) {
    durationMin = Math.round((times[times.length - 1] - times[0]) / 60000);
  }
  // Fallback: sum Lap TotalTimeSeconds
  if (!durationMin) {
    const lapSecs = Array.from(doc.querySelectorAll("Lap TotalTimeSeconds"))
      .reduce((a, el) => a + (parseFloat(el.textContent) || 0), 0);
    if (lapSecs > 0) durationMin = Math.round(lapSecs / 60);
  }

  const avgPace = distKm > 0 && durationMin ? secsToMmSs((durationMin * 60) / distKm) : "";

  let avgHr = "";
  const zones = { z1: "", z2: "", z3: "", z4: "", z5: "" };
  if (hrVals.length > 0) {
    avgHr = String(Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length));
    const counts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    hrVals.forEach(hr => { const z = HRZ.find(z => hr >= z.min && hr <= z.max); if (z) counts[z.key]++; });
    HRZ.forEach(z => { zones[z.key] = Math.round((counts[z.key] / hrVals.length) * 100); });
  }

  return { date: dateStr, type, distance: distKm > 0 ? distKm.toFixed(2) : "", duration: durationMin ? String(durationMin) : "", avgPace, avgHr, eleUp: eleUp > 0 ? Math.round(eleUp) : "", eleDown: eleDown > 0 ? Math.round(eleDown) : "", ...zones, notes: nameEl?.textContent || "" };
}

function parseFile(file, xmlText) {
  if (file.name.endsWith(".tcx")) return parseTCX(xmlText);
  return parseGPX(xmlText);
}

// ── UI Atoms ───────────────────────────────────────────────────────────────────
function Tag({ color, children }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  );
}

function KpiCard({ label, value, sub, accent = "#e8eaf6", border }) {
  return (
    <div style={{ background: "#0c0f1d", border: `1px solid ${border || "#1a1f35"}`, borderRadius: 12, padding: "14px 18px" }}>
      <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent, fontFamily: "'DM Mono',monospace", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#4a5475", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ZoneBar({ workout, height = 8 }) {
  const has = HRZ.some(z => Number(workout[z.key]) > 0);
  if (!has) return null;
  return (
    <div style={{ display: "flex", height, borderRadius: 4, overflow: "hidden" }}>
      {HRZ.map(z => Number(workout[z.key]) > 0 && (
        <div key={z.key} style={{ width: `${workout[z.key]}%`, background: z.color }} title={`${z.label}: ${workout[z.key]}%`} />
      ))}
    </div>
  );
}

// ── GPX Drop Zone ──────────────────────────────────────────────────────────────
function GpxDropZone({ onParsed }) {
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState("");
  const ref = useRef();
  function process(file) {
    if (!file || (!file.name.endsWith(".gpx") && !file.name.endsWith(".tcx"))) {
      setStatus("err"); setMsg("Bitte .gpx oder .tcx Datei wählen."); return;
    }
    const r = new FileReader();
    r.onload = e => {
      const res = parseFile(file, e.target.result);
      if (!res) { setStatus("err"); setMsg("Datei konnte nicht gelesen werden."); return; }
      setStatus("ok");
      setMsg(`✓ ${file.name} — ${res.distance} km${res.avgHr ? `, Ø ${res.avgHr} bpm` : ""}`);
      onParsed(res);
    };
    r.readAsText(file);
  }
  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); process(e.dataTransfer.files[0]); }}
        onClick={() => ref.current.click()}
        style={{ border: `2px dashed ${drag ? "#4ade80" : "#1e2436"}`, borderRadius: 12, padding: "22px 20px", textAlign: "center", cursor: "pointer", background: drag ? "#4ade8008" : "transparent" }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
        <div style={{ fontSize: 13, color: "#8a9ab5" }}>GPX oder TCX Datei ablegen oder klicken</div>
        <div style={{ fontSize: 11, color: "#3a4460", marginTop: 4 }}>Strava: Aktivität → „…" → „Exportieren als GPX" oder „Exportieren als TCX"</div>
        <input ref={ref} type="file" accept=".gpx,.tcx" style={{ display: "none" }} onChange={e => process(e.target.files[0])} />
      </div>
      {status && (
        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12, background: status === "ok" ? "#4ade8011" : "#f43f5e11", border: `1px solid ${status === "ok" ? "#4ade8044" : "#f43f5e44"}`, color: status === "ok" ? "#4ade80" : "#f43f5e" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// ── Workout Form ───────────────────────────────────────────────────────────────
const EMPTY = { date: new Date().toISOString().slice(0, 10), type: "Easy Run", instructor: "", watt: "", distance: "", duration: "", avgPace: "", avgHr: "", eleUp: "", eleDown: "", calories: "", mood: "", z1: "", z2: "", z3: "", z4: "", z5: "", pz1: "", pz2: "", pz3: "", pz4: "", pz5: "", pz6: "", notes: "" };
const MOODS = ["😴","😐","🙂","💪","🔥"];
const MOOD_LABELS = ["Müde","Okay","Gut","Stark","Feuer"];

function Inp({ k, ph, type = "text", form, set }) {
  return (
    <input type={type} placeholder={ph} value={form[k] ?? ""} onChange={e => set(k, e.target.value)}
      style={{ background: "#070a14", border: "1px solid #1e2436", borderRadius: 7, padding: "9px 12px", color: "#e8eaf6", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit" }} />
  );
}

function WorkoutForm({ onSave, onCancel, initial }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [tab, setTab] = useState(initial ? "manual" : "gpx");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const zTotal = ["z1","z2","z3","z4","z5"].reduce((a, k) => a + (Number(form[k]) || 0), 0);

  return (
    <div style={{ background: "#0c0f1d", border: "1px solid #1e2436", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {!initial && (
        <div style={{ display: "flex", gap: 4, background: "#070a14", borderRadius: 8, padding: 4 }}>
          {[["gpx","📂 Strava GPX"],["manual","✏️ Manuell"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ flex: 1, background: tab === k ? "#1a1f35" : "transparent", border: "none", borderRadius: 6, color: tab === k ? "#e8eaf6" : "#5a6480", padding: "8px 0", cursor: "pointer", fontSize: 12, fontWeight: tab === k ? 700 : 400 }}>
              {l}
            </button>
          ))}
        </div>
      )}
      {tab === "gpx" && !initial && (
        <GpxDropZone onParsed={d => { setForm(f => ({ ...f, ...d })); setTab("manual"); }} />
      )}
      {tab === "manual" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp k="date" ph="Datum" type="date" form={form} set={set} />
            <select value={form.type} onChange={e => set("type", e.target.value)}
              style={{ background: "#070a14", border: "1px solid #1e2436", borderRadius: 7, padding: "9px 12px", color: "#e8eaf6", fontSize: 13, outline: "none" }}>
              {TYPE_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.types.map(t => <option key={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#a78bfa", marginBottom: 4, letterSpacing: 1 }}>👤 INSTRUCTOR</div>
              <select value={form.instructor} onChange={e => set("instructor", e.target.value)}
                style={{ background: "#070a14", border: "1px solid #a78bfa44", borderRadius: 7, padding: "9px 12px", color: form.instructor ? "#e8eaf6" : "#4a5475", fontSize: 13, outline: "none", width: "100%" }}>
                <option value="">— Kein Instructor —</option>
                {PELOTON_INSTRUCTORS.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#facc15", marginBottom: 4, letterSpacing: 1 }}>⚡ OUTPUT (kJ) / Ø WATT</div>
              <Inp k="watt" ph="z.B. 180 W oder 320 kJ" form={form} set={set} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <Inp k="distance" ph="km" form={form} set={set} />
            <Inp k="duration" ph="Dauer min" form={form} set={set} />
            <Inp k="avgPace" ph="Pace mm:ss" form={form} set={set} />
            <Inp k="avgHr" ph="Ø HF bpm" form={form} set={set} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#4ade80", marginBottom: 4, letterSpacing: 1 }}>↑ AUFSTIEG (m)</div>
              <Inp k="eleUp" ph="Höhenmeter ↑" form={form} set={set} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#60efff", marginBottom: 4, letterSpacing: 1 }}>↓ ABSTIEG (m)</div>
              <Inp k="eleDown" ph="Höhenmeter ↓" form={form} set={set} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#f97316", marginBottom: 4, letterSpacing: 1 }}>🔥 KALORIEN (kcal)</div>
              <Inp k="calories" ph="kcal" form={form} set={set} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>HF-Zonen %</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
              {HRZ.map(z => (
                <div key={z.key}>
                  <div style={{ fontSize: 10, color: z.color, marginBottom: 3 }}>{z.label}</div>
                  <input type="number" placeholder="%" min={0} max={100} value={form[z.key]} onChange={e => set(z.key, e.target.value)}
                    style={{ background: "#070a14", border: `1px solid ${z.color}44`, borderRadius: 7, padding: "7px 10px", color: "#e8eaf6", fontSize: 13, width: "100%", outline: "none", fontFamily: "'DM Mono',monospace" }} />
                </div>
              ))}
            </div>
            {zTotal > 0 && Math.abs(zTotal - 100) >= 1 && (
              <div style={{ color: "#f43f5e", fontSize: 11, marginTop: 4 }}>Zonen = {zTotal}% (Ziel: 100%)</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>Tempo-Zonen % <span style={{ color: "#2a3a50", fontWeight: 400, fontSize: 9 }}>(Strava SAT)</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
              {PACEZ.map(z => (
                <div key={z.key}>
                  <div style={{ fontSize: 9, color: z.color, marginBottom: 2 }}>{z.label} {z.name}</div>
                  <div style={{ fontSize: 8, color: "#3a4460", marginBottom: 3 }}>{z.range}</div>
                  <input type="number" placeholder="%" min={0} max={100} value={form[z.key] ?? ""} onChange={e => set(z.key, e.target.value)}
                    style={{ background: "#070a14", border: `1px solid ${z.color}44`, borderRadius: 7, padding: "7px 6px", color: "#e8eaf6", fontSize: 12, width: "100%", outline: "none" }} />
                </div>
              ))}
            </div>
            {(() => { const t = PACEZ.reduce((a,z)=>a+(Number(form[z.key])||0),0); return t>0&&Math.abs(t-100)>=1?<div style={{color:"#f43f5e",fontSize:11,marginTop:4}}>Tempo-Zonen = {t}% (Ziel: 100%)</div>:null; })()}
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>Wie war das Training?</div>
            <div style={{ display: "flex", gap: 8 }}>
              {MOODS.map((emoji, i) => (
                <button key={emoji} onClick={() => set("mood", emoji)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: form.mood === emoji ? `2px solid #4ade80` : "1px solid #1e2436", background: form.mood === emoji ? "#4ade8015" : "#070a14", cursor: "pointer", fontSize: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span>{emoji}</span>
                  <span style={{ fontSize: 9, color: form.mood === emoji ? "#4ade80" : "#4a5475" }}>{MOOD_LABELS[i]}</span>
                </button>
              ))}
            </div>
          </div>
          <textarea placeholder="Notizen…" value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
            style={{ background: "#070a14", border: "1px solid #1e2436", borderRadius: 7, padding: "9px 12px", color: "#e8eaf6", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
        </>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ background: "transparent", border: "1px solid #1e2436", borderRadius: 7, color: "#5a6480", padding: "9px 20px", cursor: "pointer", fontSize: 13 }}>Abbrechen</button>
        {tab === "manual" && (
          <button onClick={() => { if (!form.date || !form.distance) return; onSave({ ...form, id: initial?.id || Date.now() }); }}
            style={{ background: "#4ade80", border: "none", borderRadius: 7, color: "#050810", padding: "9px 22px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
            Speichern
          </button>
        )}
      </div>
    </div>
  );
}

// ── Workout List ───────────────────────────────────────────────────────────────
function WorkoutList({ workouts, onAdd, onEdit, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  const sorted = [...workouts].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase" }}>{workouts.length} Einheiten</div>
        <button onClick={onAdd} style={{ background: "#4ade80", border: "none", borderRadius: 8, color: "#050810", padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>+ Einheit</button>
      </div>
      {workouts.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#2a3050", fontSize: 14 }}>Noch keine Einheiten — GPX importieren oder manuell eintragen!</div>
      )}
      {sorted.map(w => {
        const z2pct = Number(w.z2) || 0;
        const zHas = HRZ.some(z => Number(w[z.key]) > 0);
        const isCfm = confirmId === w.id;
        return (
          <div key={w.id} style={{ background: "#0c0f1d", border: `1px solid ${isCfm ? "#f43f5e44" : "#1a1f35"}`, borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLOR[w.type] || "#5a6480", flexShrink: 0 }} />
                <span style={{ color: "#e8eaf6", fontWeight: 700, fontSize: 15 }}>{w.type}</span>
                <Tag color="#60efff">{fmt(w.date)}</Tag>
                {w.instructor && <Tag color="#a78bfa">👤 {w.instructor}</Tag>}
                {w.distance && <Tag color="#a78bfa">{w.distance} km</Tag>}
                {w.avgPace && <Tag color="#facc15">Ø {w.avgPace} /km</Tag>}
                {w.watt && <Tag color="#facc15">⚡ {w.watt}</Tag>}
                {w.avgHr && <Tag color="#fb923c">Ø {w.avgHr} bpm</Tag>}
                {w.duration && <Tag color="#4a5475">{w.duration} min</Tag>}
                {w.eleUp && <Tag color="#4ade80">↑ {w.eleUp}m</Tag>}
                {w.eleDown && <Tag color="#60efff">↓ {w.eleDown}m</Tag>}
                {w.calories && <Tag color="#f97316">🔥 {w.calories} kcal</Tag>}
                {w.mood && <span style={{ fontSize: 20 }}>{w.mood}</span>}
                {zHas && z2pct >= 70 && <Tag color="#4ade80">80/20 ok</Tag>}
                {zHas && z2pct > 0 && z2pct < 70 && <Tag color="#f43f5e">Z2 {z2pct}%</Tag>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                {!isCfm && <button onClick={() => onEdit(w)} style={{ background: "transparent", border: "1px solid #1a1f35", borderRadius: 6, color: "#5a6480", padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>✎</button>}
                {!isCfm && <button onClick={() => setConfirmId(w.id)} style={{ background: "transparent", border: "1px solid #2a1a1a", borderRadius: 6, color: "#f43f5e88", padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>}
                {isCfm && <span style={{ fontSize: 12, color: "#f43f5e", alignSelf: "center", marginRight: 4 }}>Löschen?</span>}
                {isCfm && <button onClick={() => { onDelete(w.id); setConfirmId(null); }} style={{ background: "#f43f5e", border: "none", borderRadius: 6, color: "#fff", padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Ja</button>}
                {isCfm && <button onClick={() => setConfirmId(null)} style={{ background: "transparent", border: "1px solid #1a1f35", borderRadius: 6, color: "#5a6480", padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>Nein</button>}
              </div>
            </div>
            <ZoneBar workout={w} />
            {PACEZ.some(z => Number(w[z.key]) > 0) && (
              <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden" }}>
                {PACEZ.map(z => Number(w[z.key]) > 0 && (
                  <div key={z.key} style={{ width: `${w[z.key]}%`, background: z.color }} title={`${z.label} ${z.name}: ${w[z.key]}%`} />
                ))}
              </div>
            )}
            {w.notes && <div style={{ fontSize: 12, color: "#4a5475", fontStyle: "italic" }}>{w.notes}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ workouts, onAdd, onEdit }) {
  const [metrics, setMetrics] = useState([]);
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [metricForm, setMetricForm] = useState({ date: todayStr(), weight: "", restHr: "" });

  useEffect(() => { loadMetrics().then(setMetrics); }, []);

  const saveMetric = async () => {
    if (!metricForm.weight && !metricForm.restHr) return;
    const existing = metrics.filter(m => m.date !== metricForm.date);
    const updated = [...existing, { ...metricForm, id: Date.now() }].sort((a,b) => a.date.localeCompare(b.date));
    setMetrics(updated);
    await saveMetrics(updated);
    setShowMetricForm(false);
    setMetricForm({ date: todayStr(), weight: "", restHr: "" });
  };

  const latestMetric = [...metrics].sort((a,b) => b.date.localeCompare(a.date))[0];
  const metricData = metrics.slice(-14).map(m => ({ date: fmtShort(m.date), weight: parseFloat(m.weight)||null, restHr: parseFloat(m.restHr)||null }));
  if (!workouts.length) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{ fontSize: 48 }}>🏃</div>
        <div style={{ color: "#4a5475", fontSize: 15 }}>Noch keine Einheiten vorhanden.</div>
        <button onClick={onAdd} style={{ background: "#4ade80", border: "none", borderRadius: 10, color: "#050810", padding: "12px 28px", cursor: "pointer", fontSize: 14, fontWeight: 800 }}>Erste Einheit hinzufügen</button>
      </div>
    );
  }

  const t = todayStr();
  const weekWos  = workouts.filter(w => getMondayKey(w.date) === getMondayKey(t));
  const monthWos = workouts.filter(w => getMonthKey(w.date) === getMonthKey(t));
  const yearWos  = workouts.filter(w => getYearKey(w.date) === getYearKey(t));
  const sumKm = ws => ws.reduce((a, w) => a + (parseFloat(w.distance) || 0), 0);
  const sumMin = ws => ws.reduce((a, w) => a + (parseFloat(w.duration) || 0), 0);

  const weekRows = buildPeriodRows(workouts, getMondayKey).slice(-10);
  const weekChart = weekRows.map(r => ({ label: periodLabel(r.key, "week"), km: r.km, cur: r.key === getMondayKey(t) }));

  const zTot = { z1:0, z2:0, z3:0, z4:0, z5:0 }; let zCnt = 0;
  workouts.forEach(w => {
    if (HRZ.some(z => Number(w[z.key]) > 0)) { HRZ.forEach(z => { zTot[z.key] += Number(w[z.key]) || 0; }); zCnt++; }
  });
  const zAvg = zCnt > 0 ? HRZ.map(z => ({ ...z, pct: Math.round(zTot[z.key] / zCnt) })) : [];
  const z2pct = zAvg.find(z => z.key === "z2")?.pct || 0;

  const paceData = [...workouts].filter(w => paceToSecs(w.avgPace)).sort((a, b) => a.date.localeCompare(b.date)).slice(-12)
    .map(w => ({ date: fmtShort(w.date), pace: paceToSecs(w.avgPace) }));

  const recent = [...workouts].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 4);
  const totalKm = sumKm(workouts);
  const totalMin = sumMin(workouts);

  // ── Ruhetag-Empfehlung ─────────────────────────────────────────────────────
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const yesterdayStr = yesterday.toISOString().slice(0,10);
  const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate()-2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0,10);
  const recentWos = workouts.filter(w => w.date === t || w.date === yesterdayStr || w.date === twoDaysAgoStr);
  const hasHighIntensityRecent = recentWos.some(w => (Number(w.z4)||0) + (Number(w.z5)||0) > 20);
  const trainedConsecutive = [t, yesterdayStr, twoDaysAgoStr].filter(d => workouts.some(w => w.date === d)).length >= 3;
  const trainedToday = workouts.some(w => w.date === t);
  let restRec = null;
  if (trainedToday) restRec = null;
  else if (hasHighIntensityRecent) restRec = { type: "rest", msg: "Ruhetag empfohlen", sub: "Intensive Einheit in den letzten 2 Tagen", color: "#f43f5e" };
  else if (trainedConsecutive) restRec = { type: "easy", msg: "Lockere Einheit oder Pause", sub: "3 Tage in Folge trainiert", color: "#fb923c" };
  else restRec = { type: "go", msg: "Bereit zum Training! 💪", sub: "Letzte Einheit: " + (recentWos.length ? fmtShort(recentWos[0].date) : "—"), color: "#4ade80" };
  const pbFastestPace = workouts.filter(w => paceToSecs(w.avgPace)).reduce((best, w) => {
    const s = paceToSecs(w.avgPace); return (!best || s < paceToSecs(best.avgPace)) ? w : best;
  }, null);
  const pbLongestRun = workouts.filter(w => parseFloat(w.distance) > 0).reduce((best, w) => {
    return (!best || parseFloat(w.distance) > parseFloat(best.distance)) ? w : best;
  }, null);
  const allWeekRows = buildPeriodRows(workouts, getMondayKey);
  const pbBestWeek = allWeekRows.reduce((best, r) => (!best || r.km > best.km) ? r : best, null);

  // ── 80/20 per week (last 8 weeks) ──────────────────────────────────────────
  const last8Weeks = allWeekRows.slice(-8);
  const weekZ2Data = last8Weeks.map(r => {
    const wos = workouts.filter(w => getMondayKey(w.date) === r.key && HRZ.some(z => Number(w[z.key]) > 0));
    if (!wos.length) return { label: periodLabel(r.key, "week"), z2: null, ok: false };
    const z2avg = Math.round(wos.reduce((a, w) => a + (Number(w.z2) || 0), 0) / wos.length);
    return { label: periodLabel(r.key, "week"), z2: z2avg, ok: z2avg >= 70 };
  }).filter(d => d.z2 !== null);

  // ── Streak ─────────────────────────────────────────────────────────────────
  const sortedDates = [...new Set(workouts.map(w => w.date))].sort((a,b) => b.localeCompare(a));
  let streak = 0;
  if (sortedDates.length > 0) {
    const msPerDay = 86400000;
    const today0 = new Date(t); today0.setHours(0,0,0,0);
    let check = new Date(sortedDates[0]); check.setHours(0,0,0,0);
    const diffDays = Math.round((today0 - check) / msPerDay);
    if (diffDays <= 1) {
      streak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i-1]); prev.setHours(0,0,0,0);
        const cur  = new Date(sortedDates[i]);   cur.setHours(0,0,0,0);
        if (Math.round((prev - cur) / msPerDay) === 1) streak++;
        else break;
      }
    }
  }

  // ── Heatmap (last 26 weeks = 182 days) ─────────────────────────────────────
  const heatDays = 182;
  const heatStart = new Date(t);
  heatStart.setDate(heatStart.getDate() - heatDays + 1);
  const workoutDateSet = new Set(workouts.map(w => w.date));
  const workoutDateKm = {};
  workouts.forEach(w => {
    workoutDateKm[w.date] = (workoutDateKm[w.date] || 0) + (parseFloat(w.distance) || 0);
  });
  const heatGrid = [];
  for (let i = 0; i < heatDays; i++) {
    const d = new Date(heatStart); d.setDate(heatStart.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    heatGrid.push({ date: ds, km: workoutDateKm[ds] || 0, has: workoutDateSet.has(ds) });
  }
  // Pad to start on Monday
  const firstDow = new Date(heatGrid[0].date).getDay() || 7;
  const padStart = firstDow - 1;
  const heatWeeks = [];
  let week = Array(padStart).fill(null);
  heatGrid.forEach(d => {
    week.push(d);
    if (week.length === 7) { heatWeeks.push(week); week = []; }
  });
  if (week.length > 0) { while (week.length < 7) week.push(null); heatWeeks.push(week); }

  // ── Volume trend (last 10 weeks) ───────────────────────────────────────────
  const volTrend = allWeekRows.slice(-10).map(r => ({ label: periodLabel(r.key, "week"), km: r.km, cur: r.key === getMondayKey(t) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <KpiCard label="Diese Woche" value={sumKm(weekWos).toFixed(1)} sub={`${weekWos.length} Einheiten`} accent="#4ade80" border="#4ade8030" />
        <KpiCard label="Dieser Monat" value={sumKm(monthWos).toFixed(1)} sub={`${monthWos.length} Einheiten`} accent="#60efff" />
        <KpiCard label="Dieses Jahr" value={sumKm(yearWos).toFixed(1)} sub={`${yearWos.length} Einheiten`} accent="#a78bfa" />
        <KpiCard label="🔥 Streak" value={`${streak}`} sub={streak === 1 ? "Tag in Folge" : "Tage in Folge"} accent={streak >= 7 ? "#f43f5e" : streak >= 3 ? "#fb923c" : "#facc15"} border={streak >= 3 ? "#fb923c33" : "#facc1533"} />
      </div>

      {/* ── Ruhetag + Körpermetriken ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Ruhetag */}
        {restRec && (
          <div style={{ background: "#0c0f1d", border: `1px solid ${restRec.color}33`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase" }}>Heute</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: restRec.color }}>{restRec.msg}</div>
            <div style={{ fontSize: 12, color: "#4a5475" }}>{restRec.sub}</div>
          </div>
        )}
        {trainedToday && (
          <div style={{ background: "#0c0f1d", border: "1px solid #4ade8033", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Heute</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80" }}>Training erledigt ✓</div>
            <div style={{ fontSize: 12, color: "#4a5475", marginTop: 4 }}>{workouts.filter(w=>w.date===t).length} Einheit{workouts.filter(w=>w.date===t).length>1?"en":""} heute</div>
          </div>
        )}

        {/* Körpermetriken */}
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase" }}>Körper heute</div>
            <button onClick={() => setShowMetricForm(v => !v)}
              style={{ background: showMetricForm ? "#1a1f35" : "transparent", border: "1px solid #1a1f35", borderRadius: 6, color: "#4a5475", padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
              {showMetricForm ? "✕" : "+ Eintragen"}
            </button>
          </div>
          {showMetricForm && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#a78bfa", marginBottom: 3 }}>GEWICHT (kg)</div>
                  <input type="number" step="0.1" placeholder="z.B. 75.5" value={metricForm.weight}
                    onChange={e => setMetricForm(f => ({...f, weight: e.target.value}))}
                    style={{ background: "#070a14", border: "1px solid #a78bfa44", borderRadius: 7, padding: "8px 10px", color: "#e8eaf6", fontSize: 13, width: "100%", outline: "none", fontFamily: "monospace" }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#fb923c", marginBottom: 3 }}>RUHEPULS (bpm)</div>
                  <input type="number" placeholder="z.B. 52" value={metricForm.restHr}
                    onChange={e => setMetricForm(f => ({...f, restHr: e.target.value}))}
                    style={{ background: "#070a14", border: "1px solid #fb923c44", borderRadius: 7, padding: "8px 10px", color: "#e8eaf6", fontSize: 13, width: "100%", outline: "none", fontFamily: "monospace" }} />
                </div>
              </div>
              <button onClick={saveMetric}
                style={{ background: "#4ade80", border: "none", borderRadius: 7, color: "#050810", padding: "8px", cursor: "pointer", fontSize: 12, fontWeight: 800 }}>
                Speichern
              </button>
            </div>
          )}
          {latestMetric ? (
            <div style={{ display: "flex", gap: 16 }}>
              {latestMetric.weight && <div>
                <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 2 }}>GEWICHT</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa", fontFamily: "monospace" }}>{latestMetric.weight} <span style={{ fontSize: 12 }}>kg</span></div>
                <div style={{ fontSize: 10, color: "#4a5475" }}>{fmtShort(latestMetric.date)}</div>
              </div>}
              {latestMetric.restHr && <div>
                <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 2 }}>RUHEPULS</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fb923c", fontFamily: "monospace" }}>{latestMetric.restHr} <span style={{ fontSize: 12 }}>bpm</span></div>
                <div style={{ fontSize: 10, color: "#4a5475" }}>{fmtShort(latestMetric.date)}</div>
              </div>}
            </div>
          ) : <div style={{ fontSize: 12, color: "#2a3050" }}>Noch keine Körperdaten eingetragen.</div>}
        </div>
      </div>

      {/* ── Aktivitäts-Heatmap ── */}
      <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase" }}>Aktivitäts-Heatmap — letzte 26 Wochen</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#4a5475" }}>weniger</span>
            {["#0f1820","#1a3a1a","#2d6a2d","#4ade80"].map((c,i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
            <span style={{ fontSize: 10, color: "#4a5475" }}>mehr</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {/* Day labels on left */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2, flexShrink: 0 }}>
            {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d => (
              <div key={d} style={{ fontSize: 9, color: "#4a5475", height: 12, lineHeight: "12px", width: 14, textAlign: "right", paddingRight: 2 }}>{d}</div>
            ))}
          </div>
          {/* Weeks grid */}
          <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
            {heatWeeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {week.map((d, di) => {
                  if (!d) return <div key={di} style={{ width: 12, height: 12 }} />;
                  const color = !d.has ? "#0f1820" : d.km > 15 ? "#4ade80" : d.km > 8 ? "#2d6a2d" : d.km > 0 ? "#1a3a1a" : "#4ade8066";
                  return (
                    <div key={di} style={{ width: 12, height: 12, borderRadius: 2, background: color, cursor: d.has ? "pointer" : "default" }}
                      title={d.has ? `${d.date}: ${d.km.toFixed(1)} km` : d.date} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Persönliche Bestleistungen ── */}
      {(pbFastestPace || pbLongestRun || pbBestWeek) && (
        <div style={{ background: "#0c0f1d", border: "1px solid #facc1533", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#facc15", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>🏅 Persönliche Bestleistungen</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {pbFastestPace && (
              <div style={{ background: "#070a14", borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 10, color: "#4a5475", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Schnellste Pace</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#facc15", fontFamily: "monospace" }}>{pbFastestPace.avgPace}</div>
                <div style={{ fontSize: 11, color: "#4a5475", marginTop: 2 }}>{fmtShort(pbFastestPace.date)} · {pbFastestPace.type}</div>
              </div>
            )}
            {pbLongestRun && (
              <div style={{ background: "#070a14", borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 10, color: "#4a5475", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Längster Lauf</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#60efff", fontFamily: "monospace" }}>{parseFloat(pbLongestRun.distance).toFixed(1)} km</div>
                <div style={{ fontSize: 11, color: "#4a5475", marginTop: 2 }}>{fmtShort(pbLongestRun.date)} · {pbLongestRun.type}</div>
              </div>
            )}
            {pbBestWeek && (
              <div style={{ background: "#070a14", borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 10, color: "#4a5475", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Beste Woche</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa", fontFamily: "monospace" }}>{pbBestWeek.km.toFixed(1)} km</div>
                <div style={{ fontSize: 11, color: "#4a5475", marginTop: 2 }}>{periodLabel(pbBestWeek.key, "week")}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 80/20 Wochencheck ── */}
      {weekZ2Data.length > 0 && (
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>80/20 — Zone 2 pro Woche</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...weekZ2Data].reverse().map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 11, color: "#4a5475", minWidth: 110, flexShrink: 0 }}>{d.label}</div>
                <div style={{ flex: 1, background: "#070a14", borderRadius: 4, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(d.z2, 100)}%`, height: "100%", background: d.ok ? "#4ade80" : "#f43f5e", borderRadius: 4, transition: "width 0.4s" }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: d.ok ? "#4ade80" : "#f43f5e", fontFamily: "monospace", minWidth: 42, textAlign: "right" }}>{d.z2}%</div>
                <div style={{ fontSize: 14 }}>{d.ok ? "✓" : "✗"}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "#4a5475" }}>Ziel: ≥ 70% Zone 2 pro Woche für optimalen Konditionsaufbau</div>
        </div>
      )}

      {/* ── Wochenvolumen-Trend + HF-Zonen ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Wochenvolumen-Trend</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={volTrend} barCategoryGap="30%">
              <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#4a5475", fontSize: 8 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e8eaf6" }} formatter={v => [`${v} km`]} />
              <Bar dataKey="km" radius={[4,4,0,0]}>
                {volTrend.map((e, i) => <Cell key={i} fill={e.cur ? "#4ade80" : "#1a2e1a"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Ø HF-Zonen</div>
          {zAvg.length > 0 ? (
            <>
              <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                {zAvg.map(z => z.pct > 0 && <div key={z.key} style={{ width: `${z.pct}%`, background: z.color }} title={`${z.label}: ${z.pct}%`} />)}
              </div>
              {zAvg.map(z => (
                <div key={z.key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: z.color }} />
                    <span style={{ fontSize: 11, color: "#8a9ab5" }}>{z.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: z.color, fontFamily: "'DM Mono',monospace" }}>{z.pct}%</span>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 8, background: z2pct >= 70 ? "#4ade8011" : "#f43f5e0d", border: `1px solid ${z2pct >= 70 ? "#4ade8033" : "#f43f5e33"}` }}>
                <span style={{ fontSize: 11, color: z2pct >= 70 ? "#4ade80" : "#f43f5e", fontWeight: 700 }}>80/20: Z2 {z2pct}% {z2pct >= 70 ? "✓" : "← Ziel ≥70%"}</span>
              </div>
            </>
          ) : <div style={{ color: "#2a3050", fontSize: 12 }}>Noch keine HF-Daten.</div>}
        </div>
      </div>

      {paceData.length >= 2 && (
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Pace-Entwicklung</div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={paceData}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#facc15" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={["dataMin-15","dataMax+15"]} tickFormatter={v => secsToMmSs(v)} tick={{ fill: "#4a5475", fontSize: 9 }} reversed axisLine={false} tickLine={false} />
              <Tooltip formatter={v => secsToMmSs(v)} contentStyle={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e8eaf6" }} />
              <Area type="monotone" dataKey="pace" stroke="#facc15" strokeWidth={2} fill="url(#pg)" dot={{ fill: "#facc15", r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 12 }}>
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Gesamt</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 2 }}>KILOMETER</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#e8eaf6", fontFamily: "'DM Mono',monospace" }}>{totalKm.toFixed(0)}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 2 }}>ZEIT</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf6", fontFamily: "'DM Mono',monospace" }}>{Math.floor(totalMin/60)}h {Math.round(totalMin%60)}m</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 2 }}>EINHEITEN</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf6", fontFamily: "'DM Mono',monospace" }}>{workouts.length}</div>
          </div>
        </div>

        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Letzte Einheiten</div>
          {recent.map(w => (
            <div key={w.id} onClick={() => onEdit(w)} style={{ borderBottom: "1px solid #111525", paddingBottom: 8, marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: TYPE_COLOR[w.type] || "#5a6480" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#c8cfe8" }}>{w.type}</span>
                </div>
                <span style={{ fontSize: 11, color: "#4a5475" }}>{fmtShort(w.date)}</span>
              </div>
              <div style={{ display: "flex", gap: 10, paddingLeft: 14, marginTop: 3 }}>
                {w.distance && <span style={{ fontSize: 12, color: "#a78bfa", fontFamily: "'DM Mono',monospace" }}>{w.distance} km</span>}
                {w.avgPace && <span style={{ fontSize: 12, color: "#facc15", fontFamily: "'DM Mono',monospace" }}>{w.avgPace} /km</span>}
                {w.watt && <span style={{ fontSize: 12, color: "#facc15", fontFamily: "'DM Mono',monospace" }}>⚡{w.watt}</span>}
                {w.avgHr && <span style={{ fontSize: 12, color: "#fb923c", fontFamily: "'DM Mono',monospace" }}>{w.avgHr} bpm</span>}
                {w.eleUp && <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "'DM Mono',monospace" }}>↑{w.eleUp}m</span>}
                {w.calories && <span style={{ fontSize: 12, color: "#f97316", fontFamily: "'DM Mono',monospace" }}>🔥{w.calories}</span>}
              </div>
              {w.instructor && <div style={{ paddingLeft: 14, marginTop: 2, fontSize: 11, color: "#a78bfa" }}>👤 {w.instructor}</div>}
              <div style={{ paddingLeft: 14, marginTop: 5 }}><ZoneBar workout={w} height={4} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monatsrückblick ── */}
      {(() => {
        const prevMonth = new Date(); prevMonth.setMonth(prevMonth.getMonth() - 1);
        const prevMk = prevMonth.toISOString().slice(0, 7);
        const prevWos = workouts.filter(w => getMonthKey(w.date) === prevMk);
        if (!prevWos.length) return null;
        const prevKm = prevWos.reduce((a,w) => a+(parseFloat(w.distance)||0), 0);
        const prevMin = prevWos.reduce((a,w) => a+(parseFloat(w.duration)||0), 0);
        const prevPaces = prevWos.filter(w => paceToSecs(w.avgPace)).map(w => paceToSecs(w.avgPace));
        const prevAvgPace = prevPaces.length ? secsToMmSs(prevPaces.reduce((a,b)=>a+b,0)/prevPaces.length) : null;
        const moodCounts = {};
        prevWos.forEach(w => { if(w.mood) moodCounts[w.mood] = (moodCounts[w.mood]||0)+1; });
        const topMood = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
        const monthName = prevMonth.toLocaleDateString("de-DE", { month: "long" });
        const pbRun = prevWos.filter(w=>w.distance).reduce((b,w)=>(!b||parseFloat(w.distance)>parseFloat(b.distance))?w:b, null);
        return (
          <div style={{ background: "#0c0f1d", border: "1px solid #a78bfa33", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 10, color: "#a78bfa", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
              📅 Rückblick {monthName}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#070a14", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#4a5475", textTransform: "uppercase", marginBottom: 3 }}>KM</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#4ade80", fontFamily: "monospace" }}>{prevKm.toFixed(0)}</div>
              </div>
              <div style={{ background: "#070a14", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#4a5475", textTransform: "uppercase", marginBottom: 3 }}>EINHEITEN</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#60efff", fontFamily: "monospace" }}>{prevWos.length}</div>
              </div>
              <div style={{ background: "#070a14", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#4a5475", textTransform: "uppercase", marginBottom: 3 }}>ZEIT</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#facc15", fontFamily: "monospace" }}>{Math.floor(prevMin/60)}h</div>
              </div>
              <div style={{ background: "#070a14", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#4a5475", textTransform: "uppercase", marginBottom: 3 }}>STIMMUNG</div>
                <div style={{ fontSize: 20 }}>{topMood || "—"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {prevAvgPace && <div style={{ background: "#070a14", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#facc15" }}>⌀ Pace: <strong>{prevAvgPace} /km</strong></div>}
              {pbRun && <div style={{ background: "#070a14", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#60efff" }}>Längster Lauf: <strong>{parseFloat(pbRun.distance).toFixed(1)} km</strong></div>}
            </div>
          </div>
        );
      })()}

      <button onClick={onAdd} style={{ background: "#4ade80", border: "none", borderRadius: 10, color: "#050810", padding: 13, cursor: "pointer", fontSize: 14, fontWeight: 800, width: "100%" }}>
        + Neue Einheit
      </button>
    </div>
  );
}

// ── Analyse ────────────────────────────────────────────────────────────────────
function AnalyseView({ workouts }) {
  if (!workouts.length) {
    return <div style={{ textAlign: "center", padding: 80, color: "#2a3050" }}>Keine Daten.</div>;
  }
  const totalKm = workouts.reduce((a, w) => a + (parseFloat(w.distance) || 0), 0);
  const totalMin = workouts.reduce((a, w) => a + (parseFloat(w.duration) || 0), 0);
  const hrs = workouts.filter(w => w.avgHr).map(w => parseFloat(w.avgHr));
  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
  const paces = workouts.filter(w => paceToSecs(w.avgPace)).map(w => paceToSecs(w.avgPace));
  const avgPace = paces.length ? secsToMmSs(paces.reduce((a, b) => a + b, 0) / paces.length) : null;
  const zTot = { z1:0, z2:0, z3:0, z4:0, z5:0 }; let zCnt = 0;
  workouts.forEach(w => { if (HRZ.some(z => Number(w[z.key]) > 0)) { HRZ.forEach(z => { zTot[z.key] += Number(w[z.key]) || 0; }); zCnt++; } });
  const zAvg = zCnt > 0 ? HRZ.map(z => ({ ...z, pct: Math.round(zTot[z.key] / zCnt) })) : [];
  const z2pct = zAvg.find(z => z.key === "z2")?.pct || 0;
  const paceData = [...workouts].filter(w => paceToSecs(w.avgPace)).sort((a, b) => a.date.localeCompare(b.date)).map(w => ({ date: fmtShort(w.date), pace: paceToSecs(w.avgPace) }));
  const hrData = [...workouts].filter(w => w.avgHr).sort((a, b) => a.date.localeCompare(b.date)).map(w => ({ date: fmtShort(w.date), hr: parseFloat(w.avgHr) }));
  const byType = {};
  workouts.forEach(w => { byType[w.type] = (byType[w.type] || 0) + (parseFloat(w.distance) || 0); });
  const typeData = Object.entries(byType).map(([name, km]) => ({ name, km: parseFloat(km.toFixed(1)) }));

  const totalEleUp = workouts.reduce((a, w) => a + (parseInt(w.eleUp) || 0), 0);
  const totalCals = workouts.reduce((a, w) => a + (parseInt(w.calories) || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <KpiCard label="Gesamt km" value={totalKm.toFixed(1)} accent="#4ade80" />
        <KpiCard label="Einheiten" value={workouts.length} />
        <KpiCard label="Trainingszeit" value={`${Math.floor(totalMin/60)}h ${Math.round(totalMin%60)}m`} />
        {avgPace && <KpiCard label="Ø Pace" value={avgPace} sub="min/km" accent="#facc15" />}
        {avgHr > 0 && <KpiCard label="Ø HF" value={`${avgHr}`} sub="bpm" accent="#fb923c" />}
        {totalEleUp > 0 && <KpiCard label="Gesamt ↑" value={`${totalEleUp}m`} sub="Aufstieg" accent="#4ade80" />}
        {totalCals > 0 && <KpiCard label="Gesamt 🔥" value={totalCals.toLocaleString()} sub="kcal" accent="#f97316" />}
      </div>

      {zAvg.length > 0 && (
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Ø HF-Zonenverteilung</div>
          <div style={{ display: "flex", height: 14, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
            {zAvg.map(z => z.pct > 0 && <div key={z.key} style={{ width: `${z.pct}%`, background: z.color }} title={`${z.label}: ${z.pct}%`} />)}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
            {zAvg.map(z => (
              <div key={z.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: z.color }} />
                <span style={{ fontSize: 11, color: "#8a9ab5" }}>{z.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: z.color, fontFamily: "'DM Mono',monospace" }}>{z.pct}%</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 8, background: z2pct >= 70 ? "#4ade8011" : "#f43f5e0d", border: `1px solid ${z2pct >= 70 ? "#4ade8033" : "#f43f5e33"}` }}>
            <span style={{ fontSize: 12, color: z2pct >= 70 ? "#4ade80" : "#f43f5e", fontWeight: 700 }}>80/20: Zone 2 Ø {z2pct}% {z2pct >= 70 ? "✓ Gut!" : "— Ziel ≥ 70%"}</span>
          </div>
        </div>
      )}

      {paceData.length >= 2 && (
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Pace-Entwicklung</div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={paceData}>
              <defs>
                <linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#facc15" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={["dataMin-15","dataMax+15"]} tickFormatter={v => secsToMmSs(v)} tick={{ fill: "#4a5475", fontSize: 9 }} reversed axisLine={false} tickLine={false} />
              <Tooltip formatter={v => secsToMmSs(v)} contentStyle={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e8eaf6" }} />
              <Area type="monotone" dataKey="pace" stroke="#facc15" strokeWidth={2} fill="url(#pg2)" dot={{ fill: "#facc15", r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {hrData.length >= 2 && (
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Herzfrequenz-Trend</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={hrData}>
              <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e8eaf6" }} />
              <Line type="monotone" dataKey="hr" stroke="#fb923c" strokeWidth={2} dot={{ fill: "#fb923c", r: 3, strokeWidth: 0 }} name="bpm" />
              <Line type="monotone" dataKey={() => 133} stroke="#4ade8055" strokeWidth={1} dot={false} strokeDasharray="4 4" name="Z2 max" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: "18px 18px 10px" }}>
        <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>km pro Typ</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={typeData}>
            <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e8eaf6" }} />
            <Bar dataKey="km" radius={[4,4,0,0]}>
              {typeData.map(e => <Cell key={e.name} fill={TYPE_COLOR[e.name] || "#a78bfa"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {(() => {
        const pzTot = {pz1:0,pz2:0,pz3:0,pz4:0,pz5:0,pz6:0}; let pzCnt=0;
        workouts.forEach(w=>{if(PACEZ.some(z=>Number(w[z.key])>0)){PACEZ.forEach(z=>{pzTot[z.key]+=Number(w[z.key])||0});pzCnt++;}});
        if(!pzCnt) return null;
        const pzAvg = PACEZ.map(z=>({...z, pct:Math.round(pzTot[z.key]/pzCnt)}));
        return (
          <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Ø Tempo-Zonenverteilung (Strava SAT)</div>
            <div style={{ display: "flex", height: 14, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
              {pzAvg.map(z => z.pct > 0 && <div key={z.key} style={{ width: `${z.pct}%`, background: z.color }} title={`${z.label}: ${z.pct}%`} />)}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              {pzAvg.map(z => (
                <div key={z.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: z.color }} />
                  <span style={{ fontSize: 11, color: "#8a9ab5" }}>{z.label} {z.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: z.color, fontFamily: "monospace" }}>{z.pct}%</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#4a5475" }}>
              Hauptzone: <strong style={{ color: pzAvg.reduce((b,z)=>z.pct>b.pct?z:b,{pct:0}).color }}>
                {pzAvg.reduce((b,z)=>z.pct>b.pct?z:b,{pct:0,label:"",name:""}).label} {pzAvg.reduce((b,z)=>z.pct>b.pct?z:b,{pct:0,label:"",name:""}).name}
              </strong> — {pzAvg.reduce((b,z)=>z.pct>b.pct?z:b,{pct:0}).range}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Meilensteine ───────────────────────────────────────────────────────────────
const MILESTONES = [
  { km: 50,   label: "Erster Schritt",    icon: "👟", color: "#4ade80" },
  { km: 100,  label: "Halbhundert",       icon: "🏃", color: "#4ade80" },
  { km: 250,  label: "Viertel-Tausend",   icon: "⭐", color: "#facc15" },
  { km: 500,  label: "500er Club",        icon: "🥈", color: "#60efff" },
  { km: 750,  label: "Dreiviertel-K",     icon: "🎯", color: "#fb923c" },
  { km: 1000, label: "1000 km Legende",   icon: "🥇", color: "#facc15" },
  { km: 1500, label: "Ultra-Läufer",      icon: "🏅", color: "#a78bfa" },
  { km: 2000, label: "2000 km Monster",   icon: "🦁", color: "#f43f5e" },
  { km: 5000, label: "Absoluter Wahnsinn",icon: "🚀", color: "#f43f5e" },
];

// ── Körper & Trends View (neuer Tab) ──────────────────────────────────────────
function TrendsView({ workouts }) {
  const [metrics, setMetrics] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), weight: "", restHr: "" });

  useEffect(() => { loadMetrics().then(setMetrics); }, []);

  const save = async () => {
    if (!form.weight && !form.restHr) return;
    const existing = metrics.filter(m => m.date !== form.date);
    const updated = [...existing, { ...form, id: Date.now() }].sort((a,b) => a.date.localeCompare(b.date));
    setMetrics(updated); await saveMetrics(updated);
    setShowForm(false); setForm({ date: new Date().toISOString().slice(0,10), weight: "", restHr: "" });
  };

  const weightData = metrics.filter(m => m.weight).map(m => ({ date: fmtShort(m.date), kg: parseFloat(m.weight) }));
  const hrData = metrics.filter(m => m.restHr).map(m => ({ date: fmtShort(m.date), bpm: parseFloat(m.restHr) }));

  // Stimmungs-Statistik nach Wochentag
  const DAYS = ["So","Mo","Di","Mi","Do","Fr","Sa"];
  const moodByDay = Array(7).fill(null).map(() => ({ count: 0, scores: [] }));
  const MOOD_SCORE = { "😴": 1, "😐": 2, "🙂": 3, "💪": 4, "🔥": 5 };
  workouts.forEach(w => {
    if (w.mood && w.date) {
      const dow = new Date(w.date).getDay();
      moodByDay[dow].count++;
      moodByDay[dow].scores.push(MOOD_SCORE[w.mood] || 3);
    }
  });
  const moodDayData = DAYS.map((d, i) => ({
    day: d,
    avg: moodByDay[i].scores.length ? parseFloat((moodByDay[i].scores.reduce((a,b)=>a+b,0)/moodByDay[i].scores.length).toFixed(1)) : null,
    count: moodByDay[i].count,
  }));

  // Meilensteine
  const totalKm = workouts.reduce((a,w) => a+(parseFloat(w.distance)||0), 0);
  const reached = MILESTONES.filter(m => totalKm >= m.km);
  const next = MILESTONES.find(m => totalKm < m.km);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Meilensteine ── */}
      <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>🏅 Meilensteine</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {MILESTONES.map(m => {
            const done = totalKm >= m.km;
            return (
              <div key={m.km} style={{ background: done ? "#070a14" : "#070a14", border: `1px solid ${done ? m.color+"44" : "#1a1f35"}`, borderRadius: 10, padding: "10px 14px", opacity: done ? 1 : 0.35, textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 24 }}>{m.icon}</div>
                <div style={{ fontSize: 10, color: done ? m.color : "#4a5475", fontWeight: 700, marginTop: 4 }}>{m.km} km</div>
                <div style={{ fontSize: 9, color: "#4a5475", marginTop: 2 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        {next && (
          <div style={{ background: "#070a14", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "#4a5475", marginBottom: 6 }}>Nächster Meilenstein: <strong style={{ color: next.color }}>{next.icon} {next.km} km — {next.label}</strong></div>
            <div style={{ background: "#1a1f35", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, (totalKm/next.km)*100).toFixed(1)}%`, height: "100%", background: next.color, borderRadius: 4, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 10, color: "#4a5475", marginTop: 4 }}>{totalKm.toFixed(1)} / {next.km} km — noch {(next.km - totalKm).toFixed(1)} km</div>
          </div>
        )}
        {!next && reached.length === MILESTONES.length && (
          <div style={{ textAlign: "center", fontSize: 18, color: "#facc15" }}>🚀 Alle Meilensteine erreicht! Absolute Legende!</div>
        )}
      </div>

      {/* ── Stimmung nach Wochentag ── */}
      {workouts.some(w => w.mood) && (
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>😊 Stimmung nach Wochentag</div>
          <div style={{ display: "flex", gap: 8 }}>
            {moodDayData.map(d => {
              const emoji = d.avg ? (d.avg >= 4.5 ? "🔥" : d.avg >= 3.5 ? "💪" : d.avg >= 2.5 ? "🙂" : d.avg >= 1.5 ? "😐" : "😴") : null;
              const color = d.avg ? (d.avg >= 4 ? "#4ade80" : d.avg >= 3 ? "#facc15" : "#fb923c") : "#2a3050";
              return (
                <div key={d.day} style={{ flex: 1, background: "#070a14", borderRadius: 10, padding: "10px 6px", textAlign: "center", border: `1px solid ${d.avg ? color+"33" : "#1a1f35"}` }}>
                  <div style={{ fontSize: 9, color: "#4a5475", marginBottom: 6, fontWeight: 700 }}>{d.day}</div>
                  <div style={{ fontSize: 20 }}>{emoji || "—"}</div>
                  {d.avg && <div style={{ fontSize: 10, color, fontWeight: 700, marginTop: 4 }}>{d.avg}</div>}
                  {d.count > 0 && <div style={{ fontSize: 9, color: "#4a5475", marginTop: 2 }}>{d.count}×</div>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "#4a5475" }}>
            {(() => {
              const best = moodDayData.filter(d=>d.avg).reduce((b,d) => (!b||d.avg>b.avg)?d:b, null);
              const worst = moodDayData.filter(d=>d.avg).reduce((b,d) => (!b||d.avg<b.avg)?d:b, null);
              return best && worst ? `Bester Tag: ${best.day} (⌀ ${best.avg}) · Schlechtester Tag: ${worst.day} (⌀ ${worst.avg})` : "";
            })()}
          </div>
        </div>
      )}

      {/* ── Körper eintragen ── */}
      <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase" }}>⚖️ Körperdaten</div>
          <button onClick={() => setShowForm(v => !v)}
            style={{ background: "#1a1f35", border: "none", borderRadius: 7, color: "#e8eaf6", padding: "7px 14px", cursor: "pointer", fontSize: 12 }}>
            {showForm ? "✕" : "+ Eintragen"}
          </button>
        </div>
        {showForm && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14, padding: 14, background: "#070a14", borderRadius: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 4 }}>DATUM</div>
                <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}
                  style={{ background: "#0c0f1d", border: "1px solid #1e2436", borderRadius: 7, padding: "8px 10px", color: "#e8eaf6", fontSize: 12, width: "100%", outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#a78bfa", marginBottom: 4 }}>GEWICHT (kg)</div>
                <input type="number" step="0.1" placeholder="75.5" value={form.weight} onChange={e => setForm(f=>({...f,weight:e.target.value}))}
                  style={{ background: "#0c0f1d", border: "1px solid #a78bfa44", borderRadius: 7, padding: "8px 10px", color: "#e8eaf6", fontSize: 12, width: "100%", outline: "none", fontFamily: "monospace" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#fb923c", marginBottom: 4 }}>RUHEPULS (bpm)</div>
                <input type="number" placeholder="52" value={form.restHr} onChange={e => setForm(f=>({...f,restHr:e.target.value}))}
                  style={{ background: "#0c0f1d", border: "1px solid #fb923c44", borderRadius: 7, padding: "8px 10px", color: "#e8eaf6", fontSize: 12, width: "100%", outline: "none", fontFamily: "monospace" }} />
              </div>
            </div>
            <button onClick={save} style={{ background: "#4ade80", border: "none", borderRadius: 7, color: "#050810", padding: "9px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>Speichern</button>
          </div>
        )}

        {/* Gewichts-Chart */}
        {weightData.length >= 2 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 10, fontWeight: 600 }}>Gewicht kg</div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={weightData}>
                <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.15}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="date" tick={{fill:"#4a5475",fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis domain={["dataMin-1","dataMax+1"]} tick={{fill:"#4a5475",fontSize:9}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:"#0c0f1d",border:"1px solid #1a1f35",borderRadius:8,fontSize:12}} labelStyle={{color:"#e8eaf6"}} formatter={v=>[`${v} kg`]}/>
                <Area type="monotone" dataKey="kg" stroke="#a78bfa" strokeWidth={2} fill="url(#wg)" dot={{fill:"#a78bfa",r:3,strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ruhepuls-Chart */}
        {hrData.length >= 2 && (
          <div>
            <div style={{ fontSize: 11, color: "#fb923c", marginBottom: 10, fontWeight: 600 }}>Ruhepuls bpm <span style={{fontSize:10,color:"#4a5475",fontWeight:400}}>(↓ = besser)</span></div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={hrData}>
                <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fb923c" stopOpacity={0.15}/><stop offset="95%" stopColor="#fb923c" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="date" tick={{fill:"#4a5475",fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis domain={["dataMin-2","dataMax+2"]} tick={{fill:"#4a5475",fontSize:9}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:"#0c0f1d",border:"1px solid #1a1f35",borderRadius:8,fontSize:12}} labelStyle={{color:"#e8eaf6"}} formatter={v=>[`${v} bpm`]}/>
                <Area type="monotone" dataKey="bpm" stroke="#fb923c" strokeWidth={2} fill="url(#hg)" dot={{fill:"#fb923c",r:3,strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {metrics.length === 0 && <div style={{color:"#2a3050",fontSize:12}}>Noch keine Körperdaten. Trag heute deinen ersten Wert ein!</div>}
      </div>
    </div>
  );
}

// ── Übersicht ──────────────────────────────────────────────────────────────────
function UebersichtView({ workouts }) {
  const [mode, setMode] = useState("week");
  if (!workouts.length) {
    return <div style={{ textAlign: "center", padding: 80, color: "#2a3050" }}>Keine Daten.</div>;
  }
  const t = todayStr();
  const currentKeys = { week: getMondayKey(t), month: getMonthKey(t), year: getYearKey(t) };
  const allRows = {
    week: buildPeriodRows(workouts, getMondayKey),
    month: buildPeriodRows(workouts, getMonthKey),
    year: buildPeriodRows(workouts, getYearKey),
  };
  const rows = allRows[mode];
  const current = rows.find(r => r.key === currentKeys[mode]);
  const chartData = rows.slice(-14).map(r => ({ label: periodLabel(r.key, mode), km: r.km, cur: r.key === currentKeys[mode] }));
  let cum = 0;
  const cumData = [...workouts].sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(w => {
    cum += parseFloat(w.distance) || 0;
    return { date: fmtShort(w.date), km: parseFloat(cum.toFixed(1)) };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 4, background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 10, padding: 4, alignSelf: "flex-start" }}>
        {[["week","Woche"],["month","Monat"],["year","Jahr"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)}
            style={{ background: mode === k ? "#1a1f35" : "transparent", border: "none", borderRadius: 7, padding: "8px 18px", color: mode === k ? "#e8eaf6" : "#4a5475", cursor: "pointer", fontSize: 12, fontWeight: mode === k ? 700 : 400 }}>
            {l}
          </button>
        ))}
      </div>

      {current && (
        <div style={{ background: "#0c0f1d", border: "1px solid #4ade8033", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            {mode === "week" ? "Diese Woche" : mode === "month" ? "Dieser Monat" : "Dieses Jahr"}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <KpiCard label="km" value={current.km.toFixed(1)} accent="#4ade80" border="#4ade8030" />
            <KpiCard label="Einheiten" value={current.count} />
            <KpiCard label="Zeit" value={current.minutes ? `${Math.floor(current.minutes/60)}h ${Math.round(current.minutes%60)}m` : "—"} />
            {current.avgPace && <KpiCard label="Ø Pace" value={current.avgPace} sub="min/km" accent="#facc15" />}
            {current.avgHr && <KpiCard label="Ø HF" value={`${current.avgHr}`} sub="bpm" accent="#fb923c" />}
          </div>
        </div>
      )}

      <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: "18px 18px 10px" }}>
        <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          km pro {mode === "week" ? "Woche" : mode === "month" ? "Monat" : "Jahr"}
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={chartData} barCategoryGap="25%">
            <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#4a5475", fontSize: 8 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e8eaf6" }} formatter={v => [`${v} km`]} />
            <Bar dataKey="km" radius={[4,4,0,0]}>
              {chartData.map((e, i) => <Cell key={i} fill={e.cur ? "#4ade80" : "#192a1e"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px 0", fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase" }}>
          Alle {mode === "week" ? "Wochen" : mode === "month" ? "Monate" : "Jahre"}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #111525" }}>
                {["Zeitraum","km","Einh.","Zeit","Ø Pace","Ø HF"].map(h => (
                  <th key={h} style={{ textAlign: h === "Zeitraum" ? "left" : "right", padding: "10px 14px", color: "#4a5475", fontWeight: 600, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map(r => {
                const isCur = r.key === currentKeys[mode];
                return (
                  <tr key={r.key} style={{ borderBottom: "1px solid #0a0d1a", background: isCur ? "#4ade8008" : "transparent" }}>
                    <td style={{ padding: "10px 14px", color: isCur ? "#4ade80" : "#c8cfe8", fontWeight: isCur ? 700 : 400 }}>
                      {isCur && <span style={{ fontSize: 9, marginRight: 5 }}>▶</span>}{periodLabel(r.key, mode)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#e8eaf6", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{r.km}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#8a9ab5" }}>{r.count}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#8a9ab5", fontFamily: "'DM Mono',monospace" }}>{r.minutes ? `${Math.floor(r.minutes/60)}h ${Math.round(r.minutes%60)}m` : "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#facc15", fontFamily: "'DM Mono',monospace" }}>{r.avgPace || "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#fb923c", fontFamily: "'DM Mono',monospace" }}>{r.avgHr ? `${r.avgHr} bpm` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {cumData.length >= 2 && (
        <div style={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 14, padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Kumulative km</div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={cumData}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60efff" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#60efff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#111525" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4a5475", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0c0f1d", border: "1px solid #1a1f35", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e8eaf6" }} />
              <Area type="monotone" dataKey="km" stroke="#60efff" strokeWidth={2} fill="url(#cg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Goals Storage ─────────────────────────────────────────────────────────────
const GOALS_KEY = "laufanalyse_goals_v1";
async function loadGoals() {
  try { const raw = localStorage.getItem(GOALS_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function saveGoals(gs) {
  try { localStorage.setItem(GOALS_KEY, JSON.stringify(gs)); } catch {}
}

// ── Ziele View ─────────────────────────────────────────────────────────────────
function ZieleView({ workouts }) {
  const [goals, setGoals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", type: "km_month", target: "", unit: "km" });

  useEffect(() => { loadGoals().then(setGoals); }, []);

  const GOAL_TYPES = [
    { key: "km_month",    label: "km diesen Monat",    unit: "km" },
    { key: "km_week",     label: "km diese Woche",     unit: "km" },
    { key: "sessions_month", label: "Einheiten diesen Monat", unit: "" },
    { key: "km_total",    label: "km gesamt",          unit: "km" },
    { key: "streak",      label: "Streak Tage",        unit: "Tage" },
  ];

  const t = todayStr();

  function calcProgress(goal) {
    let current = 0;
    if (goal.type === "km_month") {
      const mk = getMonthKey(t);
      current = workouts.filter(w => getMonthKey(w.date) === mk).reduce((a,w) => a+(parseFloat(w.distance)||0), 0);
    } else if (goal.type === "km_week") {
      const wk = getMondayKey(t);
      current = workouts.filter(w => getMondayKey(w.date) === wk).reduce((a,w) => a+(parseFloat(w.distance)||0), 0);
    } else if (goal.type === "sessions_month") {
      const mk = getMonthKey(t);
      current = workouts.filter(w => getMonthKey(w.date) === mk).length;
    } else if (goal.type === "km_total") {
      current = workouts.reduce((a,w) => a+(parseFloat(w.distance)||0), 0);
    } else if (goal.type === "streak") {
      const sorted = [...new Set(workouts.map(w=>w.date))].sort((a,b)=>b.localeCompare(a));
      let streak = 0;
      if (sorted.length > 0) {
        const msPerDay = 86400000;
        const today0 = new Date(t); today0.setHours(0,0,0,0);
        let check = new Date(sorted[0]); check.setHours(0,0,0,0);
        if (Math.round((today0-check)/msPerDay) <= 1) {
          streak = 1;
          for (let i=1;i<sorted.length;i++) {
            const p=new Date(sorted[i-1]); p.setHours(0,0,0,0);
            const c=new Date(sorted[i]); c.setHours(0,0,0,0);
            if (Math.round((p-c)/msPerDay)===1) streak++; else break;
          }
        }
      }
      current = streak;
    }
    const pct = Math.min(100, Math.round((current / parseFloat(goal.target)) * 100));
    return { current: parseFloat(current.toFixed(1)), pct };
  }

  const addGoal = async () => {
    if (!form.target) return;
    const gt = GOAL_TYPES.find(g => g.key === form.type);
    const newGoal = { ...form, id: Date.now(), label: form.label || gt.label, unit: gt.unit };
    const updated = [...goals, newGoal];
    setGoals(updated);
    await saveGoals(updated);
    setShowForm(false);
    setForm({ label: "", type: "km_month", target: "", unit: "km" });
  };

  const deleteGoal = async (id) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    await saveGoals(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, color: "#4a5475", letterSpacing: 2, textTransform: "uppercase" }}>Meine Ziele</div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ background: "#4ade80", border: "none", borderRadius: 8, color: "#050810", padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
          {showForm ? "✕ Abbrechen" : "+ Ziel hinzufügen"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#0c0f1d", border: "1px solid #4ade8033", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 4, textTransform: "uppercase" }}>Zieltyp</div>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                style={{ background: "#070a14", border: "1px solid #1e2436", borderRadius: 7, padding: "9px 12px", color: "#e8eaf6", fontSize: 13, outline: "none", width: "100%" }}>
                {GOAL_TYPES.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 4, textTransform: "uppercase" }}>Zielwert</div>
              <input type="number" placeholder="z.B. 80" value={form.target} onChange={e => setForm(f => ({...f, target: e.target.value}))}
                style={{ background: "#070a14", border: "1px solid #4ade8044", borderRadius: 7, padding: "9px 12px", color: "#e8eaf6", fontSize: 13, width: "100%", outline: "none", fontFamily: "monospace" }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#4a5475", marginBottom: 4, textTransform: "uppercase" }}>Name (optional)</div>
            <input type="text" placeholder="z.B. Monatsgoal Mai" value={form.label} onChange={e => setForm(f => ({...f, label: e.target.value}))}
              style={{ background: "#070a14", border: "1px solid #1e2436", borderRadius: 7, padding: "9px 12px", color: "#e8eaf6", fontSize: 13, width: "100%", outline: "none" }} />
          </div>
          <button onClick={addGoal}
            style={{ background: "#4ade80", border: "none", borderRadius: 7, color: "#050810", padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
            Ziel speichern
          </button>
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: 60, color: "#2a3050", fontSize: 14 }}>
          Noch keine Ziele gesetzt. Leg los! 🎯
        </div>
      )}

      {goals.map(goal => {
        const { current, pct } = calcProgress(goal);
        const done = pct >= 100;
        const gt = GOAL_TYPES.find(g => g.key === goal.type);
        return (
          <div key={goal.id} style={{ background: "#0c0f1d", border: `1px solid ${done ? "#4ade8044" : "#1a1f35"}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: done ? "#4ade80" : "#e8eaf6", marginBottom: 3 }}>
                  {done && "✓ "}{goal.label}
                </div>
                <div style={{ fontSize: 11, color: "#4a5475" }}>{gt?.label}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: done ? "#4ade80" : "#e8eaf6", fontFamily: "monospace" }}>
                    {current}{goal.unit && ` ${goal.unit}`}
                  </div>
                  <div style={{ fontSize: 11, color: "#4a5475" }}>von {goal.target}{goal.unit && ` ${goal.unit}`}</div>
                </div>
                <button onClick={() => deleteGoal(goal.id)}
                  style={{ background: "transparent", border: "1px solid #2a1a1a", borderRadius: 6, color: "#f43f5e66", padding: "5px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>
            </div>
            <div style={{ background: "#070a14", borderRadius: 6, height: 10, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: done ? "#4ade80" : pct > 70 ? "#facc15" : "#4ade8088", borderRadius: 6, transition: "width 0.5s" }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: done ? "#4ade80" : "#4a5475" }}>
              {done ? "Ziel erreicht! 🎉" : `${pct}% — noch ${parseFloat((parseFloat(goal.target) - current).toFixed(1))}${goal.unit ? ` ${goal.unit}` : ""} bis zum Ziel`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
const NAV = [
  { key: "dashboard", label: "Dashboard" },
  { key: "list",      label: "Einheiten" },
  { key: "analyse",   label: "Analyse" },
  { key: "uebersicht",label: "Übersicht" },
  { key: "ziele",     label: "Ziele 🎯" },
  { key: "trends",    label: "Trends 📈" },
];

export default function App() {
  const [workouts, setWorkouts] = useState([]);
  const [view, setView] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWorkouts().then(ws => { setWorkouts(ws); setLoading(false); }); }, []);
  const persist = useCallback(async ws => { setWorkouts(ws); await saveWorkouts(ws); }, []);
  const handleSave = async w => { await persist(editTarget ? workouts.map(x => x.id === w.id ? w : x) : [...workouts, w]); setShowForm(false); setEditTarget(null); };
  const handleDelete = async id => { await persist(workouts.filter(w => w.id !== id)); };
  const openAdd = () => { setEditTarget(null); setShowForm(true); };
  const openEdit = w => { setEditTarget(w); setShowForm(false); };

  return (
    <div style={{ minHeight: "100vh", background: "#070a14", color: "#e8eaf6", fontFamily: "'Inter','Helvetica Neue',sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Barlow:wght@900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #070a14; }
        ::-webkit-scrollbar-thumb { background: #1a1f35; border-radius: 4px; }
        tr:hover td { background: #ffffff05 !important; }
      `}</style>

      <div style={{ background: "#070a14ee", backdropFilter: "blur(16px)", borderBottom: "1px solid #1a1f35", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ padding: "15px 0" }}>
            <span style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 900, fontSize: 20 }}>
              LAUF<span style={{ color: "#4ade80" }}>LOG</span>
            </span>
          </div>
          <nav style={{ display: "flex", gap: 2 }}>
            {NAV.map(n => (
              <button key={n.key} onClick={() => { setView(n.key); setShowForm(false); setEditTarget(null); }}
                style={{ background: view === n.key ? "#4ade8015" : "transparent", border: view === n.key ? "1px solid #4ade8030" : "1px solid transparent", borderRadius: 8, padding: "7px 13px", color: view === n.key ? "#4ade80" : "#4a5475", cursor: "pointer", fontSize: 11, fontWeight: view === n.key ? 700 : 400, transition: "all .15s" }}>
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#2a3050" }}>Lade…</div>
        ) : (
          <>
            {(showForm || editTarget) && (
              <div style={{ marginBottom: 20 }}>
                <WorkoutForm initial={editTarget || undefined} onSave={handleSave} onCancel={() => { setShowForm(false); setEditTarget(null); }} />
              </div>
            )}
            {!showForm && !editTarget && (
              <>
                {view === "dashboard"   && <Dashboard    workouts={workouts} onAdd={openAdd} onEdit={openEdit} />}
                {view === "list"        && <WorkoutList   workouts={workouts} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} />}
                {view === "analyse"     && <AnalyseView   workouts={workouts} />}
                {view === "uebersicht"  && <UebersichtView workouts={workouts} />}
                {view === "ziele"       && <ZieleView      workouts={workouts} />}
                {view === "trends"      && <TrendsView     workouts={workouts} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
