import React, { useState, useEffect, useMemo, useRef } from "react";
import { CalendarDays, ClipboardList, Users, HardHat, Plus, ChevronLeft, ChevronRight, X, Camera, ArrowLeft, LogOut } from "lucide-react";
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

const NAV_ITEMS = [
  { id: "diary", label: "Diary", Icon: CalendarDays },
  { id: "jobs", label: "Jobs", Icon: ClipboardList },
  { id: "customers", label: "Customers", Icon: Users },
  { id: "team", label: "Team", Icon: HardHat },
];

const pad2 = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const monthLabel = (d) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const dayLabel = (d) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (k) => fromKey(k).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const uid = () => Math.random().toString(36).slice(2, 10);

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
    customer: row.customer, address: row.address, phone: row.phone, description: row.description,
    assignedTo: row.assigned_to, createdAt: row.created_at,
    checklist: row.checklist || [], notes: row.notes || [],
    safety: row.safety || { signedOff: false, signedBy: null, signedAt: null, siteNotes: "" },
  };
}
function eventFromDb(row) {
  return { id: row.id, date: row.date, time: row.time, duration: row.duration, title: row.title, jobId: row.job_id, assignedTo: row.assigned_to, notes: row.notes };
}
function toDbJob(patch) {
  const map = { assignedTo: "assigned_to", jobType: "job_type", customerId: "customer_id" };
  const out = {};
  for (const [k, v] of Object.entries(patch)) out[map[k] || k] = v;
  return out;
}
function toDbEvent(patch) {
  const map = { assignedTo: "assigned_to", jobId: "job_id" };
  const out = {};
  for (const [k, v] of Object.entries(patch)) out[map[k] || k] = v;
  return out;
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(undefined); // undefined = checking/none yet
  const [profiles, setProfiles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [events, setEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const jobsRef = useRef([]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  const [view, setView] = useState("diary");
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

  // ---- auth session ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
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

  const fetchProfiles = async () => { const { data } = await supabase.from("profiles").select("*").order("name"); setProfiles(data || []); };
  const fetchCustomers = async () => { const { data } = await supabase.from("customers").select("*").order("name"); setCustomers(data || []); };
  const fetchJobs = async () => { const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }); setJobs((data || []).map(jobFromDb)); };
  const fetchEvents = async () => { const { data } = await supabase.from("events").select("*").order("date"); setEvents((data || []).map(eventFromDb)); };
  const loadAll = async () => { setDataLoading(true); await Promise.all([fetchProfiles(), fetchCustomers(), fetchJobs(), fetchEvents()]); setDataLoading(false); };

  useEffect(() => {
    if (!profile) return;
    loadAll();
    const onVisible = () => { if (document.visibilityState === "visible") loadAll(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const userById = useMemo(() => Object.fromEntries(profiles.map((u) => [u.id, u])), [profiles]);
  const jobById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])), [jobs]);
  const customerById = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);

  const visibleTechs = activeTechs ?? profiles.map((u) => u.id);
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!visibleTechs.includes(ev.assignedTo)) continue;
      (map[ev.date] ||= []).push(ev);
    }
    for (const k in map) map[k].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    return map;
  }, [events, visibleTechs]);

  const signOut = async () => { await supabase.auth.signOut(); setView("diary"); };

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
        const { data: newCust, error: custErr } = await supabase.from("customers").insert({ name: form.customer, address: form.address, phone: form.phone }).select().single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }
      const { data: newJob, error: jobErr } = await supabase.from("jobs").insert({
        number, kind, status: kind === "quote" ? "quote" : "confirmed",
        job_type: form.jobType, priority: form.priority, customer_id: customerId,
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
    setSaveState("saving");
    const { error } = await supabase.from("jobs").update(toDbJob(patch)).eq("id", id);
    if (error) { console.error(error); setSaveState("error"); return; }
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    setSaveState("saved");
  };

  const addJobNote = async (id, text, date) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (!job) return;
    const notes = [...job.notes, { id: uid(), ts: new Date().toISOString(), date: date || toKey(new Date()), author: profile?.name || "Unknown", text }];
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

  const openJobFromAnywhere = (id) => { setOpenJobId(id); setView("jobs"); };

  // ---- render states ----
  if (authLoading || session === undefined) {
    return <CentredMessage>Loading Aqualec Job Tracker…</CentredMessage>;
  }
  if (!session) {
    return <AuthGate />;
  }
  if (profile === undefined) {
    return <CentredMessage>Loading your profile…</CentredMessage>;
  }
  if (profile === null) {
    return <ProfileSetup session={session} onDone={(p) => setProfile(p)} onSignOut={signOut} />;
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

      <Sidebar view={view} setView={setView} jobs={jobs} events={events} saveState={saveState} currentUser={profile} onSignOut={signOut}
        onQuickJob={() => setJobModal({ mode: "new", kind: "job" })} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <MobileTopBar currentUser={profile} saveState={saveState} onSignOut={signOut} onQuickJob={() => setJobModal({ mode: "new", kind: "job" })} />

        <div className="scrollbar main-content" style={{ flex: 1, overflowY: "auto" }}>
          {view === "diary" && (
            <DiaryView cursor={cursor} setCursor={setCursor} today={today} selectedDay={selectedDay} setSelectedDay={setSelectedDay}
              eventsByDay={eventsByDay} users={profiles} activeTechs={activeTechs} setActiveTechs={setActiveTechs}
              jobById={jobById} userById={userById}
              onNewEvent={(date) => setEventModal({ date })}
              onEditEvent={(ev) => setEventModal({ date: ev.date, event: ev })}
              onOpenJob={openJobFromAnywhere}
              onLogWork={(job, date) => setLogWorkModal({ job, date })} />
          )}

          {view === "jobs" && (
            <JobsView jobs={jobs} users={profiles} userById={userById} customerById={customerById}
              jobFilter={jobFilter} setJobFilter={setJobFilter} jobSearch={jobSearch} setJobSearch={setJobSearch}
              openJobId={openJobId} setOpenJobId={setOpenJobId}
              onNewJob={(kind) => setJobModal({ mode: "new", kind })}
              onAddNote={addJobNote} onUpdateJob={updateJob} onConvert={convertQuoteToJob}
              onBookVisit={(job) => setEventModal({ date: toKey(new Date()), event: null, presetJob: job })}
              events={events} images={images} loadImages={loadImages} addImages={addImages} removeImage={removeImage}
              checklistOps={{ addChecklistItem, toggleChecklistItem, removeChecklistItem }}
              onOpenCustomer={(id) => { setOpenCustomerId(id); setView("customers"); }}
              onDeleteJob={async (id) => { const ok = await deleteJob(id); if (ok) setOpenJobId(null); }}
              currentUser={profile} onUpdateSafety={updateJobSafety}
        if (err) throw err;
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

        {checkEmail ? (
          <div style={{ fontSize: 13.5, color: "#AEB6BD", lineHeight: 1.6 }}>
            Check your email to confirm your account, then come back and sign in.
            <button onClick={() => { setCheckEmail(false); setMode("signin"); }} style={{ display: "block", marginTop: 16, width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700 }}>Back to sign in</button>
          </div>
        ) : (
          <div style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 10 }}><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div style={{ marginBottom: 10 }}><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <div style={{ color: "#E88", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
            <button disabled={busy || !email || !password} onClick={submit} style={{ width: "100%", background: TOKENS.accent, border: "none", color: "white", borderRadius: 8, padding: "12px 0", fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
              {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
            <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }} style={{ marginTop: 12, background: "none", border: "none", color: "#9AA3AC", fontSize: 12.5, width: "100%" }}>
              {mode === "signup" ? "Already have an account? Sign in" : "New team member? Create an account"}
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
function Sidebar({ view, setView, jobs, events, saveState, currentUser, onSignOut, onQuickJob }) {
  const openQuotes = jobs.filter((j) => j.kind === "quote" && j.status === "quote").length;
  const inProgress = jobs.filter((j) => j.status === "in_progress").length;
  const readyToInvoice = jobs.filter((j) => j.status === "complete").length;
  const todayKey = toKey(new Date());
  const todayCount = events.filter((e) => e.date === todayKey).length;

  const items = [
    { id: "diary", label: "Diary", sub: `${todayCount} today` },
    { id: "jobs", label: "Jobs & Quotes", sub: `${inProgress} active` },
    { id: "customers", label: "Customers", sub: null },
    { id: "team", label: "Team", sub: null },
  ];

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

function MobileTabBar({ view, setView }) {
  return (
    <div className="mobile-tabbar">
      {NAV_ITEMS.map((it) => {
        const active = view === it.id;
        return (
          <button key={it.id} onClick={() => setView(it.id)} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 4px 8px", color: active ? "white" : "#8A93A0" }}>
            <it.Icon size={19} color={active ? TOKENS.accent : "#8A93A0"} strokeWidth={active ? 2.3 : 2} />
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ================= DIARY ================= */
function DiaryView({ cursor, setCursor, today, selectedDay, setSelectedDay, eventsByDay, users, activeTechs, setActiveTechs, jobById, userById, onNewEvent, onEditEvent, onOpenJob, onLogWork }) {
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
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, minWidth: 150 }}>{monthLabel(cursor)}</div>
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
                    {evs.slice(0, 4).map((ev) => <span key={ev.id} style={{ width: 6, height: 6, borderRadius: "50%", background: (userById[ev.assignedTo]?.colour) || TOKENS.slate, display: "inline-block" }} />)}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dayEvents.map((ev) => {
              const u = userById[ev.assignedTo];
              const job = ev.jobId ? jobById[ev.jobId] : null;
              return (
                <div key={ev.id} style={{ border: `1px solid ${TOKENS.line}`, borderLeft: `3px solid ${u?.colour || TOKENS.slate}`, borderRadius: 7, padding: "8px 10px" }}>
                  <div onClick={() => onEditEvent(ev)} style={{ cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                      <span>{ev.title}</span>
                      <span className="ticket" style={{ fontSize: 11.5, color: TOKENS.slate }}>{ev.time || "—"}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: TOKENS.slate, marginTop: 2 }}>{u?.name || "Unassigned"}{ev.duration ? ` · ${ev.duration}` : ""}</div>
                  </div>
                  {job && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 6, flexWrap: "wrap" }}>
                      <span className="ticket" onClick={() => onOpenJob(job.id)} style={{ cursor: "pointer", fontSize: 10.5, color: TOKENS.accent, fontWeight: 700 }}>{job.number} · {job.customer}</span>
                      <button className="btn" onClick={() => onLogWork(job, ev.date)} style={{ fontSize: 10.5, padding: "4px 9px", minHeight: "auto" }}>Log work</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={() => onNewEvent(selectedDay)}>+ Book on this day</button>
        </div>
      </div>
    </div>
  );
}

/* ================= JOBS ================= */
function JobsView({ jobs, users, userById, customerById, jobFilter, setJobFilter, jobSearch, setJobSearch, openJobId, setOpenJobId, onNewJob, onAddNote, onUpdateJob, onConvert, onBookVisit, events, images, loadImages, addImages, removeImage, checklistOps, onOpenCustomer, currentUser, onUpdateSafety, onPrintSafety, onDeleteJob }) {
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
        currentUser={currentUser} onUpdateSafety={onUpdateSafety} onPrintSafety={onPrintSafety} onDeleteJob={onDeleteJob} />
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
                <div style={{ fontSize: 12, color: TOKENS.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.address || j.description}</div>
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

function JobDetail({ job, users, userById, customer, events, onBack, onAddNote, onUpdateJob, onConvert, onBookVisit, images, loadImages, addImages, removeImage, checklistOps, onOpenCustomer, currentUser, onUpdateSafety, onPrintSafety, onDeleteJob }) {
  const [note, setNote] = useState("");
  const [noteDate, setNoteDate] = useState(toKey(new Date()));
  const [checklistText, setChecklistText] = useState("");
  const [uploading, setUploading] = useState(false);
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
          <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
            {job.jobType && <span style={{ fontSize: 11, color: TOKENS.slate, border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: "1px 6px" }}>{JOB_TYPES[job.jobType]}</span>}
            <span style={{ fontSize: 11, fontWeight: 700, color: prio.colour }}>{prio.label} priority</span>
            {customer && <button className="btn-ghost" onClick={() => onOpenCustomer(customer.id)} style={{ fontSize: 11, fontWeight: 700, color: TOKENS.accent2, padding: 0 }}>View customer →</button>}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.colour, background: `${meta.colour}18`, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>{meta.label}</span>
      </div>

      <ProgressStepper status={job.status} onSet={(s) => onUpdateJob(job.id, { status: s })} />

      <div style={{ fontSize: 13.5, color: TOKENS.slate, marginBottom: 4 }}>{job.address}</div>
      <div style={{ fontSize: 13.5, color: TOKENS.slate, marginBottom: 14 }}>{job.phone}</div>
      <div style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5 }}>{job.description || "No description given."}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        <select value={job.assignedTo || ""} onChange={(e) => onUpdateJob(job.id, { assignedTo: e.target.value || null })} style={{ width: "auto" }}>
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {job.kind === "quote" && <button className="btn btn-primary" onClick={() => onConvert(job.id)}>Convert to job</button>}
        <button className="btn" onClick={() => onBookVisit(job)}>+ Book visit</button>
        {job.status !== "complete" && job.status !== "invoiced" && <button className="btn" style={{ borderColor: TOKENS.green, color: TOKENS.green }} onClick={() => onUpdateJob(job.id, { status: "complete" })}>Ready to invoice</button>}
        {job.status === "complete" && <button className="btn btn-primary" onClick={() => onUpdateJob(job.id, { status: "invoiced" })}>Mark invoiced</button>}
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Progress checklist {checklist.length > 0 && `(${doneCount}/${checklist.length})`}</div>
        {allDone && <div style={{ fontSize: 12.5, color: TOKENS.green, marginBottom: 8, fontWeight: 600 }}>All tasks complete — ready to invoice.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {checklist.map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 7, padding: "9px 10px", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={c.done} onChange={() => checklistOps.toggleChecklistItem(job.id, c.id)} style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span style={{ flex: 1, textDecoration: c.done ? "line-through" : "none", color: c.done ? TOKENS.slateLight : TOKENS.ink }}>{c.text}</span>
              <button className="btn-ghost" onClick={(e) => { e.preventDefault(); checklistOps.removeChecklistItem(job.id, c.id); }} style={{ fontSize: 15, padding: "0 4px" }}><X size={15} /></button>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="e.g. Order parts, Test system, Sign-off" value={checklistText} onChange={(e) => setChecklistText(e.target.value)} />
          <button className="btn" onClick={() => { if (checklistText.trim()) { checklistOps.addChecklistItem(job.id, checklistText.trim()); setChecklistText(""); } }}>Add</button>
        </div>
      </div>

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
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Booked visits</div>
          {events.map((ev) => (
            <div key={ev.id} style={{ fontSize: 12.5, color: TOKENS.slate, padding: "4px 0" }}>{shortDate(ev.date)} — {ev.title} ({userById[ev.assignedTo]?.name || "Unassigned"})</div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.slateLight, textTransform: "uppercase", marginBottom: 6 }}>Daily work notes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {job.notes.length === 0 && <div style={{ fontSize: 13, color: TOKENS.slateLight }}>No notes yet — log what's completed each day here.</div>}
        {job.notes.slice().reverse().map((n) => (
          <div key={n.id} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 7, padding: "8px 10px" }}>
            <div style={{ fontSize: 10.5, color: TOKENS.slateLight, marginBottom: 3, fontWeight: 600 }}>{n.date ? shortDate(n.date) : new Date(n.ts).toLocaleDateString("en-GB")}{n.author ? ` · ${n.author}` : ""}</div>
            <div style={{ fontSize: 13 }}>{n.text}</div>
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
        <div style={{ fontSize: 13.5, color: TOKENS.slate }}>{openCustomer.address}</div>
        <div style={{ fontSize: 13.5, color: TOKENS.slate, marginBottom: 16 }}>{openCustomer.phone}</div>
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
function TeamView({ users, jobs, currentUserId }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Team</div>
      <div style={{ fontSize: 12.5, color: TOKENS.slateLight, marginBottom: 14 }}>Anyone who's created an account shows up here automatically — share the app link with new team members and they can sign themselves up.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {users.map((u) => {
          const active = jobs.filter((j) => j.assignedTo === u.id && !["complete", "invoiced"].includes(j.status)).length;
          return (
            <div key={u.id} style={{ background: "white", border: `1px solid ${TOKENS.line}`, borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: u.colour, display: "inline-block" }} />
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}{u.id === currentUserId && <span style={{ fontSize: 10.5, color: TOKENS.accent2, fontWeight: 700, marginLeft: 6 }}>YOU</span>}</div>
                <div style={{ fontSize: 12, color: TOKENS.slate }}>{u.trade || "Technician"} · {active} active job{active !== 1 ? "s" : ""}</div>
              </div>
            </div>
          );
        })}
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
  const [customerMode, setCustomerMode] = useState(preset ? "existing" : (customers.length ? "existing" : "new"));
  const [selectedCustomerId, setSelectedCustomerId] = useState(preset?.id || "");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState(currentUserId || "");
  const [jobType, setJobType] = useState("service");
  const [priority, setPriority] = useState("normal");

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const canSubmit = customerMode === "existing" ? !!selectedCustomerId : customer.trim().length > 0;

  const handleSubmit = () => {
    if (customerMode === "existing" && selectedCustomer) {
      onCreate({ kind, customerId: selectedCustomer.id, customer: selectedCustomer.name, address: selectedCustomer.address, phone: selectedCustomer.phone, description, assignedTo, jobType, priority });
    } else {
      onCreate({ kind, customerId: null, customer: customer.trim(), address, phone, description, assignedTo, jobType, priority });
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
            <div className="field"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Site address" /></div>
            <div className="field"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" /></div>
          </>
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
  const [title, setTitle] = useState(editing?.title || (preset ? `Visit — ${preset.customer}` : ""));
  const [date, setDate] = useState(editing?.date || modal.date);
  const [time, setTime] = useState(editing?.time || "09:00");
  const [duration, setDuration] = useState(editing?.duration || "1h");
  const [assignedTo, setAssignedTo] = useState(editing?.assignedTo || preset?.assignedTo || (users[0]?.id ?? ""));
  const [jobId, setJobId] = useState(editing?.jobId || preset?.id || "");
  const [notes, setNotes] = useState(editing?.notes || "");

  const linkedJobs = jobs.filter((j) => !["complete", "invoiced"].includes(j.status));

  return (
    <ModalShell title={editing ? "Edit booking" : "Book a visit"} onClose={onClose}>
      <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Boiler service, Site survey" /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div className="field" style={{ flex: 1 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field" style={{ flex: 1 }}><label>Time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
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
          {linkedJobs.map((j) => <option key={j.id} value={j.id}>{j.number} · {j.customer}</option>)}
        </select>
      </div>
      <div className="field"><label>Notes</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access instructions, parts to bring…" /></div>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {editing && <button className="btn" style={{ color: TOKENS.red, borderColor: TOKENS.red }} onClick={() => onDelete(editing.id)}>Delete</button>}
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!title.trim() || !date}
          onClick={() => {
            const payload = { title: title.trim(), date, time, duration, assignedTo: assignedTo || null, jobId: jobId || null, notes };
            if (editing) onUpdate(editing.id, payload); else onCreate(payload);
          }}>
          {editing ? "Save changes" : "Book visit"}
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
