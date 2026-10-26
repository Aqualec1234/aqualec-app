import React, { useState, useEffect, useMemo, useRef } from "react";
import { CalendarDays, ClipboardList, Users, HardHat, Plus, ChevronLeft, ChevronRight, X, Camera, ArrowLeft, LogOut, PoundSterling, Check, CheckCircle2, XCircle, MapPin, Navigation, Phone, Sun, Inbox, MoreHorizontal } from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------
   Aqualec Job Tracker
   Diary / Jobs / Customers / Team — a lightweight Commusoft-style app
   Mobile-friendly: bottom tab bar + top bar under 760px, stacked
   layouts, bottom-sheet modals, 16px inputs (no iOS zoom).
   ---------------------------------------------------------------
   Data model:
     shared "aqualec-data":
       users:     [{ id, name, colour, trade }]
       customers: [{ id, name, address, phone, createdAt }]
       jobs:      [{ id, number, kind:'quote'|'job', status, jobType,
                      priority, customerId, customer, address, phone,
                      description, assignedTo, createdAt,
                      checklist:[{id,text,done}],
                      notes:[{id, ts, date, author, text}] }]
       events:    [{ id, date, time, duration, title, jobId, assignedTo, notes }]
       seq:       { quote:n, job:n }
     shared per-job "images:<jobId>":
       [{ id, dataUrl, caption, addedBy, ts }]
     personal "current-user":
       userId string (which device/browser is "signed in" as which technician)
   ------------------------------------------------------------- */

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');`;

const TOKENS = {
  ink: "#1B222C", paper: "#EEF0EC", paper2: "#FFFFFF", line: "#D7DAD2",
  accent: "#D9480F", accent2: "#146B67", amber: "#C8871A", green: "#2F7D45",
  red: "#B3311C", slate: "#5C6773", slateLight: "#8A939C",
};

const TECH_COLOURS = ["#D9480F", "#146B67", "#8A5A2B", "#3E5C9A", "#B3311C", "#5B7A2E", "#7A4C9A", "#C8871A"];

const STATUS_META = {
  quote: { label: "Quote", colour: TOKENS.amber },
  confirmed: { label: "Confirmed", colour: TOKENS.accent2 },
  in_progress: { label: "In progress", colour: TOKENS.accent },
  complete: { label: "Ready to invoice", colour: TOKENS.green },
  invoiced: { label: "Invoiced", colour: TOKENS.slate },
};
const STATUS_ORDER = ["quote", "confirmed", "in_progress", "complete", "invoiced"];
const JOB_TYPES = { service: "Service", repair: "Repair", install: "Installation", maintenance: "Maintenance", other: "Other" };
const DEPARTMENTS = { plumbing: "Plumbing", electrical: "Electrical", building: "Building & Maintenance" };
const PRIORITY_META = {
  low: { label: "Low", colour: TOKENS.slateLight },
  normal: { label: "Normal", colour: TOKENS.accent2 },
  urgent: { label: "Urgent", colour: TOKENS.red },
};

const SAFETY_TEMPLATE = {
  intro: "Generic starting template for plumbing, heating, electrical and general building work. Review against the actual site before work begins and add any site-specific hazards below — this does not replace a site-specific assessment where one is legally required (e.g. under CDM 2015 for construction projects).",
  method: [
    "Site arrival & induction — check access, park considerately, introduce to the occupier/site contact, confirm the work area.",
    "Isolate services — turn off/isolate electrics, gas or water relevant to the task before starting; verify isolation (lock-off/tag where applicable) before touching any circuit or pipework.",
    "Protect the work area — dust sheets, barriers or cones, warning signage, protect flooring and furnishings.",
    "Carry out the works — following manufacturer instructions and current regulations (BS 7671 for electrical, Gas Safe requirements, WRAS for water systems).",
    "Test & commission — test all work before leaving (electrical testing, pressure testing, gas tightness testing as applicable).",
    "Waste & materials — dispose of waste responsibly (WEEE, hazardous waste, refrigerants) in line with company environmental policy.",
    "Clean & handover — clear the work area, remove dust sheets, explain the work to the customer, obtain sign-off.",
    "Reinstate services — restore power/water/gas and confirm systems are working correctly before leaving site.",
  ],
  hazards: [
    { hazard: "Electric shock / arc flash", who: "Operative, occupants", controls: "Isolate & prove dead before work, use insulated tools, lock-off, competent person only, RCD protection." },
    { hazard: "Scalding / burns (hot water, soldering, hot surfaces)", who: "Operative, occupants", controls: "Allow systems to cool where possible, use PPE, warning signs, controlled soldering with a fire-resistant mat." },
    { hazard: "Gas leaks / carbon monoxide", who: "Operative, occupants", controls: "Gas Safe registered engineer only, tightness testing, CO alarm checks, adequate ventilation." },
    { hazard: "Hazardous substances (flux, solder fumes, adhesives, insulation fibres, refrigerants, possible lead/asbestos in pre-2000 properties)", who: "Operative, occupants", controls: "COSHH assessment, adequate ventilation, correct PPE (gloves/mask/eye protection); stop work and arrange a specialist survey if asbestos is suspected." },
    { hazard: "Manual handling (cylinders, boilers, pipework, tools)", who: "Operative", controls: "Use trolleys or a two-person lift, correct lifting technique, avoid overreaching." },
    { hazard: "Working at height (loft access, ladders)", who: "Operative", controls: "Use a suitable ladder/step platform, maintain three points of contact, avoid overreaching, secure footing." },
    { hazard: "Slips, trips & falls", who: "Operative, occupants", controls: "Keep the work area tidy, cap cables/hoses, secure dust sheets, ensure adequate lighting." },
    { hazard: "Power & hand tools", who: "Operative", controls: "PAT-tested tools, guards fitted, correct tool for the task, PPE (eye/ear protection)." },
    { hazard: "Confined spaces (under-floor, roof voids)", who: "Operative", controls: "Assess ventilation & access before entry, avoid lone working where risk is high, confirm a means of escape." },
    { hazard: "Lone working", who: "Operative", controls: "Check-in procedure with office/family, mobile phone charged, share job location and expected finish time." },
    { hazard: "Unknown existing electrical/plumbing condition", who: "Operative", controls: "Visual inspection & safe isolation before work; treat all circuits as live until proven otherwise." },
    { hazard: "Vehicle & site access", who: "Operative, public", controls: "Park considerately, use hazard lights/cones if unloading roadside, keep the site tidy for public safety." },
  ],
  coshh: "Common substances on this type of job include flux, solder, adhesives, sealants, refrigerant gases and insulation products. Use the least hazardous product available for the task, follow the manufacturer's safety data sheet, ensure adequate ventilation, wear the PPE specified for that product, and store and dispose of substances correctly.",
  ppe: ["Safety boots", "Gloves (task-appropriate)", "Eye protection", "Hi-vis (where required)", "Dust mask / respirator (as required by task)", "Ear protection (power tools)"],
  emergency: "In case of injury, a gas smell, electric shock or fire: stop work immediately, make the area safe if it's safe to do so, call 999 if required, then contact the office/director as soon as practical and complete an incident report.",
};

const NAV_ALL = {
  today: { id: "today", label: "My day", Icon: Sun },
  diary: { id: "diary", label: "Diary", Icon: CalendarDays },
  jobs: { id: "jobs", label: "Jobs", Icon: ClipboardList },
  office: { id: "office", label: "Office", Icon: Inbox },
  customers: { id: "customers", label: "Customers", Icon: Users },
  reports: { id: "reports", label: "Reports", Icon: PoundSterling },
  team: { id: "team", label: "Team", Icon: HardHat },
};
const navIds = (showOffice) => ["today", "diary", "jobs", ...(showOffice ? ["office"] : []), "customers", "reports", "team"];

const REMINDER_KINDS = { service: "Boiler service", cp12: "Gas safety certificate (CP12)", eicr: "EICR", pat: "PAT testing", aircon: "Air con service", other: "Other" };

const pad2 = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const monthLabel = (d) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const dayLabel = (d) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (k) => fromKey(k).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const uid = () => Math.random().toString(36).slice(2, 10);

// Financial year — runs 1 April to 31 March. Change FY_START_MONTH if the company year-end differs (0 = Jan, 3 = Apr).
const FY_START_MONTH = 3;
const fyStartYear = (d) => (d.getMonth() >= FY_START_MONTH ? d.getFullYear() : d.getFullYear() - 1);
const fyLabel = (startYear) => `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
const FY_MONTH_NAME = new Date(2000, FY_START_MONTH, 1).toLocaleDateString("en-GB", { month: "long" });

// Maps — Apple Maps on iPhone/iPad, Google Maps everywhere
const isAppleMobile = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document));
const mapsLinks = (address) => {
  const q = encodeURIComponent(address);
  return { apple: `https://maps.apple.com/?daddr=${q}`, google: `https://www.google.com/maps/dir/?api=1&destination=${q}` };
};
const nextFridayKey = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + ((5 - x.getDay() + 7) % 7)); return toKey(x); };
const addMonthsKey = (key, m) => { const d = fromKey(key); d.setMonth(d.getMonth() + m); return toKey(d); };
// ---- PIN lock (per person, per device) ----
const PIN_LOCK_AFTER_MS = 15 * 60 * 1000;
const PIN_MAX_TRIES = 5;
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};
const ss = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* storage unavailable */ } },
};
const pinKey = (uid) => `aq-pin-${uid}`;
const triesKey = (uid) => `aq-pin-tries-${uid}`;
const ACTIVE_KEY = "aq-last-active"; // sessionStorage: cleared when the app is closed, so reopening asks for the PIN
const markActive = () => ss.set(ACTIVE_KEY, String(Date.now()));
const isFreshlyActive = () => { const t = Number(ss.get(ACTIVE_KEY)); return !!t && Date.now() - t < PIN_LOCK_AFTER_MS; };
async function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 150000, hash: "SHA-256" }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

// A booking's own site address, else the linked job's site address
const eventAddress = (ev, job) => (ev?.address || job?.address || "").trim();
const shortPlace = (addr) => (addr || "").split(",")[0].trim();

const telHref = (phone) => `tel:${String(phone).replace(/[^0-9+]/g, "")}`;

const seedUsers = () => [{ id: uid(), name: "Jack Moore", colour: TECH_COLOURS[0], trade: "Director / Gas Safe" }];
const DEFAULT_DATA = () => ({ users: seedUsers(), customers: [], jobs: [], events: [], seq: { quote: 0, job: 0 } });

function formatNumber(kind, year, n) {
  const prefix = kind === "quote" ? "QT" : "JB";
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

function compressImage(file, maxW = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const GLOBAL_CSS = `
  ${FONT_IMPORT}
  * { box-sizing: border-box; }
  button { font-family: Inter, sans-serif; cursor: pointer; }
  .btn { border: 1px solid ${TOKENS.line}; background: ${TOKENS.paper2}; color: ${TOKENS.ink}; border-radius: 7px; padding: 9px 14px; font-size: 13.5px; font-weight: 600; transition: all .12s ease; min-height: 38px; }
  .btn:hover { border-color: ${TOKENS.ink}; }
  .btn:disabled { opacity: .45; cursor: not-allowed; }
  .btn-primary { background: ${TOKENS.accent}; border-color: ${TOKENS.accent}; color: white; }
  .btn-primary:hover { background: #C13F0B; }
  .btn-ghost { border: none; background: transparent; color: ${TOKENS.slate}; min-height: auto; }
  .btn-ghost:hover { color: ${TOKENS.ink}; }
  input, textarea, select { font-family: Inter, sans-serif; border: 1px solid ${TOKENS.line}; border-radius: 6px; padding: 10px 11px; font-size: 16px; background: white; color: ${TOKENS.ink}; width: 100%; }
  input:focus, textarea:focus, select:focus { outline: 2px solid ${TOKENS.accent2}; outline-offset: 0; border-color: transparent; }
  label { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: ${TOKENS.slateLight}; display:block; margin-bottom: 4px; }
  .field { margin-bottom: 12px; }
  .scrollbar::-webkit-scrollbar { width: 8px; }
  .scrollbar::-webkit-scrollbar-thumb { background: ${TOKENS.line}; border-radius: 8px; }
  .ticket { font-family: 'IBM Plex Mono', monospace; }

  .app-shell { display:flex; }
  .sidebar-desktop { display:flex; }
  .mobile-topbar, .mobile-tabbar { display:none; }
  .main-content { padding: 22px 28px; }
  .diary-layout { display:flex; gap:22px; }
  .diary-panel { width:310px; flex-shrink:0; }
  .customers-layout { display:flex; gap:22px; }
  .customers-side { width:280px; flex-shrink:0; }
  .job-row { display:flex; align-items:center; gap:14px; }
  .job-row-main { flex:1; min-width:0; }
  .modal-overlay { position:fixed; inset:0; background:rgba(20,24,29,0.45); display:flex; align-items:center; justify-content:center; z-index:50; }
  .modal-box { background:white; border-radius:12px; padding:22px; width:460px; max-height:85vh; overflow-y:auto; }
  .cal-cell { min-height:92px; }

  @media (max-width: 760px) {
    .app-shell { flex-direction: column; border-radius:0 !important; border-left:none !important; border-right:none !important; }
    .sidebar-desktop { display:none !important; }
    .mobile-topbar { display:flex; align-items:center; justify-content:space-between; gap:10px; padding: 10px 14px; background:${TOKENS.ink}; color:white; position:sticky; top:0; z-index:30; }
    .mobile-tabbar { display:flex; position:sticky; bottom:0; background:${TOKENS.ink}; border-top:1px solid rgba(255,255,255,0.1); z-index:30; padding-bottom: env(safe-area-inset-bottom, 0); }
    .main-content { padding: 14px 14px 20px !important; }
    .diary-layout { flex-direction: column; }
    .diary-panel { width: 100% !important; }
    .customers-layout { flex-direction: column; }
    .customers-side { width: 100% !important; order: -1; }
    .job-row { flex-wrap: wrap; }
    .modal-overlay { align-items: flex-end; padding: 0; }
    .modal-box { width: 100% !important; border-radius: 16px 16px 0 0 !important; max-height: 92vh; padding: 18px; }
    .cal-cell { min-height: 60px !important; padding: 5px !important; }
    .hide-mobile { display: none !important; }
  }
`;

/* ---------------------------------------------------------------
   DB <-> UI shape helpers (Postgres uses snake_case, the UI
   components use camelCase — same shape as the earlier prototype).
   ------------------------------------------------------------- */
function jobFromDb(row) {
  return {
    id: row.id, number: row.number, kind: row.kind, status: row.status,
    jobType: row.job_type, priority: row.priority, customerId: row.customer_id,
    department: row.department || "plumbing", projectName: row.project_name || "",
    customer: row.customer, address: row.address, phone: row.phone, description: row.description,
    assignedTo: row.assigned_to, createdAt: row.created_at,
    checklist: row.checklist || [], notes: row.notes || [],
    safety: row.safety || { signedOff: false, signedBy: null, signedAt: null, siteNotes: "" },
    finance: row.finance || { labour: null, materials: null, invoice: null },
  };
}
function eventFromDb(row) {
  return { id: row.id, date: row.date, time: row.time, duration: row.duration, title: row.title, jobId: row.job_id, assignedTo: row.assigned_to, notes: row.notes, outcome: row.outcome || null, outcomeNote: row.outcome_note || "", kind: row.kind || "visit", details: row.details || null, address: row.address || "", signaturePath: row.signature_path || null, signedName: row.signed_name || "" };
}
function reminderFromDb(r) {
  return { id: r.id, customerId: r.customer_id, jobId: r.job_id, customer: r.customer || "", address: r.address || "", phone: r.phone || "", kind: r.kind, dueDate: r.due_date, notes: r.notes || "", done: r.done };
}
function toDbJob(patch) {
  const map = { assignedTo: "assigned_to", jobType: "job_type", customerId: "customer_id", projectName: "project_name" };
  const out = {};
  for (const [k, v] of Object.entries(patch)) out[map[k] || k] = v;
  return out;
}
function toDbEvent(patch) {
  const map = { assignedTo: "assigned_to", jobId: "job_id", outcomeNote: "outcome_note", signaturePath: "signature_path", signedName: "signed_name" };
  const out = {};
  for (const [k, v] of Object.entries(patch)) out[map[k] || k] = v;
  return out;
}

// Captured before Supabase tidies the URL, so a password-reset link always opens the "set new password" screen
const OPENED_FROM_RESET_LINK = typeof window !== "undefined" && /type=recovery/.test(window.location.hash + window.location.search);

export default function App() {
  const [recovery, setRecovery] = useState(OPENED_FROM_RESET_LINK);
  const [pinState, setPinState] = useState("checking"); // checking | setup | locked | unlocked
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(undefined); // undefined = checking/none yet
  const [profiles, setProfiles] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const jobsRef = useRef([]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  const [view, setView] = useState("today");
  const [today] = useState(new Date());
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(toKey(new Date()));
  const [activeTechs, setActiveTechs] = useState(null);
  const [jobModal, setJobModal] = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const [logWorkModal, setLogWorkModal] = useState(null);
  const [openJobId, setOpenJobId] = useState(null);
  const [openCustomerId, setOpenCustomerId] = useState(null);
  const [jobFilter, setJobFilter] = useState("open");
  const [jobSearch, setJobSearch] = useState("");
  const [images, setImages] = useState({});
  const [printJobId, setPrintJobId] = useState(null);
  const [outcomeModal, setOutcomeModal] = useState(null);
  const [officeModal, setOfficeModal] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetEventId, setSheetEventId] = useState(null);

  // ---- auth session ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => { if (event === "PASSWORD_RECOVERY") setRecovery(true); setSession(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- profile (per-person record linked to the login) ----
  useEffect(() => {
    if (!session) { setProfile(session === null ? null : undefined); return; }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(data || null);
    })();
  }, [session]);

  // decide whether the PIN screen is needed whenever the signed-in person changes
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setPinState("checking"); return; }
    if (!ls.get(pinKey(uid))) setPinState("setup");
    else setPinState(isFreshlyActive() ? "unlocked" : "locked");
  }, [session?.user?.id]);

  // lock after 15 minutes without use
  useEffect(() => {
    if (pinState !== "unlocked") return;
    markActive();
    let last = 0;
    const onActivity = () => { const n = Date.now(); if (n - last > 15000) { last = n; markActive(); } };
    const check = () => { if (!isFreshlyActive()) setPinState("locked"); };
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    ["pointerdown", "keydown", "scroll"].forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(check, 30000);
    return () => {
      ["pointerdown", "keydown", "scroll"].forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, [pinState]);

  const fetchProfiles = async () => { const { data } = await supabase.from("profiles").select("*").order("name"); setProfiles(data || []); };
  const fetchSubcontractors = async () => { const { data } = await supabase.from("subcontractors").select("*").order("name"); setSubcontractors(data || []); };
  const fetchCustomers = async () => { const { data } = await supabase.from("customers").select("*").order("name"); setCustomers(data || []); };
  const fetchJobs = async () => { const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }); setJobs((data || []).map(jobFromDb)); };
  const fetchEvents = async () => { const { data } = await supabase.from("events").select("*").order("date"); setEvents((data || []).map(eventFromDb)); };
  const fetchReminders = async () => { const { data } = await supabase.from("reminders").select("*").order("due_date"); setReminders((data || []).map(reminderFromDb)); };
  const loadAll = async () => { setDataLoading((d) => d && true); await Promise.all([fetchProfiles(), fetchSubcontractors(), fetchCustomers(), fetchJobs(), fetchEvents(), fetchReminders()]); setDataLoading(false); };

  useEffect(() => {
    if (!profile) return;
    loadAll();
    const onVisible = () => { if (document.visibilityState === "visible") loadAll(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const team = useMemo(() => profiles.filter((p) => p.approved), [profiles]);
  const assignees = useMemo(() => [
    ...team.map((p) => ({ ...p, isSub: false })),
    ...subcontractors.map((s) => ({ ...s, isSub: true })),
  ], [team, subcontractors]);
  const userById = useMemo(() => Object.fromEntries(assignees.map((u) => [u.id, u])), [assignees]);
  const jobById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])), [jobs]);
  const customerById = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);

  const me = useMemo(() => profiles.find((p) => p.id === profile?.id) || profile, [profiles, profile]);
  const isAdmin = !!me?.is_admin;
  const officeAdmin = team.find((p) => p.is_admin) || null;
  const approvers = team.filter((p) => p.can_approve);
  const noAdminsYet = !officeAdmin;
  const showOffice = isAdmin || noAdminsYet;

  const visibleTechs = activeTechs ?? assignees.map((u) => u.id);
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!visibleTechs.includes(ev.assignedTo)) continue;
      (map[ev.date] ||= []).push(ev);
    }
    for (const k in map) map[k].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    return map;
  }, [events, visibleTechs]);

  const signOut = async () => { ss.del(ACTIVE_KEY); await supabase.auth.signOut(); setView("today"); };
  const forgetPinAndSignOut = async () => { if (session?.user?.id) { ls.del(pinKey(session.user.id)); ls.del(triesKey(session.user.id)); } await signOut(); };

  // ---- team management ----
  const updateProfile = async (id, patch) => {
    setSaveState("saving");
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    if (patch.is_admin) {
      // hand any waiting, unassigned office tasks to the new office admin
      await supabase.from("events").update({ assigned_to: id }).like("kind", "office%").is("assigned_to", null).is("outcome", null);
      await fetchEvents();
    }
    await fetchProfiles();
    setSaveState("saved");
  };
  const removeProfile = async (id) => {
    setSaveState("saving");
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchProfiles();
    setSaveState("saved");
  };
  const addSubcontractor = async (name, trade) => {
    setSaveState("saving");
    const colour = TECH_COLOURS[(profiles.length + subcontractors.length) % TECH_COLOURS.length];
    const { error } = await supabase.from("subcontractors").insert({ name, trade, colour });
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchSubcontractors();
    setSaveState("saved");
  };
  const updateSubcontractor = async (id, patch) => {
    setSaveState("saving");
    const { error } = await supabase.from("subcontractors").update(patch).eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchSubcontractors();
    setSaveState("saved");
  };
  const removeSubcontractor = async (id) => {
    setSaveState("saving");
    const { error } = await supabase.from("subcontractors").delete().eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchSubcontractors();
    setSaveState("saved");
  };

  // ---- customers ----
  const addCustomer = async (name, address, phone) => {
    setSaveState("saving");
    const { error } = await supabase.from("customers").insert({ name, address, phone });
    if (error) { setSaveState("error"); return; }
    await fetchCustomers();
    setSaveState("saved");
  };
  const removeCustomer = async (id) => {
    setSaveState("saving");
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { setSaveState("error"); return; }
    await fetchCustomers();
    setSaveState("saved");
  };

  // ---- jobs ----
  const createJob = async (form) => {
    setSaveState("saving");
    try {
      const kind = form.kind;
      const { data: n, error: seqErr } = await supabase.rpc("next_job_number", { p_kind: kind });
      if (seqErr) throw seqErr;
      const number = formatNumber(kind, new Date().getFullYear(), n);
      let customerId = form.customerId;
      if (!customerId) {
        const { data: newCust, error: custErr } = await supabase.from("customers").insert({ name: form.customer, address: form.customerAddress ?? form.address, phone: form.phone }).select().single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }
      const { data: newJob, error: jobErr } = await supabase.from("jobs").insert({
        number, kind, status: kind === "quote" ? "quote" : "confirmed",
        job_type: form.jobType, priority: form.priority, department: form.department || "plumbing", project_name: form.projectName || null, customer_id: customerId,
        customer: form.customer, address: form.address, phone: form.phone,
        description: form.description, assigned_to: form.assignedTo || null,
      }).select().single();
      if (jobErr) throw jobErr;
      await Promise.all([fetchJobs(), fetchCustomers()]);
      setSaveState("saved");
      return { jobId: newJob.id, number: newJob.number };
    } catch (e) {
      console.error(e);
      setSaveState("error");
      return {};
    }
  };

  const updateJob = async (id, patch) => {
    if (patch.status === "invoiced") {
      const current = jobsRef.current.find((j) => j.id === id);
      const fin = patch.finance || current?.finance || {};
      if (!fin.invoicedAt) patch = { ...patch, finance: { ...fin, invoicedAt: new Date().toISOString() } };
    }
    setSaveState("saving");
    const { error } = await supabase.from("jobs").update(toDbJob(patch)).eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    setSaveState("saved");
  };

  const addJobNote = async (id, text, date, extra = {}) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (!job) return;
    const notes = [...job.notes, { id: uid(), ts: new Date().toISOString(), date: date || toKey(new Date()), author: profile?.name || "Unknown", text, ...extra }];
    await updateJob(id, { notes });
  };
  const addChecklistItem = async (jobId, text) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;
    await updateJob(jobId, { checklist: [...(job.checklist || []), { id: uid(), text, done: false }] });
  };
  const toggleChecklistItem = async (jobId, itemId) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;
    await updateJob(jobId, { checklist: job.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) });
  };
  const removeChecklistItem = async (jobId, itemId) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;
    await updateJob(jobId, { checklist: job.checklist.filter((c) => c.id !== itemId) });
  };
  const updateJobSafety = async (jobId, patch) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;
    await updateJob(jobId, { safety: { ...(job.safety || {}), ...patch } });
  };
  const updateJobFinance = async (jobId, patch) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;
    await updateJob(jobId, { finance: { ...(job.finance || {}), ...patch } });
  };
  const deleteJob = async (id) => {
    setSaveState("saving");
    try {
      const { data: files } = await supabase.storage.from("job-photos").list(id, { limit: 200 });
      if (files && files.length) {
        await supabase.storage.from("job-photos").remove(files.map((f) => `${id}/${f.name}`));
      }
    } catch (e) { /* non-fatal — continue deleting the job even if photo cleanup fails */ }
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return false; }
    setJobs((js) => js.filter((j) => j.id !== id));
    setSaveState("saved");
    return true;
  };

  const convertQuoteToJob = async (id) => {
    const { data: n, error: seqErr } = await supabase.rpc("next_job_number", { p_kind: "job" });
    if (seqErr) { console.error(seqErr); return; }
    const number = formatNumber("job", new Date().getFullYear(), n);
    await updateJob(id, { kind: "job", status: "confirmed", number });
  };

  // ---- events ----
  const createEvent = async (form) => {
    setSaveState("saving");
    const { error } = await supabase.from("events").insert(toDbEvent(form));
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchEvents();
    setSaveState("saved");
  };
  const updateEvent = async (id, patch) => {
    setSaveState("saving");
    const { error } = await supabase.from("events").update(toDbEvent(patch)).eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchEvents();
    setSaveState("saved");
  };
  const deleteEvent = async (id) => {
    setSaveState("saving");
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchEvents();
    setSaveState("saved");
  };
  // ---- reminders ----
  const addReminder = async (r) => {
    setSaveState("saving");
    const { error } = await supabase.from("reminders").insert({ customer_id: r.customerId || null, job_id: r.jobId || null, customer: r.customer || null, address: r.address || null, phone: r.phone || null, kind: r.kind, due_date: r.dueDate, notes: r.notes || null });
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchReminders();
    setSaveState("saved");
  };
  const updateReminder = async (id, patch) => {
    setSaveState("saving");
    const { error } = await supabase.from("reminders").update(patch).eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchReminders();
    setSaveState("saved");
  };
  const removeReminder = async (id) => {
    setSaveState("saving");
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    await fetchReminders();
    setSaveState("saved");
  };

  // ---- office tasks: land on the office admin's diary on the coming Friday ----
  const createOfficeTask = async (kind, job, details) => {
    const { data: existing } = await supabase.from("events").select("id").eq("job_id", job.id).eq("kind", kind).is("outcome", null).limit(1);
    if (existing && existing.length) return;
    const label = kind === "office_invoice" ? "Send invoice" : "Price & send quote";
    const { error } = await supabase.from("events").insert(toDbEvent({
      kind, title: `${label} — ${job.number} · ${job.customer}`, date: nextFridayKey(), time: "", duration: "",
      assignedTo: officeAdmin?.id || null, jobId: job.id, notes: details.request || "", details,
    }));
    if (error) console.error(error);
  };

  const setEventOutcome = async (eventId, p) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const jobId = ev.jobId || p.linkJobId || null;
    const job = jobId ? jobsRef.current.find((j) => j.id === jobId) : null;
    setSaveState("saving");

    let signaturePath = null;
    if (p.signatureBlob) {
      const path = `signatures/${eventId}.png`;
      const { error } = await supabase.storage.from("job-photos").upload(path, p.signatureBlob, { contentType: "image/png", upsert: true });
      if (error) console.error(error); else signaturePath = path;
    }
    const patch = { outcome: p.outcome, outcomeNote: p.note, details: p.details || null };
    if (jobId && !ev.jobId) patch.jobId = jobId;
    if (signaturePath) { patch.signaturePath = signaturePath; patch.signedName = p.signedName || null; }
    const { error } = await supabase.from("events").update(toDbEvent(patch)).eq("id", eventId);
    if (error) { console.error(error); setSaveState("error"); return; }

    if (job) {
      const d = p.details || {};
      let text;
      if (p.outcome === "rejected") text = `Visit rejected — ${ev.title} (${shortDate(ev.date)})${p.note ? `: ${p.note}` : ""}${p.rebook ? " — to be rebooked." : " — not rebooked."}`;
      else if (job.kind === "quote") text = `Quote visit accepted (${shortDate(ev.date)}): ${p.note}${d.quoteBy === "office" ? " — passed to the office to price and send." : " — engineer is pricing it."}`;
      else text = `Visit accepted (${shortDate(ev.date)}): ${p.note}${d.finished ? `\nJob finished. To invoice: ${d.invoiceNotes}` : ""}${signaturePath ? `\nSigned off by ${p.signedName || "the customer"}.` : ""}`;
      await addJobNote(job.id, text, ev.date, { kind: "feedback", outcome: p.outcome, eventId });

      if (p.outcome === "completed") {
        if (job.kind === "job") {
          if (d.finished) await updateJob(job.id, { status: "complete" });
          else if (job.status === "confirmed") await updateJob(job.id, { status: "in_progress" });
        }
        if (job.kind === "quote" && d.quoteBy === "office") await createOfficeTask("office_quote", job, { request: p.note, fromEngineer: me?.name, fromEventId: ev.id });
        if (job.kind === "job" && d.finished) await createOfficeTask("office_invoice", job, { request: d.invoiceNotes, fromEngineer: me?.name, fromEventId: ev.id });
      }
      if (p.reminder) await addReminder({ ...p.reminder, jobId: job.id, customerId: job.customerId, customer: job.customer, address: job.address, phone: job.phone });
    }
    await fetchEvents();
    setSaveState("saved");
  };

  const completeOfficeTask = async (ev, { amount, note }) => {
    const sentLabel = ev.kind === "office_invoice" ? "Invoice sent" : "Quote sent";
    await updateEvent(ev.id, { outcome: "completed", outcomeNote: note || sentLabel, details: { ...(ev.details || {}), amount: amount ?? null, doneBy: me?.name } });
    const job = ev.jobId ? jobsRef.current.find((j) => j.id === ev.jobId) : null;
    if (!job) return;
    await addJobNote(job.id, `${sentLabel}${amount != null ? ` — ${money(amount)}` : ""}${note ? ` (${note})` : ""}`, toKey(new Date()), { kind: "office" });
    const fin = job.finance || {};
    if (ev.kind === "office_invoice") await updateJob(job.id, { status: "invoiced", finance: { ...fin, ...(amount != null ? { invoice: amount } : {}) } });
    else if (amount != null) await updateJob(job.id, { finance: { ...fin, quoted: amount } });
  };

  // ---- photos (Supabase Storage, private bucket "job-photos") ----
  const loadImages = async (jobId, force = false) => {
    if (images[jobId] && !force) return;
    const { data: files, error } = await supabase.storage.from("job-photos").list(jobId, { limit: 200, sortBy: { column: "created_at", order: "asc" } });
    if (error || !files) { setImages((m) => ({ ...m, [jobId]: [] })); return; }
    const withUrls = await Promise.all(files.map(async (f) => {
      const { data: signed } = await supabase.storage.from("job-photos").createSignedUrl(`${jobId}/${f.name}`, 3600);
      return { id: f.name, url: signed?.signedUrl, ts: f.created_at };
    }));
    setImages((m) => ({ ...m, [jobId]: withUrls }));
  };
  const addImages = async (jobId, fileList) => {
    for (const file of Array.from(fileList)) {
      const blob = await compressImage(file);
      const path = `${jobId}/${uid()}.jpg`;
      await supabase.storage.from("job-photos").upload(path, blob, { contentType: "image/jpeg" });
    }
    await loadImages(jobId, true);
  };
  const removeImage = async (jobId, fileName) => {
    await supabase.storage.from("job-photos").remove([`${jobId}/${fileName}`]);
    await loadImages(jobId, true);
  };

  const openJobFromAnywhere = (id) => { setSheetEventId(null); setOpenJobId(id); setView("jobs"); };
  const markOutcome = (ev, kind) => { setSheetEventId(null); if (isOfficeKind(ev.kind)) setOfficeModal({ event: ev }); else setOutcomeModal({ event: ev, kind }); };
  const openEventSheet = (ev) => setSheetEventId(ev.id);

  // ---- render states ----
  if (authLoading || session === undefined) {
    return <CentredMessage>Loading Aqualec Job Tracker…</CentredMessage>;
  }
  if (recovery && session) {
    return <NewPasswordScreen onDone={() => { setRecovery(false); setPinState(ls.get(pinKey(session.user.id)) ? "unlocked" : "setup"); if (window.location.hash) window.history.replaceState(null, "", window.location.pathname); }} />;
  }
  if (!session) {
    return <AuthGate />;
  }
  if (profile === undefined) {
    return <CentredMessage>Loading your profile…</CentredMessage>;
  }
  if (pinState === "setup" || pinState === "locked") {
    return <PinScreen mode={pinState} uid={session.user.id} email={session.user.email}
      onUnlocked={() => { markActive(); setPinState("unlocked"); }} onForgot={forgetPinAndSignOut} />;
  }
  if (pinState === "checking") {
    return <CentredMessage>Loading…</CentredMessage>;
  }
  if (profile === null) {
    return <ProfileSetup session={session} onDone={(p) => setProfile(p)} onSignOut={signOut} />;
  }
  if (!profile.approved) {
    return <AwaitingApproval profile={profile} onCheck={async () => { const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).maybeSingle(); setProfile(data || null); }} onSignOut={signOut} />;
  }
  if (dataLoading) {
    return <CentredMessage>Loading jobs, diary and customers…</CentredMessage>;
  }

  if (printJobId) {
    const pJob = jobById[printJobId];
    if (pJob) return <PrintableSafety job={pJob} customer={pJob.customerId ? customerById[pJob.customerId] : null} onClose={() => setPrintJobId(null)} />;
    setPrintJobId(null);
  }

  return (
    <div className="app-shell" style={{ fontFamily: "Inter, sans-serif", color: TOKENS.ink, background: TOKENS.paper, minHeight: "100vh", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>

      <Sidebar view={view} setView={setView} jobs={jobs} events={events} saveState={saveState} currentUser={me} onSignOut={signOut} showOffice={showOffice}
        onQuickJob={() => setJobModal({ mode: "new", kind: "job" })} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <MobileTopBar currentUser={me} saveState={saveState} onSignOut={signOut} onQuickJob={() => setJobModal({ mode: "new", kind: "job" })} />

        <div className="scrollbar main-content" style={{ flex: 1, overflowY: "auto" }}>
          {view === "diary" && (
            <DiaryView cursor={cursor} setCursor={setCursor} today={today} selectedDay={selectedDay} setSelectedDay={setSelectedDay}
              eventsByDay={eventsByDay} users={assignees} activeTechs={activeTechs} setActiveTechs={setActiveTechs}
              jobById={jobById} userById={userById}
              onNewEvent={(date) => setEventModal({ date })}
              onEditEvent={openEventSheet}
              onOpenJob={openJobFromAnywhere}
              onLogWork={(job, date) => setLogWorkModal({ job, date })}
              onMarkOutcome={markOutcome} />
          )}

          {view === "today" && (
            <MyDayView me={me} events={events} jobById={jobById} userById={userById} isAdmin={isAdmin}
              onEdit={openEventSheet} onOpenJob={openJobFromAnywhere}
              onLogWork={(job, date) => setLogWorkModal({ job, date })} onMarkOutcome={markOutcome}
              onNewEvent={(date) => setEventModal({ date })} />
          )}

          {view === "office" && (
            <OfficeView events={events} jobs={jobs} reminders={reminders} jobById={jobById} userById={userById} noAdminsYet={noAdminsYet}
              onEdit={(ev) => setEventModal({ date: ev.date, event: ev })} onOpenJob={openJobFromAnywhere}
              onMarkOutcome={markOutcome} onUpdateReminder={updateReminder} onGoTeam={() => setView("team")}
              onRaiseJob={(r) => setJobModal({ mode: "new", kind: "job", presetCustomer: r.customerId ? customerById[r.customerId] : null, presetNew: { customer: r.customer, address: r.address, phone: r.phone }, presetDescription: `${REMINDER_KINDS[r.kind] || "Service"}${r.notes ? ` — ${r.notes}` : ""}`, presetJobType: "service", reminderId: r.id })} />
          )}

          {view === "jobs" && (
            <JobsView jobs={jobs} users={assignees} userById={userById} customerById={customerById}
              jobFilter={jobFilter} setJobFilter={setJobFilter} jobSearch={jobSearch} setJobSearch={setJobSearch}
              openJobId={openJobId} setOpenJobId={setOpenJobId}
              onNewJob={(kind) => setJobModal({ mode: "new", kind })}
              onAddNote={addJobNote} onUpdateJob={updateJob} onConvert={convertQuoteToJob}
              onBookVisit={(job) => setEventModal({ date: toKey(new Date()), event: null, presetJob: job })}
              events={events} images={images} loadImages={loadImages} addImages={addImages} removeImage={removeImage}
              checklistOps={{ addChecklistItem, toggleChecklistItem, removeChecklistItem }}
              onOpenCustomer={(id) => { setOpenCustomerId(id); setView("customers"); }}
              onDeleteJob={async (id) => { const ok = await deleteJob(id); if (ok) setOpenJobId(null); }}
              currentUser={me} onUpdateSafety={updateJobSafety} onPrintSafety={(id) => setPrintJobId(id)} onUpdateFinance={updateJobFinance}
              reminderOps={{ reminders, addReminder, updateReminder, removeReminder }}
              onMarkOutcome={markOutcome} onOpenEvent={openEventSheet} />
          )}

          {view === "customers" && (
            <CustomersView customers={customers} jobs={jobs} openCustomerId={openCustomerId} setOpenCustomerId={setOpenCustomerId}
              onAdd={addCustomer} onRemove={removeCustomer}
              onOpenJob={openJobFromAnywhere}
              onNewJobForCustomer={(customer) => setJobModal({ mode: "new", kind: "job", presetCustomer: customer })} />
          )}

          {view === "reports" && <ReportsView jobs={jobs} today={today} />}

          {view === "team" && (
            <TeamView profiles={profiles} subcontractors={subcontractors} jobs={jobs} currentUserId={profile.id} canApprove={!!me?.can_approve} approvers={approvers}
              onUpdateProfile={updateProfile} onRemoveProfile={removeProfile}
              onAddSubcontractor={addSubcontractor} onUpdateSubcontractor={updateSubcontractor} onRemoveSubcontractor={removeSubcontractor} />
          )}
        </div>

        <MobileTabBar view={view} setView={setView} showOffice={showOffice} onMore={() => setMoreOpen(true)} />
      </div>

      {jobModal && (
        <JobModal modal={jobModal} users={assignees} customers={customers} currentUserId={profile.id} onClose={() => setJobModal(null)}
          onCreate={async (form) => { const { jobId } = await createJob(form); const rid = jobModal.reminderId; setJobModal(null); if (jobId) { if (rid) await updateReminder(rid, { done: true }); setOpenJobId(jobId); setView("jobs"); } }} />
      )}

      {eventModal && (
        <EventModal modal={eventModal} users={assignees} jobs={jobs} onClose={() => setEventModal(null)}
          onCreate={async (forms) => { for (const f of forms) { await createEvent(f); } setEventModal(null); }}
          onUpdate={(id, patch) => { updateEvent(id, patch); setEventModal(null); }}
          onDelete={(id) => { deleteEvent(id); setEventModal(null); }} />
      )}

      {logWorkModal && (
        <LogWorkModal modal={logWorkModal} onClose={() => setLogWorkModal(null)}
          onSave={(jobId, text, date) => { addJobNote(jobId, text, date); setLogWorkModal(null); }} />
      )}

      {outcomeModal && (
        <OutcomeModal modal={outcomeModal} jobs={jobs} officeAdminName={officeAdmin?.name} onClose={() => setOutcomeModal(null)}
          onSave={async (id, payload) => {
            const ev = events.find((e) => e.id === id);
            await setEventOutcome(id, payload);
            setOutcomeModal(null);
            if (payload.rebook && ev) setEventModal({ date: toKey(new Date()), event: null, presetJob: ev.jobId ? jobById[ev.jobId] : null, presetFrom: ev });
          }} />
      )}
      {officeModal && (
        <OfficeDoneModal modal={officeModal} job={officeModal.event.jobId ? jobById[officeModal.event.jobId] : null} onClose={() => setOfficeModal(null)}
          onSave={async (ev, vals) => { await completeOfficeTask(ev, vals); setOfficeModal(null); }} />
      )}

      {sheetEventId && (() => {
        const ev = events.find((e) => e.id === sheetEventId);
        if (!ev) return null;
        const job = ev.jobId ? jobById[ev.jobId] : null;
        return (
          <VisitSheet ev={ev} job={job} user={userById[ev.assignedTo]} onClose={() => setSheetEventId(null)}
            onEdit={() => { setSheetEventId(null); setEventModal({ date: ev.date, event: ev }); }}
            onOpenJob={openJobFromAnywhere} onMarkOutcome={markOutcome}
            onLogWork={(j, date) => { setSheetEventId(null); setLogWorkModal({ job: j, date }); }} />
        );
      })()}

      {moreOpen && (
        <MoreSheet items={mobileNav(showOffice).more.map((id) => NAV_ALL[id])} view={view} setView={setView} onClose={() => setMoreOpen(false)} />
      )}
    </div>
  );
}

const mobileNav = (showOffice) => {
  const primary = showOffice ? ["today", "diary", "jobs", "office"] : ["today", "diary", "jobs", "customers"];
  return { primary, more: navIds(showOffice).filter((id) => !primary.includes(id)) };
};

function CentredMessage({ children }) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: TOKENS.slate, background: TOKENS.paper }}>
      <style>{FONT_IMPORT}</style>
      {children}
    </div>
  );
}

/* ================= AUTH ================= */
function AuthGate() {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (err) throw err;
        setResetSent(true);
      } else if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.session) { /* auto-confirmed */ } else { setCheckEmail(true); }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        markActive(); // just typed the password — no PIN needed this time
      }
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", background: TOKENS.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{FONT_IMPORT}{`button{font-family:Inter,sans-serif;cursor:pointer;} input{font-family:Inter,sans-serif;border:1px solid #333;border-radius:6px;padding:11px;font-size:16px;width:100%;box-sizing:border-box;background:#1E2733;color:white;}`}</style>
      <div style={{ width: "100%", maxWidth: 340, color: "white", textAlign: "center" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 30 }}>AQUALEC</div>
        <div style={{ color: "#9AA3AC", fontSize: 13, marginBottom: 26, textTransform: "uppercase", letterSpacing: ".05em" }}>Team sign in</div>

        {resetSent ? (
          <div style={{ fontSize: 13.5, color: "#AEB6BD", lineHeight: 1.6 }}>
            If <strong style={{ color: "white" }}>{email}</strong> has an account, we've emailed a link to reset the password. Open it on this device — it brings you back here to choose a new one. Check your junk folder if it hasn't arrived in a few minutes.
            <button onClick={() => { setResetSent(false); setMode("signin"); setPassword(""); }} style={{ display: "block", marginTop: 16, width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700 }}>Back to sign in</button>
          </div>
        ) : checkEmail ? (
          <div style={{ fontSize: 13.5, color: "#AEB6BD", lineHeight: 1.6 }}>
            Check your email to confirm your account, then come back and sign in.
            <button onClick={() => { setCheckEmail(false); setMode("signin"); }} style={{ display: "block", marginTop: 16, width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700 }}>Back to sign in</button>
          </div>
        ) : (
          <div style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 10 }}><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {mode === "forgot" && <div style={{ fontSize: 13, color: "#AEB6BD", marginBottom: 10, lineHeight: 1.5 }}>Enter the email you sign in with and we'll send you a link to set a new password.</div>}
            {mode !== "forgot" && <div style={{ marginBottom: 10 }}><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && email && password) submit(); }} /></div>}
            {error && <div style={{ color: "#E88", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
            <button disabled={busy || !email || (mode !== "forgot" && !password)} onClick={submit} style={{ width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
              {busy ? "…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
            </button>
            {mode === "signin" && (
              <button onClick={() => { setMode("forgot"); setError(""); }} style={{ marginTop: 12, background: "none", border: "none", color: "#C9CFD4", fontSize: 13, fontWeight: 600, width: "100%", padding: "6px 0" }}>Forgot password?</button>
            )}
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} style={{ marginTop: 6, background: "none", border: "none", color: "#9AA3AC", fontSize: 12.5, width: "100%", padding: "6px 0" }}>
              {mode === "signin" ? "New team member? Create an account" : "Back to sign in"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const DARK_SCREEN_CSS = `button{font-family:Inter,sans-serif;cursor:pointer;} input{font-family:Inter,sans-serif;border:1px solid #333;border-radius:6px;padding:11px;font-size:16px;width:100%;box-sizing:border-box;background:#1E2733;color:white;}`;

function AwaitingApproval({ profile, onCheck, onSignOut }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", background: TOKENS.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{FONT_IMPORT}{DARK_SCREEN_CSS}</style>
      <div style={{ width: "100%", maxWidth: 340, color: "white", textAlign: "center" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 30 }}>AQUALEC</div>
        <div style={{ color: "#9AA3AC", fontSize: 13, marginBottom: 22, textTransform: "uppercase", letterSpacing: ".05em" }}>Waiting for approval</div>
        <div style={{ fontSize: 14, color: "#C9CFD4", lineHeight: 1.6, marginBottom: 20 }}>
          Thanks {profile.name.split(" ")[0]} — your account has been created. Jack or Jessica needs to approve it before you can see jobs and the diary. Let them know you've signed up.
        </div>
        <button disabled={busy} onClick={async () => { setBusy(true); await onCheck(); setBusy(false); }} style={{ width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>{busy ? "Checking…" : "Check again"}</button>
        <button onClick={onSignOut} style={{ marginTop: 12, background: "none", border: "none", color: "#9AA3AC", fontSize: 12.5, width: "100%" }}>Sign out</button>
      </div>
    </div>
  );
}

function PinScreen({ mode, uid, email, onUnlocked, onForgot }) {
  const [step, setStep] = useState(mode === "setup" ? "new" : "enter"); // new | confirm | enter
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = async (value) => {
    setBusy(true);
    if (step === "new") { setFirst(value); setPin(""); setStep("confirm"); setMsg(""); setBusy(false); return; }
    if (step === "confirm") {
      if (value !== first) { setMsg("Those didn't match — start again."); setFirst(""); setPin(""); setStep("new"); setBusy(false); return; }
      const salt = uid + ":" + Math.random().toString(36).slice(2);
      ls.set(pinKey(uid), JSON.stringify({ salt, hash: await hashPin(value, salt) }));
      ls.del(triesKey(uid));
      onUnlocked();
      return;
    }
    // unlock
    let rec = null; try { rec = JSON.parse(ls.get(pinKey(uid)) || "null"); } catch { rec = null; }
    if (rec && (await hashPin(value, rec.salt)) === rec.hash) { ls.del(triesKey(uid)); onUnlocked(); return; }
    const tries = Number(ls.get(triesKey(uid)) || 0) + 1;
    if (tries >= PIN_MAX_TRIES) { await onForgot(); return; }
    ls.set(triesKey(uid), String(tries));
    setMsg(`Wrong PIN — ${PIN_MAX_TRIES - tries} ${PIN_MAX_TRIES - tries === 1 ? "try" : "tries"} left before you'll need your password.`);
    setPin(""); setBusy(false);
  };

  const press = (d) => {
    if (busy) return;
    if (d === "del") { setPin((p) => p.slice(0, -1)); return; }
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) setTimeout(() => finish(next), 120);
  };

  useEffect(() => {
    const onKey = (e) => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = step === "new" ? "Create a 4-digit PIN" : step === "confirm" ? "Type your PIN again" : "Enter your PIN";
  const sub = step === "enter" ? email : "You'll use this to open the app on this phone.";
  const key = { height: 64, borderRadius: 32, border: "none", background: "rgba(255,255,255,0.08)", color: "white", fontSize: 24, fontWeight: 600 };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", background: TOKENS.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{FONT_IMPORT}{DARK_SCREEN_CSS}</style>
      <div style={{ width: "100%", maxWidth: 300, color: "white", textAlign: "center" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28 }}>AQUALEC</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 14 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "#9AA3AC", marginTop: 4, minHeight: 18 }}>{sub}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, margin: "22px 0 10px" }}>
          {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #C9CFD4", background: i < pin.length ? "#C9CFD4" : "transparent" }} />)}
        </div>
        <div style={{ fontSize: 12.5, color: "#E3B565", minHeight: 36, lineHeight: 1.4 }}>{msg}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 6 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} style={key} onClick={() => press(d)}>{d}</button>)}
          <span />
          <button style={key} onClick={() => press("0")}>0</button>
          <button style={{ ...key, background: "none", fontSize: 15 }} onClick={() => press("del")} aria-label="Delete">⌫</button>
        </div>
        <button onClick={onForgot} style={{ marginTop: 22, background: "none", border: "none", color: "#9AA3AC", fontSize: 12.5, width: "100%" }}>
          {step === "enter" ? "Forgotten your PIN? Sign in with your password" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

function NewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async () => {
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (!err) markActive();
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDone(true);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", background: TOKENS.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{FONT_IMPORT}{`button{font-family:Inter,sans-serif;cursor:pointer;} input{font-family:Inter,sans-serif;border:1px solid #333;border-radius:6px;padding:11px;font-size:16px;width:100%;box-sizing:border-box;background:#1E2733;color:white;}`}</style>
      <div style={{ width: "100%", maxWidth: 340, color: "white", textAlign: "center" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 30 }}>AQUALEC</div>
        <div style={{ color: "#9AA3AC", fontSize: 13, marginBottom: 22, textTransform: "uppercase", letterSpacing: ".05em" }}>Set a new password</div>
        {done ? (
          <div style={{ fontSize: 13.5, color: "#AEB6BD", lineHeight: 1.6 }}>
            Password changed.
            <button onClick={onDone} style={{ display: "block", marginTop: 16, width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700 }}>Continue to the app</button>
          </div>
        ) : (
          <div style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 10 }}><input type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div style={{ marginBottom: 10 }}><input type="password" autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            {(tooShort || mismatch) && <div style={{ color: "#E3B565", fontSize: 12.5, marginBottom: 10 }}>{tooShort ? "Use at least 8 characters." : "The two passwords don't match."}</div>}
            {error && <div style={{ color: "#E88", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
            <button disabled={busy || password.length < 8 || confirm !== password} onClick={submit} style={{ width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700, opacity: busy || password.length < 8 || confirm !== password ? 0.6 : 1 }}>
              {busy ? "…" : "Save new password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileSetup({ session, onDone, onSignOut }) {
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [colour, setColour] = useState(TECH_COLOURS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setError("");
    const { data, error: err } = await supabase.from("profiles").insert({ id: session.user.id, name: name.trim(), trade: trade.trim(), colour }).select().single();
    setBusy(false);
    if (err) { setError(err.message); return; }
    onDone(data);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", background: TOKENS.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{FONT_IMPORT}{`button{font-family:Inter,sans-serif;cursor:pointer;} input{font-family:Inter,sans-serif;border:1px solid #333;border-radius:6px;padding:11px;font-size:16px;width:100%;box-sizing:border-box;background:#1E2733;color:white;}`}</style>
      <div style={{ width: "100%", maxWidth: 340, color: "white" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, textAlign: "center" }}>Welcome</div>
        <div style={{ color: "#9AA3AC", fontSize: 13, marginBottom: 22, textAlign: "center" }}>Set up your profile — {session.user.email}</div>
        <div style={{ marginBottom: 10 }}><input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div style={{ marginBottom: 12 }}><input placeholder="Trade / role" value={trade} onChange={(e) => setTrade(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {TECH_COLOURS.map((c) => (
            <button key={c} onClick={() => setColour(c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: colour === c ? "2px solid white" : "2px solid transparent" }} />
          ))}
        </div>
        {error && <div style={{ color: "#E88", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <button disabled={busy || !name.trim()} onClick={submit} style={{ width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "Start using the app"}</button>
        <button onClick={onSignOut} style={{ marginTop: 12, background: "none", border: "none", color: "#9AA3AC", fontSize: 12.5, width: "100%" }}>Sign out</button>
      </div>
    </div>
  );
}

/* ================= DESKTOP SIDEBAR ================= */
function Sidebar({ view, setView, jobs, events, saveState, currentUser, onSignOut, onQuickJob, showOffice }) {
  const openQuotes = jobs.filter((j) => j.kind === "quote" && j.status === "quote").length;
  const inProgress = jobs.filter((j) => j.status === "in_progress").length;
  const readyToInvoice = jobs.filter((j) => j.status === "complete").length;
  const todayKey = toKey(new Date());
  const todayCount = events.filter((e) => e.date === todayKey).length;

  const myToday = events.filter((e) => e.date === todayKey && e.assignedTo === currentUser?.id && !e.outcome).length;
  const officeOpen = events.filter((e) => isOfficeKind(e.kind) && !e.outcome).length;
  const subs = {
    today: `${myToday} left today`, diary: `${todayCount} today`, jobs: `${inProgress} active`,
    office: officeOpen ? `${officeOpen} to send` : "All sent",
  };
  const items = navIds(showOffice).map((id) => ({ id, label: id === "jobs" ? "Jobs & Quotes" : NAV_ALL[id].label, sub: subs[id] || null }));

  return (
    <div className="sidebar-desktop" style={{ width: 210, background: TOKENS.ink, color: "#EDEFEA", flexDirection: "column", padding: "20px 0", flexShrink: 0 }}>
      <div style={{ padding: "0 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: ".01em", lineHeight: 1 }}>AQUALEC</div>
        <div style={{ fontSize: 11, color: "#9AA3AC", marginTop: 3, letterSpacing: ".04em", textTransform: "uppercase" }}>Job Tracker</div>
      </div>

      <div style={{ padding: "0 20px 14px" }}>
        <button onClick={onQuickJob} className="btn-primary" style={{ width: "100%", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={15} /> Quick job number
        </button>
      </div>

      <div style={{ flex: 1 }}>
        {items.map((it) => (
          <button key={it.id} className="btn-ghost" onClick={() => setView(it.id)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 20px", color: view === it.id ? "white" : "#AEB6BD", background: view === it.id ? "rgba(217,72,15,0.18)" : "transparent", borderLeft: view === it.id ? `3px solid ${TOKENS.accent}` : "3px solid transparent", fontWeight: 600, fontSize: 14 }}>
            {it.label}
            {it.sub && <div style={{ fontSize: 11, color: "#8A93A0", fontWeight: 500, marginTop: 1 }}>{it.sub}</div>}
          </button>
        ))}
        {openQuotes > 0 && <div style={{ margin: "14px 20px 0", padding: "8px 10px", background: "rgba(200,135,26,0.15)", borderRadius: 6, fontSize: 11.5, color: "#E3B565" }}>{openQuotes} quote{openQuotes !== 1 ? "s" : ""} awaiting a decision</div>}
        {readyToInvoice > 0 && <div style={{ margin: "8px 20px 0", padding: "8px 10px", background: "rgba(47,125,69,0.18)", borderRadius: 6, fontSize: 11.5, color: "#6FCB8A" }}>{readyToInvoice} job{readyToInvoice !== 1 ? "s" : ""} ready to invoice</div>}
      </div>

      <div style={{ padding: "12px 20px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: currentUser.colour, display: "inline-block" }} />
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{currentUser.name}</div>
          </div>
        )}
        <button className="btn-ghost" onClick={onSignOut} style={{ fontSize: 11.5, padding: 0, color: "#8A93A0" }}>Sign out</button>
        <div style={{ fontSize: 10.5, color: "#6E7680", marginTop: 8 }}>{saveState === "saving" ? "Syncing…" : saveState === "error" ? "Sync failed" : "Synced · shared with your team"}</div>
      </div>
    </div>
  );
}

/* ================= MOBILE CHROME ================= */
function MobileTopBar({ currentUser, saveState, onSignOut, onQuickJob }) {
  return (
    <div className="mobile-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>AQUALEC</div>
        {currentUser && (
          <button onClick={onSignOut} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 20, padding: "4px 9px 4px 6px", color: "white", fontSize: 11.5, fontWeight: 600, overflow: "hidden" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: currentUser.colour, display: "inline-block", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.name}</span>
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: saveState === "error" ? TOKENS.red : TOKENS.accent2, flexShrink: 0 }} title={saveState === "saving" ? "Syncing…" : "Synced"} />
        <button onClick={onQuickJob} style={{ display: "flex", alignItems: "center", gap: 5, background: TOKENS.accent, border: "none", color: "white", borderRadius: 20, padding: "7px 12px", fontWeight: 700, fontSize: 12.5 }}>
          <Plus size={14} /> Job
        </button>
      </div>
    </div>
  );
}

function MobileTabBar({ view, setView, showOffice, onMore }) {
  const { primary, more } = mobileNav(showOffice);
  const tab = (id, label, Icon, active, onClick) => (
    <button key={id} onClick={onClick} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 4px 8px", color: active ? "white" : "#8A93A0" }}>
      <Icon size={20} color={active ? TOKENS.accent : "#8A93A0"} strokeWidth={active ? 2.3 : 2} />
      <span style={{ fontSize: 10.5, fontWeight: 600 }}>{label}</span>
    </button>
  );
  return (
    <div className="mobile-tabbar">
      {primary.map((id) => tab(id, NAV_ALL[id].label, NAV_ALL[id].Icon, view === id, () => setView(id)))}
      {tab("more", "More", MoreHorizontal, more.includes(view), onMore)}
    </div>
  );
}

/* ================= ADDRESS / MAPS ================= */
function AddressLinks({ address, phone, compact }) {
  if (!address && !phone) return null;
  const pill = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, padding: "8px 12px", borderRadius: 20, textDecoration: "none", border: `1px solid ${TOKENS.line}`, background: "white", color: TOKENS.accent2, minHeight: 38 };
  const links = address ? mapsLinks(address) : null;
  return (
    <div>
      {address && (
        <div style={{ fontSize: compact ? 12 : 13.5, color: TOKENS.slate, marginBottom: 6, display: "flex", gap: 5, alignItems: "flex-start" }}>
          <MapPin size={compact ? 13 : 15} style={{ flexShrink: 0, marginTop: 2 }} />{address}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {links && isAppleMobile() && <a href={links.apple} target="_blank" rel="noopener noreferrer" style={pill}><Navigation size={14} /> Apple Maps</a>}
        {links && <a href={links.google} target="_blank" rel="noopener noreferrer" style={pill}><Navigation size={14} /> Google Maps</a>}
        {phone && <a href={telHref(phone)} style={pill}><Phone size={14} /> {compact ? "Call" : phone}</a>}
      </div>
    </div>
  );
}

/* ================= DIARY ================= */
function DiaryView({ cursor, setCursor, today, selectedDay, setSelectedDay, eventsByDay, users, activeTechs, setActiveTechs, jobById, userById, onNewEvent, onEditEvent, onOpenJob, onLogWork, onMarkOutcome }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const toggleTech = (id) => {
    setActiveTechs((cur) => {
      const base = cur ?? users.map((u) => u.id);
      if (base.includes(id)) { const next = base.filter((x) => x !== id); return next.length ? next : []; }
      return [...base, id];
    });
  };

  const dayEvents = eventsByDay[selectedDay] || [];
  const selDateObj = fromKey(selectedDay);

  return (
    <div className="diary-layout">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={15} /></button>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, lineHeight: 1.1 }}>{monthLabel(cursor)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.accent2, letterSpacing: ".03em" }}>FY {fyLabel(fyStartYear(cursor))}</div>
            </div>
            <button className="btn" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={15} /></button>
            <button className="btn hide-mobile" onClick={() => { setCursor(new Date()); setSelectedDay(toKey(new Date())); }}>Today</button>
          </div>
          <button className="btn btn-primary hide-mobile" onClick={() => onNewEvent(selectedDay)}>+ Book visit</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {users.map((u) => {
            const on = (activeTechs ?? users.map((x) => x.id)).includes(u.id);
            return (
              <button key={u.id} onClick={() => toggleTech(u.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, border: `1px solid ${on ? u.colour : TOKENS.line}`, background: on ? `${u.colour}1A` : "white", fontSize: 12.5, fontWeight: 600, color: on ? TOKENS.ink : TOKENS.slateLight }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: u.colour, display: "inline-block" }} />
                {u.name}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, fontSize: 10.5, color: TOKENS.slateLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} style={{ textAlign: "center" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-cell" />;
            const key = toKey(d);
            const isToday = toKey(today) === key;
            const isSel = key === selectedDay;
            const evs = eventsByDay[key] || [];
            return (
              <button key={i} className="cal-cell" onClick={() => setSelectedDay(key)}
                style={{ textAlign: "left", padding: 6, borderRadius: 8, cursor: "pointer", background: isSel ? "white" : "rgba(255,255,255,0.55)", border: `1.5px solid ${isSel ? TOKENS.accent : isToday ? TOKENS.accent2 : "transparent"}`, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? TOKENS.accent2 : TOKENS.ink }}>{d.getDate()}</div>
                {evs.length > 0 && (
                  <div className="hide-mobile" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {evs.slice(0, 3).map((ev) => {
                      const u = userById[ev.assignedTo];
                      return (
                        <div key={ev.id} style={{ fontSize: 10, background: `${u?.colour || TOKENS.slate}22`, color: TOKENS.ink, borderRadius: 4, padding: "2px 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderLeft: `2.5px solid ${u?.colour || TOKENS.slate}` }}>
                          {ev.time ? `${ev.time} ` : ""}{ev.title}
                        </div>
                      );
                    })}
                    {evs.length > 3 && <div style={{ fontSize: 9.5, color: TOKENS.slateLight }}>+{evs.length - 3} more</div>}
                  </div>
                )}
                {evs.length > 0 && (
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {evs.slice(0, 4).map((ev) => <span key={ev.id} style={{ width: 6, height: 6, borderRadius: "50%", background: ev.outcome === "completed" ? TOKENS.green : ev.outcome === "rejected" ? TOKENS.red : isOfficeKind(ev.kind) ? TOKENS.amber : (userById[ev.assignedTo]?.colour) || TOKENS.slate, display: "inline-block" }} />)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="diary-panel">
        <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, marginBottom: 2 }}>{dayLabel(selDateObj)}</div>
          <div style={{ fontSize: 12, color: TOKENS.slateLight, marginBottom: 14 }}>{dayEvents.length} booking{dayEvents.length !== 1 ? "s" : ""}</div>
          {dayEvents.length === 0 && <div style={{ fontSize: 13, color: TOKENS.slateLight, padding: "14px 0" }}>Nothing booked. Add a visit, callback or site survey.</div>}
          {dayEvents.length > 0 && <div style={{ fontSize: 11.5, color: TOKENS.slateLight, marginTop: -8, marginBottom: 8 }}>Tap a booking for the address, directions and notes.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dayEvents.map((ev) => (
              <VisitRow key={ev.id} ev={ev} job={ev.jobId ? jobById[ev.jobId] : null} user={userById[ev.assignedTo]}
                onOpen={onEditEvent} onMarkOutcome={onMarkOutcome} />
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={() => onNewEvent(selectedDay)}>+ Book on this day</button>
        </div>
      </div>
    </div>
  );
}

/* ================= JOBS ================= */
function JobsView({ jobs, users, userById, customerById, jobFilter, setJobFilter, jobSearch, setJobSearch, openJobId, setOpenJobId, onNewJob, onAddNote, onUpdateJob, onConvert, onBookVisit, events, images, loadImages, addImages, removeImage, checklistOps, onOpenCustomer, currentUser, onUpdateSafety, onPrintSafety, onDeleteJob, onUpdateFinance, reminderOps, onMarkOutcome, onOpenEvent }) {
  const filtered = jobs.filter((j) => {
    if (jobFilter === "open" && ["complete", "invoiced"].includes(j.status)) return false;
    if (jobFilter === "quote" && j.kind !== "quote") return false;
    if (jobFilter === "invoice" && j.status !== "complete") return false;
    if (jobFilter === "complete" && !["complete", "invoiced"].includes(j.status)) return false;
    if (jobSearch) {
      const q = jobSearch.toLowerCase();
      if (!(j.customer.toLowerCase().includes(q) || j.number.toLowerCase().includes(q) || (j.address || "").toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const openJob = jobs.find((j) => j.id === openJobId);

  if (openJob) {
    return (
      <JobDetail job={openJob} users={users} userById={userById} customer={openJob.customerId ? customerById[openJob.customerId] : null}
        events={events.filter((e) => e.jobId === openJob.id)} onBack={() => setOpenJobId(null)}
        onAddNote={onAddNote} onUpdateJob={onUpdateJob} onConvert={onConvert} onBookVisit={onBookVisit}
        images={images[openJob.id]} loadImages={loadImages} addImages={addImages} removeImage={removeImage}
        checklistOps={checklistOps} onOpenCustomer={onOpenCustomer}
        currentUser={currentUser} onUpdateSafety={onUpdateSafety} onPrintSafety={onPrintSafety} onDeleteJob={onDeleteJob} onUpdateFinance={onUpdateFinance} reminderOps={reminderOps}
        onMarkOutcome={onMarkOutcome} onOpenEvent={onOpenEvent} />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22 }}>Jobs &amp; Quotes</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => onNewJob("quote")}>+ Quote</button>
          <button className="btn btn-primary" onClick={() => onNewJob("job")}>+ Job</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        {[["open", "Open"], ["quote", "Quotes"], ["invoice", "Ready to invoice"], ["complete", "Completed"], ["all", "All"]].map(([id, label]) => (
          <button key={id} className="btn" onClick={() => setJobFilter(id)} style={{ background: jobFilter === id ? TOKENS.ink : "white", color: jobFilter === id ? "white" : TOKENS.ink, borderColor: jobFilter === id ? TOKENS.ink : TOKENS.line, fontSize: 12.5 }}>{label}</button>
        ))}
        <input placeholder="Search customer, address or job no." value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} style={{ maxWidth: 260 }} />
      </div>

      {filtered.length === 0 && <div style={{ color: TOKENS.slateLight, fontSize: 13.5, padding: "30px 4px" }}>No jobs match here yet. Raise a quote or a job to get started.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((j) => {
          const u = j.assignedTo ? userById[j.assignedTo] : null;
          const meta = STATUS_META[j.status];
          const done = (j.checklist || []).filter((c) => c.done).length;
          const total = (j.checklist || []).length;
          return (
            <div key={j.id} className="job-row" onClick={() => setOpenJobId(j.id)} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: "12px 14px", cursor: "pointer" }}>
              <div className="ticket" style={{ fontWeight: 700, fontSize: 12.5, color: TOKENS.ink, background: TOKENS.paper, border: `1px dashed ${TOKENS.line}`, borderRadius: 6, padding: "4px 8px", textAlign: "center" }}>{j.number}</div>
              <div className="job-row-main">
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {j.priority === "urgent" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: TOKENS.red, display: "inline-block" }} />}
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{j.customer}</div>
                  {j.jobType && <span style={{ fontSize: 10.5, color: TOKENS.slateLight, border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: "1px 5px" }}>{JOB_TYPES[j.jobType]}</span>}
                </div>
                <div style={{ fontSize: 12, color: TOKENS.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.projectName ? `${j.projectName} · ` : ""}{j.address || j.description}</div>
              </div>
              {total > 0 && <div style={{ fontSize: 11, color: TOKENS.slateLight }}>{done}/{total} ✓</div>}
              <div className="hide-mobile" style={{ fontSize: 11.5, color: TOKENS.slate, minWidth: 100 }}>{u ? u.name : "Unassigned"}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: meta.colour, background: `${meta.colour}18`, borderRadius: 20, padding: "4px 10px", whiteSpace: "nowrap" }}>{meta.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressStepper({ status, onSet }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
      {STATUS_ORDER.map((s, i) => {
        const active = STATUS_ORDER.indexOf(status) >= i;
        const isCurrent = status === s;
        return (
          <React.Fragment key={s}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: active ? TOKENS.accent2 : TOKENS.line }} />}
            <button onClick={() => onSet(s)} title={STATUS_META[s].label}
              style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${active ? TOKENS.accent2 : TOKENS.line}`, background: active ? TOKENS.accent2 : "white", color: active ? "white" : TOKENS.slateLight, fontSize: 11, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isCurrent ? `0 0 0 3px ${TOKENS.accent2}33` : "none" }}>
              {i + 1}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const money = (n) => {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return `£${num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function FinancePanel({ job, onUpdateFinance }) {
  const [open, setOpen] = useState(false);
  const finance = job.finance || { labour: null, materials: null, invoice: null };
  const [labour, setLabour] = useState(finance.labour ?? "");
  const [materials, setMaterials] = useState(finance.materials ?? "");
  const [invoice, setInvoice] = useState(finance.invoice ?? "");

  const num = (v) => (v === "" ? null : Number(v));
  const profit = invoice !== "" && !Number.isNaN(Number(invoice))
    ? Number(invoice) - (labour === "" ? 0 : Number(labour)) - (materials === "" ? 0 : Number(materials))
    : null;

  const hasFigures = finance.labour !== null || finance.materials !== null || finance.invoice !== null;

  return (
    <div style={{ marginBottom: 22, background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "none", border: "none", textAlign: "left" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Labour, materials &amp; invoice</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: hasFigures ? TOKENS.green : TOKENS.slateLight }}>
          {hasFigures ? money(finance.invoice !== null ? Number(finance.invoice) - (finance.labour || 0) - (finance.materials || 0) : null) + " profit" : "Not added"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field">
            <label>Labour (£)</label>
            <input type="number" step="0.01" min="0" value={labour} onChange={(e) => setLabour(e.target.value)} placeholder="0.00" />
          </div>
          <div className="field">
            <label>Materials (£)</label>
            <input type="number" step="0.01" min="0" value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="0.00" />
          </div>
          <div className="field">
            <label>Invoiceable amount (£)</label>
            <input type="number" step="0.01" min="0" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="0.00" />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: profit === null ? TOKENS.slateLight : profit >= 0 ? TOKENS.green : TOKENS.red }}>
            Profit: {profit === null ? "—" : money(profit)}
          </div>
          <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => onUpdateFinance(job.id, { labour: num(labour), materials: num(materials), invoice: num(invoice) })}>
            Save figures
          </button>
        </div>
      )}
    </div>
  );
}

function JobDetail({ job, users, userById, customer, events, onBack, onAddNote, onUpdateJob, onConvert, onBookVisit, images, loadImages, addImages, removeImage, checklistOps, onOpenCustomer, currentUser, onUpdateSafety, onPrintSafety, onDeleteJob, onUpdateFinance, reminderOps, onMarkOutcome, onOpenEvent }) {
  const [note, setNote] = useState("");
  const [noteDate, setNoteDate] = useState(toKey(new Date()));
  const [checklistText, setChecklistText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [projectName, setProjectName] = useState(job.projectName || "");
  const fileRef = useRef(null);
  const meta = STATUS_META[job.status];
  const prio = PRIORITY_META[job.priority] || PRIORITY_META.normal;
  const safety = job.safety || { signedOff: false, signedBy: null, signedAt: null, siteNotes: "" };

  useEffect(() => { loadImages(job.id); }, [job.id]);

  const checklist = job.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = checklist.length > 0 && doneCount === checklist.length;

  const handleFiles = async (files) => {
    if (!files || !files.length) return;
    setUploading(true);
    await addImages(job.id, files);
    setUploading(false);
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><ArrowLeft size={15} /> All jobs</button>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="ticket" style={{ fontSize: 13, fontWeight: 700, color: TOKENS.accent }}>{job.number}</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24 }}>{job.customer}</div>
          {editingProject ? (
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Bathroom refurb" style={{ maxWidth: 220 }} />
              <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { onUpdateJob(job.id, { projectName: projectName.trim() }); setEditingProject(false); }}>Save</button>
              <button className="btn-ghost" onClick={() => { setProjectName(job.projectName || ""); setEditingProject(false); }}>Cancel</button>
            </div>
          ) : (
            <div onClick={() => setEditingProject(true)} style={{ fontSize: 13, color: job.projectName ? TOKENS.slate : TOKENS.slateLight, cursor: "pointer", marginTop: 2, fontStyle: job.projectName ? "normal" : "italic" }}>
              {job.projectName || "+ Add project name"}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
            {job.jobType && <span style={{ fontSize: 11, color: TOKENS.slate, border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: "1px 6px" }}>{JOB_TYPES[job.jobType]}</span>}
            <span style={{ fontSize: 11, fontWeight: 700, color: prio.colour }}>{prio.label} priority</span>
            {customer && <button className="btn-ghost" onClick={() => onOpenCustomer(customer.id)} style={{ fontSize: 11, fontWeight: 700, color: TOKENS.accent2, padding: 0 }}>View customer →</button>}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.colour, background: `${meta.colour}18`, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>{meta.label}</span>
      </div>

      <ProgressStepper status={job.status} onSet={(s) => onUpdateJob(job.id, { status: s })} />

      <div style={{ marginBottom: 14 }}><SiteAddress job={job} customer={customer} onSave={(address) => onUpdateJob(job.id, { address })} /></div>
      <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5 }}>{job.description || "No description given."}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        <select value={job.assignedTo || ""} onChange={(e) => onUpdateJob(job.id, { assignedTo: e.target.value || null })} style={{ width: "auto" }}>
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={job.department || "plumbing"} onChange={(e) => onUpdateJob(job.id, { department: e.target.value })} style={{ width: "auto" }}>
          {Object.entries(DEPARTMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {job.kind === "quote" && <button className="btn btn-primary" onClick={() => onConvert(job.id)}>Convert to job</button>}
        <button className="btn" onClick={() => onBookVisit(job)}>+ Book visit</button>
        {job.status !== "complete" && job.status !== "invoiced" && <button className="btn" style={{ borderColor: TOKENS.green, color: TOKENS.green }} onClick={() => onUpdateJob(job.id, { status: "complete" })}>Ready to invoice</button>}
        {job.status === "complete" && <button className="btn btn-primary" onClick={() => onUpdateJob(job.id, { status: "invoiced" })}>Mark invoiced</button>}
      </div>

      <FinancePanel job={job} onUpdateFinance={onUpdateFinance} />

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Progress checklist {checklist.length > 0 && `(${doneCount}/${checklist.length})`}</div>
        {allDone && <div style={{ fontSize: 12.5, color: TOKENS.green, marginBottom: 8, fontWeight: 600 }}>All tasks complete — ready to invoice.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {checklist.map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: `1px solid ${c.done ? TOKENS.green : TOKENS.line}`, borderRadius: 8, padding: "12px 12px", fontSize: 14, cursor: "pointer", minHeight: 50 }}>
              <input type="checkbox" checked={c.done} onChange={() => checklistOps.toggleChecklistItem(job.id, c.id)} style={{ width: 26, height: 26, flexShrink: 0, accentColor: TOKENS.green, cursor: "pointer" }} />
              <span style={{ flex: 1, textDecoration: c.done ? "line-through" : "none", color: c.done ? TOKENS.slateLight : TOKENS.ink }}>{c.text}</span>
              <button className="btn-ghost" onClick={(e) => { e.preventDefault(); if (window.confirm(`Remove "${c.text}" from the checklist?`)) checklistOps.removeChecklistItem(job.id, c.id); }} style={{ padding: 8 }}><X size={17} /></button>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="e.g. Order parts, Test system, Sign-off" value={checklistText} onChange={(e) => setChecklistText(e.target.value)} />
          <button className="btn" onClick={() => { if (checklistText.trim()) { checklistOps.addChecklistItem(job.id, checklistText.trim()); setChecklistText(""); } }}>Add</button>
        </div>
      </div>

      <ReminderPanel job={job} reminders={reminderOps.reminders} onAdd={reminderOps.addReminder} onUpdate={reminderOps.updateReminder} onRemove={reminderOps.removeReminder} />

      <SafetyAccordion job={job} safety={safety} currentUser={currentUser} onUpdateSafety={onUpdateSafety} onPrintSafety={onPrintSafety} />

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Photos</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8, marginBottom: 10 }}>
          {(images || []).map((im) => (
            <div key={im.id} style={{ position: "relative", borderRadius: 7, overflow: "hidden", border: `1px solid ${TOKENS.line}`, aspectRatio: "1", background: "white" }}>
              <img src={im.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <button onClick={() => removeImage(job.id, im.id)} style={{ position: "absolute", top: 3, right: 3, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(20,20,20,0.65)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
            </div>
          ))}
          <button onClick={() => fileRef.current?.click()} style={{ aspectRatio: "1", borderRadius: 7, border: `1.5px dashed ${TOKENS.line}`, background: "white", color: TOKENS.slateLight, fontSize: 11.5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Camera size={19} />
            {uploading ? "Uploading" : "Add photo"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {events.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 2 }}>Visits &amp; feedback</div>
          <div style={{ fontSize: 11.5, color: TOKENS.slateLight, marginBottom: 6 }}>Accept a visit to give feedback, or reject it to rebook or leave it.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.slice().sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))).map((ev) => (
              <FeedbackRow key={ev.id} ev={ev} user={userById[ev.assignedTo]} onOpen={onOpenEvent} onMarkOutcome={onMarkOutcome} />
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Daily work notes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {job.notes.length === 0 && <div style={{ fontSize: 13, color: TOKENS.slateLight }}>No notes yet — log what's completed each day here.</div>}
        {job.notes.slice().reverse().map((n) => (
          <div key={n.id} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 7, padding: "8px 10px" }}>
            <div style={{ fontSize: 10.5, color: TOKENS.slateLight, marginBottom: 3, fontWeight: 600 }}>{n.date ? shortDate(n.date) : new Date(n.ts).toLocaleDateString("en-GB")}{n.author ? ` · ${n.author}` : ""}{n.kind === "office" && <span style={{ marginLeft: 6, color: TOKENS.amber }}>OFFICE</span>}{n.kind === "feedback" && <span style={{ marginLeft: 6, color: n.outcome === "rejected" ? TOKENS.red : TOKENS.green }}>DIARY FEEDBACK</span>}</div>
            <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{n.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} style={{ maxWidth: 150 }} />
        <input placeholder="What was completed…" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <button className="btn btn-primary" onClick={() => { if (note.trim()) { onAddNote(job.id, note.trim(), noteDate); setNote(""); } }}>Add</button>
      </div>

      <div style={{ marginTop: 34, paddingTop: 16, borderTop: `1px solid ${TOKENS.line}` }}>
        <button
          className="btn"
          style={{ color: TOKENS.red, borderColor: TOKENS.red }}
          onClick={() => {
            if (window.confirm(`Delete job ${job.number} for ${job.customer}? This removes the job, its notes, checklist and photos permanently — it can't be undone.`)) {
              onDeleteJob(job.id);
            }
          }}
        >
          Delete this job
        </button>
      </div>
    </div>
  );
}

/* ================= HEALTH & SAFETY ================= */
function SafetyAccordion({ job, safety, currentUser, onUpdateSafety, onPrintSafety }) {
  const [open, setOpen] = useState(false);
  const [siteNotes, setSiteNotes] = useState(safety.siteNotes || "");

  return (
    <div style={{ marginBottom: 22, background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "none", border: "none", textAlign: "left" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Health &amp; Safety — RAMS &amp; Risk Assessment</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: safety.signedOff ? TOKENS.green : TOKENS.amber, background: safety.signedOff ? `${TOKENS.green}18` : `${TOKENS.amber}18`, borderRadius: 20, padding: "3px 9px" }}>
          {safety.signedOff ? "Reviewed" : "Not yet reviewed"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 16px" }}>
          <div style={{ fontSize: 12, color: TOKENS.slateLight, marginBottom: 12, lineHeight: 1.5 }}>{SAFETY_TEMPLATE.intro}</div>

          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Method statement</div>
          <ol style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: TOKENS.ink }}>
            {SAFETY_TEMPLATE.method.map((m, i) => <li key={i}>{m}</li>)}
          </ol>

          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Risk assessment</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {SAFETY_TEMPLATE.hazards.map((h, i) => (
              <div key={i} style={{ border: `1px solid ${TOKENS.line}`, borderRadius: 7, padding: "8px 10px" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{h.hazard}</div>
                <div style={{ fontSize: 11.5, color: TOKENS.slateLight, marginTop: 2 }}>Who's at risk: {h.who}</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>{h.controls}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Hazardous materials (COSHH)</div>
          <div style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>{SAFETY_TEMPLATE.coshh}</div>

          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>PPE required</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {SAFETY_TEMPLATE.ppe.map((p) => <span key={p} style={{ fontSize: 11.5, border: `1px solid ${TOKENS.line}`, borderRadius: 20, padding: "3px 10px" }}>{p}</span>)}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Emergency procedure</div>
          <div style={{ fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>{SAFETY_TEMPLATE.emergency}</div>

          <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Site-specific hazards / notes</div>
          <textarea rows={2} value={siteNotes} onChange={(e) => setSiteNotes(e.target.value)} placeholder="Add anything specific to this site — e.g. suspected asbestos, restricted access, known faulty wiring…" style={{ marginBottom: 10 }} />
          <button className="btn" style={{ marginBottom: 14 }} onClick={() => onUpdateSafety(job.id, { siteNotes })}>Save site notes</button>

          <div style={{ borderTop: `1px solid ${TOKENS.line}`, paddingTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {safety.signedOff ? (
              <div style={{ fontSize: 12.5, color: TOKENS.green }}>Reviewed by {safety.signedBy} on {new Date(safety.signedAt).toLocaleDateString("en-GB")}</div>
            ) : (
              <button className="btn btn-primary" onClick={() => onUpdateSafety(job.id, { signedOff: true, signedBy: currentUser?.name || "Unknown", signedAt: new Date().toISOString(), siteNotes })}>
                Confirm reviewed on site
              </button>
            )}
            <button className="btn" onClick={() => onPrintSafety(job.id)}>Print / save as PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrintableSafety({ job, customer, onClose }) {
  const safety = job.safety || { signedOff: false, siteNotes: "" };
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#111", background: "white", minHeight: "100vh", padding: "28px 32px", maxWidth: 780, margin: "0 auto" }}>
      <style>{`
        ${FONT_IMPORT}
        @media print { .no-print { display: none !important; } body { background: white; } }
        .rams-h { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
      `}</style>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button onClick={onClose} className="btn" style={{ border: "1px solid #ccc", borderRadius: 7, padding: "8px 14px", background: "white", cursor: "pointer", fontWeight: 600 }}>← Back to app</button>
        <button onClick={() => window.print()} style={{ border: "none", borderRadius: 7, padding: "8px 14px", background: TOKENS.accent, color: "white", cursor: "pointer", fontWeight: 700 }}>Print / save as PDF</button>
      </div>

      <div className="rams-h" style={{ fontSize: 12, letterSpacing: ".05em", textTransform: "uppercase", color: "#666" }}>Aqualec Services — Generic RAMS &amp; Risk Assessment</div>
      <div className="rams-h" style={{ fontSize: 26, marginBottom: 2 }}>{job.number} · {job.customer}</div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>{job.address}{job.description ? ` — ${job.description}` : ""}</div>

      <p style={{ fontSize: 12.5, color: "#555", lineHeight: 1.5, marginBottom: 18 }}>{SAFETY_TEMPLATE.intro}</p>

      <div className="rams-h" style={{ fontSize: 15, marginBottom: 8 }}>Method statement</div>
      <ol style={{ paddingLeft: 20, fontSize: 12.5, lineHeight: 1.7, marginBottom: 18 }}>
        {SAFETY_TEMPLATE.method.map((m, i) => <li key={i}>{m}</li>)}
      </ol>

      <div className="rams-h" style={{ fontSize: 15, marginBottom: 8 }}>Risk assessment</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginBottom: 18 }}>
        <thead>
          <tr style={{ background: "#f2f2f0", textAlign: "left" }}>
            <th style={{ padding: "6px 8px", border: "1px solid #ddd" }}>Hazard</th>
            <th style={{ padding: "6px 8px", border: "1px solid #ddd" }}>Who's at risk</th>
            <th style={{ padding: "6px 8px", border: "1px solid #ddd" }}>Controls</th>
          </tr>
        </thead>
        <tbody>
          {SAFETY_TEMPLATE.hazards.map((h, i) => (
            <tr key={i}>
              <td style={{ padding: "6px 8px", border: "1px solid #ddd", fontWeight: 600 }}>{h.hazard}</td>
              <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>{h.who}</td>
              <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>{h.controls}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rams-h" style={{ fontSize: 15, marginBottom: 8 }}>Hazardous materials (COSHH)</div>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 18 }}>{SAFETY_TEMPLATE.coshh}</p>

      <div className="rams-h" style={{ fontSize: 15, marginBottom: 8 }}>PPE required</div>
      <p style={{ fontSize: 12.5, marginBottom: 18 }}>{SAFETY_TEMPLATE.ppe.join(" · ")}</p>

      <div className="rams-h" style={{ fontSize: 15, marginBottom: 8 }}>Emergency procedure</div>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 18 }}>{SAFETY_TEMPLATE.emergency}</p>

      <div className="rams-h" style={{ fontSize: 15, marginBottom: 8 }}>Site-specific hazards / notes</div>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 18, minHeight: 20 }}>{safety.siteNotes || "None recorded."}</p>

      <div style={{ borderTop: "1px solid #ccc", paddingTop: 14, fontSize: 12.5 }}>
        {safety.signedOff
          ? <>Reviewed on site by <strong>{safety.signedBy}</strong> on {new Date(safety.signedAt).toLocaleDateString("en-GB")}.</>
          : "Not yet confirmed as reviewed on site."}
      </div>
    </div>
  );
}

/* ================= CUSTOMERS ================= */
function CustomersView({ customers, jobs, openCustomerId, setOpenCustomerId, onAdd, onRemove, onOpenJob, onNewJobForCustomer }) {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const openCustomer = customers.find((c) => c.id === openCustomerId);

  if (openCustomer) {
    const customerJobs = jobs.filter((j) => j.customerId === openCustomer.id);
    return (
      <div style={{ maxWidth: 640 }}>
        <button className="btn-ghost" onClick={() => setOpenCustomerId(null)} style={{ marginBottom: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><ArrowLeft size={15} /> All customers</button>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, marginBottom: 4 }}>{openCustomer.name}</div>
        <div style={{ marginBottom: 16 }}><AddressLinks address={openCustomer.address} phone={openCustomer.phone} /></div>
        <button className="btn btn-primary" style={{ marginBottom: 20 }} onClick={() => onNewJobForCustomer(openCustomer)}>+ New job for this customer</button>

        <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 8 }}>Job history ({customerJobs.length})</div>
        {customerJobs.length === 0 && <div style={{ fontSize: 13, color: TOKENS.slateLight }}>No jobs for this customer yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {customerJobs.map((j) => {
            const meta = STATUS_META[j.status];
            return (
              <div key={j.id} onClick={() => onOpenJob(j.id)} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flexWrap: "wrap" }}>
                <div className="ticket" style={{ fontWeight: 700, fontSize: 12.5, background: TOKENS.paper, border: `1px dashed ${TOKENS.line}`, borderRadius: 6, padding: "3px 7px" }}>{j.number}</div>
                <div style={{ flex: 1, fontSize: 13, minWidth: 100 }}>{j.description || j.jobType}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: meta.colour, background: `${meta.colour}18`, borderRadius: 20, padding: "3px 9px" }}>{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const filtered = customers.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.address || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 16 }}>Customers</div>
      <div className="customers-layout">
        <div style={{ flex: 1, minWidth: 0 }}>
          <input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
          {filtered.length === 0 && <div style={{ color: TOKENS.slateLight, fontSize: 13.5, padding: "20px 4px" }}>No customers yet — add one, or they'll be created automatically the first time you raise a job for them.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((c) => {
              const count = jobs.filter((j) => j.customerId === c.id).length;
              return (
                <div key={c.id} onClick={() => setOpenCustomerId(c.id)} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: TOKENS.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.address}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: TOKENS.slateLight }}>{count} job{count !== 1 ? "s" : ""}</div>
                  <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onRemove(c.id); }}>Remove</button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="customers-side">
          <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Add a customer</div>
            <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mrs. Patel" /></div>
            <div className="field"><label>Address</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 14 Elm Road" /></div>
            <div className="field"><label>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" /></div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => { if (name.trim()) { onAdd(name.trim(), address.trim(), phone.trim()); setName(""); setAddress(""); setPhone(""); } }}>Add customer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= TEAM ================= */
function ProfileRow({ user, jobs, currentUserId, onUpdate, onRemove, canApprove }) {
  const [trade, setTrade] = useState(user.trade || "");
  const [editing, setEditing] = useState(false);
  const active = jobs.filter((j) => j.assignedTo === user.id && !["complete", "invoiced"].includes(j.status)).length;

  return (
    <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: user.colour, display: "inline-block", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}{user.id === currentUserId && <span style={{ fontSize: 10.5, color: TOKENS.accent2, fontWeight: 700, marginLeft: 6 }}>YOU</span>}</div>
        {editing ? (
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Role / trade" style={{ maxWidth: 200 }} />
            <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { onUpdate(user.id, { trade }); setEditing(false); }}>Save</button>
            <button className="btn-ghost" onClick={() => { setTrade(user.trade || ""); setEditing(false); }}>Cancel</button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: TOKENS.slate }}>{user.trade || "Technician"} · {active} active job{active !== 1 ? "s" : ""}</div>
        )}
      </div>
      {canApprove ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 12.5, color: user.is_admin ? TOKENS.amber : TOKENS.slate }}>
            <input type="checkbox" checked={!!user.is_admin} onChange={() => onUpdate(user.id, { is_admin: !user.is_admin })} style={{ width: 20, height: 20, accentColor: TOKENS.amber }} />
            Office admin
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 12.5, color: user.can_approve ? TOKENS.accent2 : TOKENS.slate }}>
            <input type="checkbox" checked={!!user.can_approve} disabled={user.id === currentUserId} onChange={() => onUpdate(user.id, { can_approve: !user.can_approve })} style={{ width: 20, height: 20, accentColor: TOKENS.accent2 }} />
            Can approve
          </label>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          {user.is_admin && <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS.amber }}>OFFICE ADMIN</span>}
          {user.can_approve && <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS.accent2 }}>APPROVER</span>}
        </div>
      )}
      {!editing && <button className="btn-ghost" onClick={() => setEditing(true)}>Edit role</button>}
      {canApprove && user.id !== currentUserId && <button className="btn-ghost" style={{ color: TOKENS.red }} onClick={() => { if (window.confirm(`Remove ${user.name} from the team? They'll lose access straight away and would need approving again.`)) onRemove(user.id); }}>Remove</button>}
    </div>
  );
}

function SubcontractorRow({ sub, jobs, onUpdate, onRemove }) {
  const [name, setName] = useState(sub.name);
  const [trade, setTrade] = useState(sub.trade || "");
  const [editing, setEditing] = useState(false);
  const active = jobs.filter((j) => j.assignedTo === sub.id && !["complete", "invoiced"].includes(j.status)).length;

  return (
    <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: sub.colour, display: "inline-block", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 140 }}>
        {editing ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ maxWidth: 160 }} />
            <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade" style={{ maxWidth: 160 }} />
            <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { if (name.trim()) { onUpdate(sub.id, { name: name.trim(), trade }); setEditing(false); } }}>Save</button>
            <button className="btn-ghost" onClick={() => { setName(sub.name); setTrade(sub.trade || ""); setEditing(false); }}>Cancel</button>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.name} <span style={{ fontSize: 10, color: TOKENS.accent, fontWeight: 700, marginLeft: 4 }}>SUBCONTRACTOR</span></div>
            <div style={{ fontSize: 12, color: TOKENS.slate }}>{sub.trade || "Subcontractor"} · {active} active job{active !== 1 ? "s" : ""}</div>
          </>
        )}
      </div>
      {!editing && <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>}
      <button className="btn-ghost" style={{ color: TOKENS.red }} onClick={() => { if (window.confirm(`Remove subcontractor ${sub.name}? Past jobs keep their record, but they won't be assignable any more.`)) onRemove(sub.id); }}>Remove</button>
    </div>
  );
}

function TeamView({ profiles, subcontractors, jobs, currentUserId, canApprove, approvers, onUpdateProfile, onRemoveProfile, onAddSubcontractor, onUpdateSubcontractor, onRemoveSubcontractor }) {
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const pending = profiles.filter((p) => !p.approved);
  const approved = profiles.filter((p) => p.approved);
  const approverNames = approvers.map((a) => a.name.split(" ")[0]).join(" or ") || "an approver";

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Team</div>
      <div style={{ fontSize: 12.5, color: TOKENS.slateLight, marginBottom: 14 }}>New team members sign up with the app link, then wait here until {approverNames} approves them — they can't see any jobs or customers until then. <strong>Office admin</strong> gets the Office page, and finished jobs and office-priced quotes go on their diary for Friday. <strong>Can approve</strong> lets someone approve or remove team members.</div>

      {pending.length > 0 && (
        <div style={{ background: `${TOKENS.amber}12`, border: `1px solid ${TOKENS.amber}55`, borderRadius: 10, padding: 12, marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TOKENS.amber, textTransform: "uppercase", marginBottom: 8 }}>Waiting for approval ({pending.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((u) => (
              <div key={u.id} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: TOKENS.slate }}>{u.trade || "No role given"} · signed up {new Date(u.created_at).toLocaleDateString("en-GB")}</div>
                </div>
                {canApprove ? (
                  <>
                    <button className="btn btn-primary" onClick={() => onUpdateProfile(u.id, { approved: true })}>Approve</button>
                    <button className="btn" style={{ color: TOKENS.red, borderColor: TOKENS.red }} onClick={() => { if (window.confirm(`Turn down ${u.name}? Their sign-up request will be removed.`)) onRemoveProfile(u.id); }}>Turn down</button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: TOKENS.slateLight }}>Waiting for {approverNames}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {approved.map((u) => (
          <ProfileRow key={u.id} user={u} jobs={jobs} currentUserId={currentUserId} canApprove={canApprove} onUpdate={onUpdateProfile} onRemove={onRemoveProfile} />
        ))}
      </div>

      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, marginBottom: 6 }}>Subcontractors</div>
      <div style={{ fontSize: 12.5, color: TOKENS.slateLight, marginBottom: 14 }}>People you can assign jobs to who don't need their own login — anyone on the team can add, edit or remove these.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {subcontractors.length === 0 && <div style={{ fontSize: 13, color: TOKENS.slateLight }}>No subcontractors added yet.</div>}
        {subcontractors.map((s) => (
          <SubcontractorRow key={s.id} sub={s} jobs={jobs} onUpdate={onUpdateSubcontractor} onRemove={onRemoveSubcontractor} />
        ))}
      </div>

      <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Add a subcontractor</div>
        <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dave's Electrics" /></div>
        <div className="field"><label>Trade</label><input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Electrician" /></div>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => { if (name.trim()) { onAddSubcontractor(name.trim(), trade.trim()); setName(""); setTrade(""); } }}>Add subcontractor</button>
      </div>
    </div>
  );
}

/* ================= REPORTS ================= */
function ReportsView({ jobs, today }) {
  const currentFY = fyStartYear(today);
  const [range, setRange] = useState(`fy-${currentFY}`); // fy-YYYY | month | all

  // A job counts in the period it was invoiced; if not invoiced yet, the period it was raised
  const jobDate = (j) => new Date(j.finance?.invoicedAt || j.createdAt);
  const fyOptions = Array.from(new Set([currentFY, ...jobs.map((j) => fyStartYear(jobDate(j)))])).sort((a, b) => b - a);

  const inRange = (j) => {
    if (range === "all") return true;
    const d = jobDate(j);
    if (range === "month") return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    return fyStartYear(d) === Number(range.slice(3));
  };
  const periodText = range === "all" ? "All time" : range === "month" ? "This month" : `Financial year ${fyLabel(Number(range.slice(3)))} (1 ${FY_MONTH_NAME} – end of ${new Date(2000, (FY_START_MONTH + 11) % 12, 1).toLocaleDateString("en-GB", { month: "long" })})`;

  const realJobs = jobs.filter((j) => j.kind === "job" && inRange(j));

  const totalsByDept = Object.keys(DEPARTMENTS).map((key) => {
    const deptJobs = realJobs.filter((j) => (j.department || "plumbing") === key);
    const labour = deptJobs.reduce((s, j) => s + (Number(j.finance?.labour) || 0), 0);
    const materials = deptJobs.reduce((s, j) => s + (Number(j.finance?.materials) || 0), 0);
    const invoice = deptJobs.reduce((s, j) => s + (Number(j.finance?.invoice) || 0), 0);
    const withFigures = deptJobs.filter((j) => j.finance?.invoice !== null && j.finance?.invoice !== undefined).length;
    return { key, label: DEPARTMENTS[key], jobCount: deptJobs.length, withFigures, labour, materials, invoice, profit: invoice - labour - materials };
  });

  const grand = totalsByDept.reduce((acc, d) => ({
    labour: acc.labour + d.labour, materials: acc.materials + d.materials, invoice: acc.invoice + d.invoice, profit: acc.profit + d.profit, jobCount: acc.jobCount + d.jobCount,
  }), { labour: 0, materials: 0, invoice: 0, profit: 0, jobCount: 0 });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22 }}>Reports</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={range.startsWith("fy-") ? range : ""} onChange={(e) => e.target.value && setRange(e.target.value)} style={{ width: "auto", background: range.startsWith("fy-") ? TOKENS.ink : "white", color: range.startsWith("fy-") ? "white" : TOKENS.ink, fontWeight: 600, fontSize: 13.5 }}>
            {!range.startsWith("fy-") && <option value="">Financial year…</option>}
            {fyOptions.map((y) => <option key={y} value={`fy-${y}`}>FY {fyLabel(y)}{y === currentFY ? " (current)" : ""}</option>)}
          </select>
          <button className="btn" onClick={() => setRange("month")} style={{ background: range === "month" ? TOKENS.ink : "white", color: range === "month" ? "white" : TOKENS.ink }}>This month</button>
          <button className="btn" onClick={() => setRange("all")} style={{ background: range === "all" ? TOKENS.ink : "white", color: range === "all" ? "white" : TOKENS.ink }}>All time</button>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.accent2, marginBottom: 2 }}>{periodText}</div>
      <div style={{ fontSize: 12.5, color: TOKENS.slateLight, marginBottom: 18 }}>Jobs count in the period they were invoiced (or raised, if not invoiced yet). Based on jobs (not quotes) with labour, materials and invoice figures added. {grand.jobCount} job{grand.jobCount !== 1 ? "s" : ""} in this period.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 18 }}>
        {totalsByDept.map((d) => (
          <div key={d.key} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{d.label}</div>
            <div style={{ fontSize: 11.5, color: TOKENS.slateLight, marginBottom: 12 }}>{d.jobCount} job{d.jobCount !== 1 ? "s" : ""} · {d.withFigures} with figures</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}><span style={{ color: TOKENS.slateLight }}>Labour</span><span>{money(d.labour)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}><span style={{ color: TOKENS.slateLight }}>Materials</span><span>{money(d.materials)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 10 }}><span style={{ color: TOKENS.slateLight }}>Invoiced</span><span>{money(d.invoice)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, paddingTop: 10, borderTop: `1px solid ${TOKENS.line}`, color: d.profit >= 0 ? TOKENS.green : TOKENS.red }}>
              <span>Profit</span><span>{money(d.profit)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: TOKENS.ink, borderRadius: 10, padding: 18, color: "white" }}>
        <div style={{ fontSize: 12, color: "#9AA3AC", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>All departments combined</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 11, color: "#9AA3AC" }}>Labour</div><div style={{ fontSize: 18, fontWeight: 700 }}>{money(grand.labour)}</div></div>
          <div><div style={{ fontSize: 11, color: "#9AA3AC" }}>Materials</div><div style={{ fontSize: 18, fontWeight: 700 }}>{money(grand.materials)}</div></div>
          <div><div style={{ fontSize: 11, color: "#9AA3AC" }}>Invoiced</div><div style={{ fontSize: 18, fontWeight: 700 }}>{money(grand.invoice)}</div></div>
          <div><div style={{ fontSize: 11, color: "#9AA3AC" }}>Profit</div><div style={{ fontSize: 18, fontWeight: 700, color: grand.profit >= 0 ? "#6FCB8A" : "#E88" }}>{money(grand.profit)}</div></div>
        </div>
      </div>
    </div>
  );
}

/* ================= MODALS ================= */
function ModalShell({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20 }}>{title}</div>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 18, padding: 2 }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function JobModal({ modal, users, customers, currentUserId, onClose, onCreate }) {
  const preset = modal.presetCustomer;
  const [kind, setKind] = useState(modal.kind || "job");
  const presetNew = !preset && modal.presetNew?.customer ? modal.presetNew : null;
  const [customerMode, setCustomerMode] = useState(preset ? "existing" : presetNew ? "new" : (customers.length ? "existing" : "new"));
  const [selectedCustomerId, setSelectedCustomerId] = useState(preset?.id || "");
  const [customer, setCustomer] = useState(presetNew?.customer || "");
  const [address, setAddress] = useState(presetNew?.address || "");
  const [phone, setPhone] = useState(presetNew?.phone || "");
  const [description, setDescription] = useState(modal.presetDescription || "");
  const [assignedTo, setAssignedTo] = useState(currentUserId || "");
  const [jobType, setJobType] = useState(modal.presetJobType || "service");
  const [priority, setPriority] = useState("normal");
  const [department, setDepartment] = useState("plumbing");
  const [projectName, setProjectName] = useState("");
  const [siteSame, setSiteSame] = useState(true);
  const [siteAddress, setSiteAddress] = useState("");

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const customerAddress = (customerMode === "existing" ? selectedCustomer?.address : address) || "";
  const site = siteSame ? customerAddress.trim() : siteAddress.trim();
  const canSubmit = (customerMode === "existing" ? !!selectedCustomerId : customer.trim().length > 0) && (siteSame || !!siteAddress.trim());

  const handleSubmit = () => {
    if (customerMode === "existing" && selectedCustomer) {
      onCreate({ kind, customerId: selectedCustomer.id, customer: selectedCustomer.name, address: site, customerAddress: selectedCustomer.address, phone: selectedCustomer.phone, description, assignedTo, jobType, priority, department, projectName: projectName.trim() });
    } else {
      onCreate({ kind, customerId: null, customer: customer.trim(), address: site, customerAddress: address.trim(), phone, description, assignedTo, jobType, priority, department, projectName: projectName.trim() });
    }
  };

  return (
    <ModalShell title={kind === "quote" ? "New quote" : "New job"} onClose={onClose}>
      <div className="field">
        <label>Type</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setKind("quote")} style={{ flex: 1, background: kind === "quote" ? TOKENS.ink : "white", color: kind === "quote" ? "white" : TOKENS.ink }}>Quote</button>
          <button className="btn" onClick={() => setKind("job")} style={{ flex: 1, background: kind === "job" ? TOKENS.ink : "white", color: kind === "job" ? "white" : TOKENS.ink }}>Confirmed job</button>
        </div>
      </div>

      <div className="field">
        <label>Customer</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button className="btn" onClick={() => setCustomerMode("existing")} style={{ flex: 1, background: customerMode === "existing" ? TOKENS.ink : "white", color: customerMode === "existing" ? "white" : TOKENS.ink }}>Existing</button>
          <button className="btn" onClick={() => setCustomerMode("new")} style={{ flex: 1, background: customerMode === "new" ? TOKENS.ink : "white", color: customerMode === "new" ? "white" : TOKENS.ink }}>New customer</button>
        </div>
        {customerMode === "existing" ? (
          customers.length ? (
            <>
              <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="">— Select a customer —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.address ? ` · ${c.address}` : ""}</option>)}
              </select>
              {selectedCustomer && <div style={{ fontSize: 12, color: TOKENS.slateLight, marginTop: 6 }}>{selectedCustomer.address}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}</div>}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: TOKENS.slateLight }}>No customers saved yet — switch to "New customer".</div>
          )
        ) : (
          <>
            <div className="field"><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name, e.g. Mrs. Patel" /></div>
            <div className="field"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Customer's address" /></div>
            <div className="field"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" /></div>
          </>
        )}
      </div>

      <div className="field">
        <label>Job site address</label>
        <ChoiceButtons value={siteSame} onChange={setSiteSame} options={[[true, "Same as customer address", TOKENS.accent2], [false, "Different address"]]} />
        {siteSame ? (
          <div style={{ fontSize: 12.5, color: customerAddress ? TOKENS.slate : TOKENS.slateLight, marginTop: 6, display: "flex", gap: 5 }}>
            <MapPin size={14} style={{ flexShrink: 0, marginTop: 1 }} />{customerAddress || "Pick or add the customer first — their address will be used."}
          </div>
        ) : (
          <input autoFocus value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="Site address incl. postcode, e.g. 12 High St, March PE15 8AA" style={{ marginTop: 8 }} />
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Job type</label>
          <select value={jobType} onChange={(e) => setJobType(e.target.value)}>{Object.entries(JOB_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>{Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </div>
      </div>
      <div className="field">
        <label>Department</label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)}>{Object.entries(DEPARTMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="field">
        <label>Project name (optional)</label>
        <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Bathroom refurb — helps you find it if it needs several visits" />
      </div>
      <div className="field"><label>Job description (optional — can add later)</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Annual boiler service, Vaillant ecoTEC" /></div>
      <div className="field">
        <label>Assign to</label>
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} disabled={!canSubmit} onClick={handleSubmit}>
        Create {kind === "quote" ? "quote" : "job"} number
      </button>
    </ModalShell>
  );
}

function EventModal({ modal, users, jobs, onClose, onCreate, onUpdate, onDelete }) {
  const editing = modal.event;
  const preset = modal.presetJob;
  const from = modal.presetFrom || null; // rebooking a rejected visit
  const [title, setTitle] = useState(editing?.title || from?.title || (preset ? `Visit — ${preset.customer}` : ""));
  const [slots, setSlots] = useState([{ date: editing?.date || modal.date, time: editing?.time || "09:00" }]);
  const [duration, setDuration] = useState(editing?.duration || from?.duration || "1h");
  const [assignedTo, setAssignedTo] = useState(editing?.assignedTo || from?.assignedTo || preset?.assignedTo || (users[0]?.id ?? ""));
  const [jobId, setJobId] = useState(editing?.jobId || preset?.id || "");
  const [notes, setNotes] = useState(editing?.notes || from?.notes || "");
  const [addrMode, setAddrMode] = useState((editing?.address || from?.address) ? "other" : "job");
  const [address, setAddress] = useState(editing?.address || from?.address || "");
  const linkedJob = jobs.find((j) => j.id === jobId) || null;
  const useJobAddress = !!linkedJob && addrMode === "job";

  const linkedJobs = jobs.filter((j) => !["complete", "invoiced"].includes(j.status));
  const jobLabel = (j) => `${j.number}${j.projectName ? ` — ${j.projectName}` : ""} · ${j.customer}${j.address ? `, ${j.address}` : ""}`;

  const updateSlot = (i, patch) => setSlots((s) => s.map((slot, idx) => (idx === i ? { ...slot, ...patch } : slot)));
  const addSlot = () => setSlots((s) => [...s, { date: s[s.length - 1]?.date || modal.date, time: "09:00" }]);
  const removeSlot = (i) => setSlots((s) => s.filter((_, idx) => idx !== i));

  const canSubmit = title.trim() && slots.every((s) => s.date);

  const handleSubmit = () => {
    const base = { title: title.trim(), duration, assignedTo: assignedTo || null, jobId: jobId || null, notes, address: useJobAddress ? null : (address.trim() || null) };
    if (editing) {
      onUpdate(editing.id, { ...base, date: slots[0].date, time: slots[0].time });
    } else {
      onCreate(slots.map((s) => ({ ...base, date: s.date, time: s.time })));
    }
  };

  return (
    <ModalShell title={editing ? "Edit booking" : from ? "Rebook visit" : "Book a visit"} onClose={onClose}>
      <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Boiler service, Site survey" /></div>

      <div className="field">
        <label>{slots.length > 1 ? "Dates & times" : "Date & time"}</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {slots.map((slot, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="date" value={slot.date} onChange={(e) => updateSlot(i, { date: e.target.value })} style={{ flex: 1 }} />
              <input type="time" value={slot.time} onChange={(e) => updateSlot(i, { time: e.target.value })} style={{ width: 110 }} />
              {!editing && slots.length > 1 && (
                <button className="btn-ghost" onClick={() => removeSlot(i)} style={{ padding: 4 }}><X size={15} /></button>
              )}
            </div>
          ))}
        </div>
        {!editing && (
          <button className="btn" style={{ marginTop: 8 }} onClick={addSlot}>+ Add another visit</button>
        )}
      </div>

      <div className="field"><label>Duration</label><input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 1h, 2h30" /></div>
      <div className="field">
        <label>Technician</label>
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Link to job / quote (optional)</label>
        <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">— No linked job —</option>
          {linkedJobs.map((j) => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Site address</label>
        {linkedJob && <ChoiceButtons value={addrMode} onChange={setAddrMode} options={[["job", "Same as job address", TOKENS.accent2], ["other", "Different address"]]} />}
        {useJobAddress ? (
          <div style={{ fontSize: 12.5, color: linkedJob.address ? TOKENS.slate : TOKENS.red, marginTop: 6, display: "flex", gap: 5 }}>
            <MapPin size={14} style={{ flexShrink: 0, marginTop: 1 }} />{linkedJob.address || "This job has no address yet — choose Different address."}
          </div>
        ) : (
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address incl. postcode (for directions)" style={{ marginTop: linkedJob ? 8 : 0 }} />
        )}
      </div>
      <div className="field"><label>Notes</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access instructions, parts to bring…" /></div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {editing && <button className="btn" style={{ color: TOKENS.red, borderColor: TOKENS.red }} onClick={() => onDelete(editing.id)}>Delete</button>}
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canSubmit} onClick={handleSubmit}>
          {editing ? "Save changes" : slots.length > 1 ? `Book ${slots.length} visits` : "Book visit"}
        </button>
      </div>
    </ModalShell>
  );
}

function LogWorkModal({ modal, onClose, onSave }) {
  const { job, date } = modal;
  const [text, setText] = useState("");
  return (
    <ModalShell title="Log work completed" onClose={onClose}>
      <div style={{ marginBottom: 10 }}>
        <div className="ticket" style={{ fontSize: 12.5, fontWeight: 700, color: TOKENS.accent }}>{job.number}</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{job.customer}</div>
        <div style={{ fontSize: 12.5, color: TOKENS.slateLight }}>{shortDate(date)}</div>
      </div>
      <div className="field">
        <label>What was completed today</label>
        <textarea rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Replaced pump, tested pressure, awaiting part for valve" />
      </div>
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={!text.trim()} onClick={() => onSave(job.id, text.trim(), date)}>Save to job</button>
    </ModalShell>
  );
}

function OutcomeModal({ modal, jobs, officeAdminName, onClose, onSave }) {
  const { event, kind } = modal;
  const isReject = kind === "rejected";
  const [text, setText] = useState(event.outcomeNote || "");
  const [linkJobId, setLinkJobId] = useState("");
  const job = jobs.find((j) => j.id === (event.jobId || linkJobId)) || null;
  const isQuote = job?.kind === "quote";
  const [finished, setFinished] = useState(null);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [quoteBy, setQuoteBy] = useState("office");
  const [wantSig, setWantSig] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [reminderKind, setReminderKind] = useState("");
  const [reminderDate, setReminderDate] = useState(addMonthsKey(event.date, 12));
  const [busy, setBusy] = useState(false);
  const sigRef = useRef(null);
  const office = officeAdminName ? officeAdminName.split(" ")[0] : "the office";
  const Office = office.charAt(0).toUpperCase() + office.slice(1);

  if (isReject) {
    const reject = async (rebook) => { setBusy(true); await onSave(event.id, { outcome: "rejected", note: text.trim(), details: { rebook }, rebook }); };
    return (
      <ModalShell title="Reject visit" onClose={onClose}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{event.title}</div>
          <div style={{ fontSize: 12.5, color: TOKENS.slateLight }}>{shortDate(event.date)}{job ? ` · ${job.number} · ${job.customer}` : ""}</div>
        </div>
        <div className="field">
          <label>Reason (optional)</label>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Customer not in, no access, part not arrived…" />
        </div>
        <label>Does it need rebooking?</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn btn-primary" disabled={busy} style={{ minHeight: 50, fontSize: 15 }} onClick={() => reject(true)}>Reject &amp; rebook</button>
          <button className="btn" disabled={busy} style={{ minHeight: 50, fontSize: 15, color: TOKENS.red, borderColor: TOKENS.red }} onClick={() => reject(false)}>Reject — don't rebook</button>
        </div>
      </ModalShell>
    );
  }

  const needFinished = !isReject && job && !isQuote;
  const canSave = !busy && text.trim() && (!needFinished || finished !== null) && !(needFinished && finished && !invoiceNotes.trim());

  const save = async () => {
    setBusy(true);
    const signatureBlob = wantSig && hasInk && sigRef.current ? await sigRef.current.toBlob() : null;
    await onSave(event.id, {
      outcome: kind, note: text.trim(), linkJobId: linkJobId || null,
      details: isReject || !job ? null : isQuote ? { quoteBy } : { finished, invoiceNotes: invoiceNotes.trim() },
      signatureBlob, signedName: signedName.trim(),
      reminder: !isReject && reminderKind ? { kind: reminderKind, dueDate: reminderDate } : null,
    });
  };

  const title = isQuote ? "Accept quote visit" : "Accept visit";
  const label = isQuote ? "Feedback — what needs quoting?" : "Feedback — what was done?";
  const placeholder = isReject ? "e.g. Customer not in, access blocked, part unavailable…" : isQuote ? "Work required, materials, sizes / measurements, access, anything the customer asked for…" : "e.g. Replaced pump, tested and working";

  return (
    <ModalShell title={title} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{event.title}</div>
        <div style={{ fontSize: 12.5, color: TOKENS.slateLight }}>{shortDate(event.date)}{job ? ` · ${job.number} · ${job.customer}` : ""}</div>
      </div>

      {!event.jobId && (
        <div className="field">
          <label>Which job is this for?</label>
          <select value={linkJobId} onChange={(e) => { setLinkJobId(e.target.value); setFinished(null); }}>
            <option value="">— Not linked to a job —</option>
            {jobs.filter((j) => j.status !== "invoiced").map((j) => <option key={j.id} value={j.id}>{j.number} · {j.customer}{j.address ? `, ${j.address}` : ""}</option>)}
          </select>
        </div>
      )}

      <div className="field">
        <label>{label}</label>
        <textarea rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      </div>

      {!isReject && isQuote && (
        <div className="field">
          <label>Who's pricing it?</label>
          <ChoiceButtons value={quoteBy} onChange={setQuoteBy} options={[["office", `${Office} — simple quote`, TOKENS.amber], ["engineer", "I'll price it myself"]]} />
          {quoteBy === "office" && <div style={{ fontSize: 12, color: TOKENS.slateLight, marginTop: 6 }}>Goes on {office}'s diary for Friday to price and send.</div>}
        </div>
      )}

      {needFinished && (
        <div className="field">
          <label>Is the job finished?</label>
          <ChoiceButtons value={finished} onChange={setFinished} options={[[true, "Yes — ready to invoice", TOKENS.green], [false, "No — more work needed", TOKENS.accent2]]} />
        </div>
      )}

      {needFinished && finished && (
        <>
          <div className="field">
            <label>What needs invoicing?</label>
            <textarea rows={3} value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} placeholder="Materials used, hours on site, extras agreed with the customer, anything not to charge…" />
            <div style={{ fontSize: 12, color: TOKENS.slateLight, marginTop: 4 }}>Goes on {office}'s diary for Friday to invoice.</div>
          </div>

          <div className="field">
            <label>Next service / certificate reminder (optional)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={reminderKind} onChange={(e) => setReminderKind(e.target.value)} style={{ flex: "1 1 170px" }}>
                <option value="">No reminder</option>
                {Object.entries(REMINDER_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {reminderKind && <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} style={{ flex: "1 1 140px" }} />}
            </div>
          </div>
        </>
      )}

      {!isReject && job && !isQuote && (
        <div className="field">
          {!wantSig ? (
            <button type="button" className="btn" onClick={() => setWantSig(true)} style={{ width: "100%" }}>+ Get customer to sign (optional)</button>
          ) : (
            <>
              <label>Customer signature</label>
              <SignaturePad ref={sigRef} onInk={setHasInk} />
              <input value={signedName} onChange={(e) => setSignedName(e.target.value)} placeholder="Customer's name" style={{ marginTop: 6 }} />
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, minHeight: 46 }} disabled={!canSave} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </ModalShell>
  );
}

/* ================= SHARED: CHOICE BUTTONS ================= */
function ChoiceButtons({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(([val, label, colour]) => {
        const on = value === val;
        const c = colour || TOKENS.ink;
        return (
          <button key={String(val)} type="button" onClick={() => onChange(val)}
            style={{ flex: "1 1 140px", minHeight: 48, borderRadius: 9, border: `2px solid ${on ? c : TOKENS.line}`, background: on ? `${c}14` : "white", color: on ? c : TOKENS.ink, fontWeight: 700, fontSize: 13.5, padding: "8px 10px" }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ================= SIGNATURES ================= */
const SignaturePad = React.forwardRef(function SignaturePad({ onInk }, ref) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = 160 * ratio;
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
  }, []);

  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e) => { e.preventDefault(); canvasRef.current.setPointerCapture?.(e.pointerId); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    onInk?.(true);
  };
  const up = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); onInk?.(false); };

  React.useImperativeHandle(ref, () => ({ toBlob: () => new Promise((res) => canvasRef.current.toBlob(res, "image/png")) }));

  return (
    <div>
      <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ width: "100%", height: 160, border: `1.5px dashed ${TOKENS.slateLight}`, borderRadius: 8, background: "white", touchAction: "none", display: "block" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontSize: 11.5, color: TOKENS.slateLight }}>Customer signs in the box</span>
        <button type="button" className="btn-ghost" onClick={clear} style={{ fontSize: 12.5, fontWeight: 700 }}>Clear</button>
      </div>
    </div>
  );
});

function SignatureThumb({ path, name }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.storage.from("job-photos").createSignedUrl(path, 3600).then(({ data }) => { if (alive) setUrl(data?.signedUrl || null); });
    return () => { alive = false; };
  }, [path]);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10.5, color: TOKENS.slateLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Customer signature{name ? ` — ${name}` : ""}</div>
      {url && <img src={url} alt="Customer signature" style={{ maxWidth: 240, width: "100%", height: 70, objectFit: "contain", background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 6 }} />}
    </div>
  );
}

/* ================= VISIT / OFFICE CARD (diary, My day, office) ================= */
const isOfficeKind = (k) => typeof k === "string" && k.startsWith("office");
const OFFICE_LABEL = { office_invoice: "Invoice", office_quote: "Quote" };

function VisitCard({ ev, job, user, onEdit, onOpenJob, onLogWork, onMarkOutcome, showDate }) {
  const office = isOfficeKind(ev.kind);
  const edge = ev.outcome === "rejected" ? TOKENS.red : ev.outcome === "completed" ? TOKENS.green : office ? TOKENS.amber : user?.colour || TOKENS.slate;
  const bigBtn = (colour) => ({ flex: 1, minHeight: 48, borderRadius: 9, border: `2px solid ${colour}`, background: `${colour}12`, color: colour, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 });

  return (
    <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderLeft: `4px solid ${edge}`, borderRadius: 8, padding: "10px 12px" }}>
      <div onClick={() => onEdit?.(ev)} style={{ cursor: onEdit ? "pointer" : "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            {office && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".05em", color: TOKENS.amber, marginBottom: 2 }}>OFFICE · {OFFICE_LABEL[ev.kind] || "TASK"}</div>}
            <div style={{ fontSize: 14, fontWeight: 700 }}>{ev.title}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {ev.outcome === "completed" && <CheckCircle2 size={18} color={TOKENS.green} />}
            {ev.outcome === "rejected" && <XCircle size={18} color={TOKENS.red} />}
            <span className="ticket" style={{ fontSize: 12, color: TOKENS.slate }}>{showDate ? `${shortDate(ev.date)} ` : ""}{ev.time || ""}</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: TOKENS.slate, marginTop: 2 }}>{user?.name || "Unassigned"}{ev.duration ? ` · ${ev.duration}` : ""}{office && ev.details?.fromEngineer ? ` · from ${ev.details.fromEngineer}` : ""}</div>
        {ev.notes && <div style={{ fontSize: 12.5, marginTop: 6, whiteSpace: "pre-wrap", background: office ? `${TOKENS.amber}10` : TOKENS.paper, borderRadius: 6, padding: "6px 8px" }}>{ev.notes}</div>}
        {ev.outcome && ev.outcomeNote && (
          <div style={{ fontSize: 12, color: ev.outcome === "completed" ? TOKENS.green : TOKENS.red, marginTop: 6, fontStyle: "italic" }}>
            {office ? "Sent: " : ev.outcome === "completed" ? "Accepted: " : "Rejected: "}{ev.outcomeNote}
          </div>
        )}
      </div>

      {job && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 6, flexWrap: "wrap" }}>
          <span className="ticket" onClick={() => onOpenJob(job.id)} style={{ cursor: "pointer", fontSize: 11, color: TOKENS.accent, fontWeight: 700 }}>{job.number}{job.projectName ? ` — ${job.projectName}` : ""} · {job.customer}</span>
          {!office && onLogWork && <button className="btn" onClick={() => onLogWork(job, ev.date)} style={{ fontSize: 11.5, padding: "5px 10px", minHeight: "auto" }}>Log work</button>}
        </div>
      )}
      {!office && eventAddress(ev, job) && <div style={{ marginTop: 8 }}><AddressLinks address={eventAddress(ev, job)} phone={job?.phone} compact /></div>}

      {!ev.outcome && (
        office ? (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => onMarkOutcome(ev, "completed")} style={bigBtn(TOKENS.green)}><Check size={22} strokeWidth={3} /> Mark sent</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => onMarkOutcome(ev, "completed")} style={bigBtn(TOKENS.green)}><Check size={22} strokeWidth={3} /> Accept</button>
            <button onClick={() => onMarkOutcome(ev, "rejected")} style={bigBtn(TOKENS.red)}><X size={22} strokeWidth={3} /> Reject</button>
          </div>
        )
      )}
    </div>
  );
}

/* ================= MY DAY ================= */
function MyDayView({ me, events, jobById, userById, isAdmin, onEdit, onOpenJob, onLogWork, onMarkOutcome, onNewEvent }) {
  const [day, setDay] = useState("today");
  const now = new Date();
  const todayKey = toKey(now);
  const tomorrowKey = toKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const twoWeeksAgo = toKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14));
  const key = day === "today" ? todayKey : tomorrowKey;
  const byTime = (a, b) => (a.time || "99").localeCompare(b.time || "99");

  const mine = events.filter((e) => e.assignedTo === me.id);
  const list = mine.filter((e) => e.date === key).sort(byTime);
  const unmarked = mine.filter((e) => e.date < todayKey && e.date >= twoWeeksAgo && !e.outcome).sort((a, b) => b.date.localeCompare(a.date));
  const hour = now.getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const left = list.filter((e) => !e.outcome).length;

  const card = (ev, showDate) => (
    <VisitRow key={ev.id} ev={ev} job={ev.jobId ? jobById[ev.jobId] : null} user={userById[ev.assignedTo]} showDate={showDate}
      onOpen={onEdit} onMarkOutcome={onMarkOutcome} />
  );

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24 }}>{greet}, {me.name.split(" ")[0]}</div>
      <div style={{ fontSize: 13, color: TOKENS.slate, marginBottom: 14 }}>{dayLabel(now)} · {left} {isAdmin ? "task" : "visit"}{left !== 1 ? "s" : ""} left {day === "today" ? "today" : "tomorrow"}</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["today", "Today"], ["tomorrow", "Tomorrow"]].map(([id, label]) => (
          <button key={id} className="btn" onClick={() => setDay(id)} style={{ flex: 1, background: day === id ? TOKENS.ink : "white", color: day === id ? "white" : TOKENS.ink, borderColor: day === id ? TOKENS.ink : TOKENS.line }}>{label}</button>
        ))}
      </div>

      {unmarked.length > 0 && day === "today" && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.red, textTransform: "uppercase", marginBottom: 6 }}>Still to mark ({unmarked.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{unmarked.map((ev) => card(ev, true))}</div>
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: 18, fontSize: 13.5, color: TOKENS.slateLight, textAlign: "center" }}>
          Nothing booked for you {day === "today" ? "today" : "tomorrow"}.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{list.map((ev) => card(ev, false))}</div>
          <div style={{ fontSize: 11.5, color: TOKENS.slateLight, marginTop: 8 }}>Tap a visit for the address, directions and notes.</div>
        </>
      )}

      <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={() => onNewEvent(key)}>+ Book a visit</button>
    </div>
  );
}

/* ================= OFFICE ================= */
function OfficeView({ events, jobs, reminders, jobById, userById, noAdminsYet, onEdit, onOpenJob, onMarkOutcome, onUpdateReminder, onRaiseJob, onGoTeam }) {
  const todayKey = toKey(new Date());
  const now = new Date();
  const horizon = toKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60));
  const officeOpen = events.filter((e) => isOfficeKind(e.kind) && !e.outcome).sort((a, b) => a.date.localeCompare(b.date));
  const officeDone = events.filter((e) => isOfficeKind(e.kind) && e.outcome).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const invoiceTaskJobIds = new Set(officeOpen.filter((e) => e.kind === "office_invoice").map((e) => e.jobId));
  const readyNoTask = jobs.filter((j) => j.status === "complete" && !invoiceTaskJobIds.has(j.id));
  const dueReminders = reminders.filter((r) => !r.done && r.dueDate <= horizon).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const heading = (text, colour) => <div style={{ fontSize: 11.5, fontWeight: 700, color: colour || TOKENS.slateLight, textTransform: "uppercase", margin: "20px 0 8px" }}>{text}</div>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22 }}>Office</div>
      <div style={{ fontSize: 12.5, color: TOKENS.slateLight }}>Invoices and quotes passed on by the engineers, jobs ready to invoice, and services coming up.</div>

      {noAdminsYet && (
        <div style={{ marginTop: 12, background: `${TOKENS.amber}14`, border: `1px solid ${TOKENS.amber}55`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>
          No office admin is set yet, so these tasks aren't going on anyone's diary. <button className="btn-ghost" onClick={onGoTeam} style={{ padding: 0, fontWeight: 700, color: TOKENS.accent2 }}>Set one in Team →</button>
        </div>
      )}

      {heading(`To do (${officeOpen.length})`)}
      {officeOpen.length === 0 && <div style={{ fontSize: 13, color: TOKENS.slateLight }}>Nothing waiting — all invoices and quotes are sent.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {officeOpen.map((ev) => (
          <div key={ev.id}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ev.date < todayKey ? TOKENS.red : TOKENS.slate, marginBottom: 3 }}>{ev.date < todayKey ? "Overdue — was due " : "Due "}{shortDate(ev.date)}</div>
            <VisitCard ev={ev} job={ev.jobId ? jobById[ev.jobId] : null} user={userById[ev.assignedTo]} onEdit={onEdit} onOpenJob={onOpenJob} onMarkOutcome={onMarkOutcome} />
          </div>
        ))}
      </div>

      {readyNoTask.length > 0 && (
        <>
          {heading(`Ready to invoice — no task yet (${readyNoTask.length})`, TOKENS.green)}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {readyNoTask.map((j) => (
              <div key={j.id} onClick={() => onOpenJob(j.id)} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="ticket" style={{ fontSize: 12, fontWeight: 700, color: TOKENS.accent }}>{j.number}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{j.customer}</span>
                <span style={{ fontSize: 12, color: TOKENS.accent2, fontWeight: 700 }}>Open job →</span>
              </div>
            ))}
          </div>
        </>
      )}

      {heading(`Services & certificates due — next 60 days (${dueReminders.length})`)}
      {dueReminders.length === 0 && <div style={{ fontSize: 13, color: TOKENS.slateLight }}>Nothing due. Reminders are set when an engineer finishes a job, or from a job's page.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {dueReminders.map((r) => {
          const overdue = r.dueDate < todayKey;
          return (
            <div key={r.id} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderLeft: `4px solid ${overdue ? TOKENS.red : TOKENS.accent2}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{REMINDER_KINDS[r.kind] || r.kind} — {r.customer}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: overdue ? TOKENS.red : TOKENS.slate }}>{overdue ? "Overdue · " : "Due "}{shortDate(r.dueDate)}</span>
              </div>
              {r.address && <div style={{ fontSize: 12, color: TOKENS.slate, marginTop: 2 }}>{r.address}{r.phone ? ` · ${r.phone}` : ""}</div>}
              {r.notes && <div style={{ fontSize: 12.5, marginTop: 4 }}>{r.notes}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={() => onRaiseJob(r)}>Raise job</button>
                {r.phone && <a href={telHref(r.phone)} className="btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}><Phone size={14} /> Call</a>}
                <button className="btn" onClick={() => onUpdateReminder(r.id, { done: true })}>Dismiss</button>
              </div>
            </div>
          );
        })}
      </div>

      {officeDone.length > 0 && (
        <>
          {heading("Recently sent")}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {officeDone.map((ev) => (
              <div key={ev.id} style={{ fontSize: 12.5, color: TOKENS.slate, background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 7, padding: "8px 10px" }}>
                <strong style={{ color: TOKENS.ink }}>{ev.title}</strong> — {ev.outcomeNote}{ev.details?.amount != null ? ` (${money(ev.details.amount)})` : ""}{ev.details?.doneBy ? ` · ${ev.details.doneBy}` : ""}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OfficeDoneModal({ modal, job, onClose, onSave }) {
  const { event } = modal;
  const isInvoice = event.kind === "office_invoice";
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <ModalShell title={isInvoice ? "Invoice sent" : "Quote sent"} onClose={onClose}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{event.title}</div>
        {job && <div style={{ fontSize: 12.5, color: TOKENS.slateLight }}>{job.address}</div>}
      </div>
      {event.notes && (
        <div style={{ fontSize: 12.5, background: `${TOKENS.amber}10`, borderRadius: 7, padding: "8px 10px", marginBottom: 12, whiteSpace: "pre-wrap" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: TOKENS.amber, marginBottom: 3 }}>FROM {(event.details?.fromEngineer || "ENGINEER").toUpperCase()}</div>
          {event.notes}
        </div>
      )}
      <div className="field">
        <label>{isInvoice ? "Invoice amount (£)" : "Quote amount (£)"} — optional</label>
        <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div className="field">
        <label>{isInvoice ? "Invoice number / notes" : "Quote notes"} — optional</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isInvoice ? "e.g. INV-1042, sent by email" : "e.g. Emailed to customer"} />
      </div>
      <div style={{ fontSize: 12, color: TOKENS.slateLight, marginBottom: 10 }}>
        {isInvoice ? "The job will be marked as invoiced, and the amount goes into its figures for the reports." : "The quote amount is saved to the job so you can follow it up."}
      </div>
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={async () => { setBusy(true); await onSave(event, { amount: amount === "" ? null : Number(amount), note: note.trim() }); }}>
        {isInvoice ? "Mark invoice sent" : "Mark quote sent"}
      </button>
    </ModalShell>
  );
}

/* ================= REMINDERS ON A JOB ================= */
function ReminderPanel({ job, reminders, onAdd, onUpdate, onRemove }) {
  const [kind, setKind] = useState("service");
  const [dueDate, setDueDate] = useState(addMonthsKey(toKey(new Date()), 12));
  const [notes, setNotes] = useState("");
  const list = reminders.filter((r) => r.jobId === job.id || (job.customerId && r.customerId === job.customerId)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Service &amp; certificate reminders</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {list.length === 0 && <div style={{ fontSize: 13, color: TOKENS.slateLight }}>None set for this customer.</div>}
        {list.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 7, padding: "8px 10px", opacity: r.done ? 0.55 : 1 }}>
            <div style={{ flex: 1, fontSize: 13 }}>
              <strong>{REMINDER_KINDS[r.kind] || r.kind}</strong> — due {shortDate(r.dueDate)}{r.done ? " (dealt with)" : ""}
              {r.notes && <div style={{ fontSize: 12, color: TOKENS.slate }}>{r.notes}</div>}
            </div>
            {!r.done && <button className="btn-ghost" onClick={() => onUpdate(r.id, { done: true })} style={{ fontSize: 12, fontWeight: 700 }}>Dealt with</button>}
            <button className="btn-ghost" onClick={() => { if (window.confirm("Delete this reminder?")) onRemove(r.id); }} style={{ padding: 6 }}><X size={15} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ flex: "1 1 170px" }}>
          {Object.entries(REMINDER_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ flex: "1 1 140px" }} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" style={{ flex: "2 1 160px" }} />
        <button className="btn" onClick={() => { if (dueDate) { onAdd({ kind, dueDate, notes: notes.trim(), jobId: job.id, customerId: job.customerId, customer: job.customer, address: job.address, phone: job.phone }); setNotes(""); } }}>Add reminder</button>
      </div>
    </div>
  );
}

/* ================= MOBILE "MORE" SHEET ================= */
function MoreSheet({ items, view, setView, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => (
            <button key={it.id} className="btn" onClick={() => { setView(it.id); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 50, fontSize: 15, justifyContent: "flex-start", background: view === it.id ? TOKENS.ink : "white", color: view === it.id ? "white" : TOKENS.ink }}>
              <it.Icon size={19} /> {it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ================= COMPACT DIARY ROW + DETAILS SHEET ================= */
const tickBtn = (colour) => ({ width: 56, height: 50, borderRadius: 10, border: `2px solid ${colour}`, background: `${colour}12`, color: colour, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, flexShrink: 0, padding: 0, fontSize: 10.5, fontWeight: 700 });

function OutcomeIcon({ ev }) {
  const office = isOfficeKind(ev.kind);
  if (ev.outcome === "completed") return <span title={office ? "Sent" : "Accepted"} style={{ display: "flex", alignItems: "center", gap: 4, color: TOKENS.green, fontSize: 12, fontWeight: 700, flexShrink: 0 }}><CheckCircle2 size={22} />{office ? "Sent" : "Accepted"}</span>;
  if (ev.outcome === "rejected") return <span title="Rejected" style={{ display: "flex", alignItems: "center", gap: 4, color: TOKENS.red, fontSize: 12, fontWeight: 700, flexShrink: 0 }}><XCircle size={22} />Rejected</span>;
  return null;
}

function TickCross({ ev, onMarkOutcome }) {
  if (ev.outcome) return <OutcomeIcon ev={ev} />;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  if (isOfficeKind(ev.kind)) {
    return <button aria-label="Mark sent" title="Mark sent" onClick={stop(() => onMarkOutcome(ev, "completed"))} style={tickBtn(TOKENS.green)}><Check size={20} strokeWidth={3} />Sent</button>;
  }
  return (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button aria-label="Accept" title="Accept — give feedback" onClick={stop(() => onMarkOutcome(ev, "completed"))} style={tickBtn(TOKENS.green)}><Check size={20} strokeWidth={3} />Accept</button>
      <button aria-label="Reject" title="Reject — rebook or not" onClick={stop(() => onMarkOutcome(ev, "rejected"))} style={tickBtn(TOKENS.red)}><X size={20} strokeWidth={3} />Reject</button>
    </div>
  );
}

function VisitRow({ ev, job, user, onOpen, onMarkOutcome, showDate }) {
  const office = isOfficeKind(ev.kind);
  const place = shortPlace(eventAddress(ev, job));
  const edge = ev.outcome === "rejected" ? TOKENS.red : ev.outcome === "completed" ? TOKENS.green : office ? TOKENS.amber : user?.colour || TOKENS.slate;
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(ev)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(ev); }}
      style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: `1px solid ${TOKENS.line}`, borderLeft: `4px solid ${edge}`, borderRadius: 8, padding: "7px 8px 7px 10px", cursor: "pointer", minHeight: 60 }}>
      <div className="ticket" style={{ width: 44, flexShrink: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}>
        {showDate && <div style={{ fontSize: 10.5, color: TOKENS.red }}>{fromKey(ev.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>}
        {ev.time || (office ? "Fri" : "—")}
      </div>
      <div style={{ flex: 1, minWidth: 0, opacity: ev.outcome ? 0.7 : 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {office && <span style={{ color: TOKENS.amber, fontSize: 10, fontWeight: 800, letterSpacing: ".04em", marginRight: 5 }}>OFFICE</span>}{ev.title}
        </div>
        <div style={{ fontSize: 12, color: TOKENS.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user?.name?.split(" ")[0] || "Unassigned"}{place ? ` · ${place}` : ""}
        </div>
      </div>
      <TickCross ev={ev} onMarkOutcome={onMarkOutcome} />
    </div>
  );
}

function VisitSheet({ ev, job, user, onClose, onEdit, onOpenJob, onLogWork, onMarkOutcome }) {
  const office = isOfficeKind(ev.kind);
  const addr = eventAddress(ev, job);
  const bigBtn = (colour) => ({ flex: 1, minHeight: 50, borderRadius: 9, border: `2px solid ${colour}`, background: `${colour}12`, color: colour, fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 });
  return (
    <ModalShell title={ev.title} onClose={onClose}>
      <div style={{ fontSize: 13.5, color: TOKENS.slate, marginTop: -6, marginBottom: 14, lineHeight: 1.5 }}>
        {office && <span style={{ color: TOKENS.amber, fontWeight: 800, fontSize: 11, letterSpacing: ".04em" }}>OFFICE TASK · </span>}
        {dayLabel(fromKey(ev.date))}{ev.time ? ` · ${ev.time}` : ""}{ev.duration ? ` · ${ev.duration}` : ""}<br />
        {user?.name || "Unassigned"}{office && ev.details?.fromEngineer ? ` · from ${ev.details.fromEngineer}` : ""}
      </div>

      {addr ? (
        <div style={{ marginBottom: 14 }}><AddressLinks address={addr} phone={job?.phone} /></div>
      ) : (
        <div style={{ fontSize: 12.5, color: TOKENS.slateLight, marginBottom: 14 }}>
          No site address on this booking. <button className="btn-ghost" onClick={onEdit} style={{ padding: 0, fontWeight: 700, color: TOKENS.accent2 }}>Add one →</button>
          {job?.phone && <div style={{ marginTop: 8 }}><AddressLinks phone={job.phone} /></div>}
        </div>
      )}

      {ev.notes && <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", background: office ? `${TOKENS.amber}10` : TOKENS.paper, borderRadius: 8, padding: "9px 11px", marginBottom: 12 }}>{ev.notes}</div>}

      {ev.outcome && (
        <div style={{ fontSize: 13.5, color: ev.outcome === "completed" ? TOKENS.green : TOKENS.red, marginBottom: 12, display: "flex", gap: 6, alignItems: "flex-start" }}>
          {ev.outcome === "completed" ? <CheckCircle2 size={18} style={{ flexShrink: 0 }} /> : <XCircle size={18} style={{ flexShrink: 0 }} />}
          <span><strong>{office ? "Sent" : ev.outcome === "completed" ? "Accepted" : "Rejected"}</strong>{ev.outcomeNote ? ` — ${ev.outcomeNote}` : ""}{ev.outcome === "rejected" && ev.details && "rebook" in ev.details ? (ev.details.rebook ? " · rebooked" : " · not rebooked") : ""}</span>
        </div>
      )}

      {job && (
        <button className="btn" onClick={() => onOpenJob(job.id)} style={{ width: "100%", textAlign: "left", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span><span className="ticket" style={{ color: TOKENS.accent, fontWeight: 700 }}>{job.number}</span> · {job.customer}</span><span style={{ color: TOKENS.accent2 }}>Open job →</span>
        </button>
      )}

      {!ev.outcome && (
        office ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => onMarkOutcome(ev, "completed")} style={bigBtn(TOKENS.green)}><Check size={22} strokeWidth={3} /> Mark sent</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => onMarkOutcome(ev, "completed")} style={bigBtn(TOKENS.green)}><Check size={22} strokeWidth={3} /> Accept</button>
            <button onClick={() => onMarkOutcome(ev, "rejected")} style={bigBtn(TOKENS.red)}><X size={22} strokeWidth={3} /> Reject</button>
          </div>
        )
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {job && !office && <button className="btn" style={{ flex: 1 }} onClick={() => onLogWork(job, ev.date)}>Log work</button>}
        <button className="btn" style={{ flex: 1 }} onClick={onEdit}>Edit booking</button>
      </div>
    </ModalShell>
  );
}

function FeedbackRow({ ev, user, onOpen, onMarkOutcome }) {
  const office = isOfficeKind(ev.kind);
  const edge = ev.outcome === "completed" ? TOKENS.green : ev.outcome === "rejected" ? TOKENS.red : office ? TOKENS.amber : TOKENS.line;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", background: "white", border: `1px solid ${TOKENS.line}`, borderLeft: `4px solid ${edge}`, borderRadius: 8, padding: "8px 8px 8px 10px" }}>
      <div onClick={() => onOpen(ev)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{shortDate(ev.date)}{ev.time ? ` · ${ev.time}` : ""} — {ev.title}</div>
        <div style={{ fontSize: 11.5, color: TOKENS.slate }}>{user?.name || "Unassigned"}{office && !ev.outcome ? " · office to do" : ""}</div>
        {ev.outcomeNote && <div style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{ev.outcomeNote}</div>}
        {ev.outcome === "rejected" && ev.details && "rebook" in ev.details && <div style={{ fontSize: 12, marginTop: 3, color: TOKENS.red }}>{ev.details.rebook ? "Rebooked" : "Not rebooked"}</div>}
        {ev.details?.finished && ev.details?.invoiceNotes && <div style={{ fontSize: 12.5, marginTop: 3, color: TOKENS.green }}><strong>To invoice:</strong> {ev.details.invoiceNotes}</div>}
        {ev.details?.quoteBy && <div style={{ fontSize: 12, marginTop: 3, color: TOKENS.slate }}>{ev.details.quoteBy === "office" ? "Office to price & send" : "Engineer pricing it"}</div>}
        {ev.signaturePath && <SignatureThumb path={ev.signaturePath} name={ev.signedName} />}
      </div>
      {!ev.outcome && !office && ev.date > toKey(new Date())
        ? <span style={{ fontSize: 12, fontWeight: 700, color: TOKENS.slateLight, flexShrink: 0 }}>Booked</span>
        : <TickCross ev={ev} onMarkOutcome={onMarkOutcome} />}
    </div>
  );
}

function SiteAddress({ job, customer, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(job.address || "");
  useEffect(() => { setVal(job.address || ""); }, [job.address]);
  const custAddr = (customer?.address || "").trim();
  const differs = custAddr && (job.address || "").trim().toLowerCase() !== custAddr.toLowerCase();
  const label = <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 4 }}>Job site address</div>;

  if (editing) {
    return (
      <div>
        {label}
        <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder="Site address incl. postcode" />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => { onSave(val.trim()); setEditing(false); }}>Save</button>
          {custAddr && <button className="btn" onClick={() => setVal(custAddr)}>Same as customer address</button>}
          <button className="btn-ghost" onClick={() => { setVal(job.address || ""); setEditing(false); }}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        {label}
        <button className="btn-ghost" onClick={() => setEditing(true)} style={{ fontSize: 12, fontWeight: 700, color: TOKENS.accent2, padding: 0 }}>{job.address ? "Change" : "+ Add"}</button>
      </div>
      {job.address ? <AddressLinks address={job.address} phone={job.phone} /> : (
        <>
          <div style={{ fontSize: 13, color: TOKENS.slateLight, marginBottom: 6 }}>No site address yet.</div>
          {job.phone && <AddressLinks phone={job.phone} />}
        </>
      )}
      {differs && <div style={{ fontSize: 12, color: TOKENS.slateLight, marginTop: 6 }}>Customer's own address: {custAddr}</div>}
    </div>
  );
}
