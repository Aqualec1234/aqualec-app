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
