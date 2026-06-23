import { useState, useMemo, useEffect, useCallback } from "react";

// ── Supabase config ───────────────────────────────────────────────────────────

// The app can use Vercel/Vite environment variables when they exist,
// and falls back to the values that were already in this file.
const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL || "https://pjrzcmhylemmwibnvsxo.supabase.co";
const SUPA_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcnpjbWh5bGVtbXdpYm52c3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MzYzODMsImV4cCI6MjA5NzIxMjM4M30.dAHY8CRSzit2tckI0eYobriGY-KgOMdik5r6lSwS3ts";
const APP_VERSION = "debug-v3-2026-06-23";

function formatSupabaseError({ table, url, status, statusText, body }) {
  let details = body;

  try {
    const parsed = JSON.parse(body);
    details = parsed.message || parsed.hint || parsed.details || body;
  } catch {
    // Body was not JSON. Keep the raw text.
  }

  const readable = `Supabase ${table} request failed (${status} ${statusText}). ${details || "No details returned."}`;

  console.error(readable, { table, url, status, statusText, body });
  return new Error(readable);
}

async function parseResponse(r) {
  const text = await r.text();
  return text ? JSON.parse(text) : [];
}

function assertSupabaseConfig() {
  if (!SUPA_URL || !SUPA_KEY) {
    throw new Error("Missing Supabase settings. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Project → Settings → Environment Variables, then redeploy.");
  }
}

const db = {
  get headers() {
    return { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` };
  },

  async get(table, params = "") {
    assertSupabaseConfig();
    const url = `${SUPA_URL}/rest/v1/${table}${params}`;

    try {
      const r = await fetch(url, { headers: this.headers });
      if (!r.ok) {
        const body = await r.text();
        throw formatSupabaseError({ table, url, status: r.status, statusText: r.statusText, body });
      }
      return parseResponse(r);
    } catch (err) {
      if (err instanceof TypeError) {
        console.error("Network-level Supabase error", { table, url, err });
        throw new Error(`Could not reach Supabase. Check that the project URL is correct and that the Supabase project is active. URL: ${SUPA_URL}`);
      }
      throw err;
    }
  },

  async post(table, body) {
    assertSupabaseConfig();
    const url = `${SUPA_URL}/rest/v1/${table}`;

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { ...this.headers, "Prefer": "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const responseBody = await r.text();
        throw formatSupabaseError({ table, url, status: r.status, statusText: r.statusText, body: responseBody });
      }
      return parseResponse(r);
    } catch (err) {
      if (err instanceof TypeError) {
        console.error("Network-level Supabase error", { table, url, err });
        throw new Error(`Could not reach Supabase. Check that the project URL is correct and that the Supabase project is active. URL: ${SUPA_URL}`);
      }
      throw err;
    }
  },

  async delete(table, params) {
    assertSupabaseConfig();
    const url = `${SUPA_URL}/rest/v1/${table}${params}`;

    try {
      const r = await fetch(url, {
        method: "DELETE", headers: this.headers,
      });
      if (!r.ok) {
        const body = await r.text();
        throw formatSupabaseError({ table, url, status: r.status, statusText: r.statusText, body });
      }
    } catch (err) {
      if (err instanceof TypeError) {
        console.error("Network-level Supabase error", { table, url, err });
        throw new Error(`Could not reach Supabase. Check that the project URL is correct and that the Supabase project is active. URL: ${SUPA_URL}`);
      }
      throw err;
    }
  },
};

// ── Static data ───────────────────────────────────────────────────────────────

const COMPANIES = [
  {
    id: "nordic_trials",
    name: "Nordic Trials AB",
    projects: [
      { id: "nt_study1", name: "Study: CardioPhase III",  isStudy: true },
      { id: "nt_study2", name: "Study: NeuroPilot 2024",  isStudy: true },
      { id: "nt_study3", name: "Study: OncoBridge Alpha", isStudy: true },
      { id: "nt_ops",    name: "Operations & Admin",      isStudy: false },
    ],
  },
  {
    id: "pharma_launch",
    name: "PharmaLaunch Group",
    projects: [
      { id: "pl_market",  name: "Market Entry Strategy" },
      { id: "pl_reg",     name: "Regulatory Affairs" },
      { id: "pl_partner", name: "Partner Relations" },
    ],
  },
  {
    id: "vitalline",
    name: "VitalLine Commerce",
    projects: [
      { id: "vl_b2b",    name: "B2B Sales" },
      { id: "vl_online", name: "Online Store" },
      { id: "vl_supply", name: "Supply Chain" },
    ],
  },
];

const COMPANY_COLORS = ["#4F46E5", "#0891B2", "#059669"];
const today = () => new Date().toISOString().split("T")[0];

function getCompanyById(id)               { return COMPANIES.find(c => c.id === id); }
function getProjectById(companyId, projId){ return getCompanyById(companyId)?.projects.find(p => p.id === projId); }

// ── CSV export ────────────────────────────────────────────────────────────────

function buildCSV(entries, users) {
  const header = ["Date","Employee","Company","Project","Hours","Note"];
  const rows = entries.map(e => [
    e.date,
    users.find(u => u.id === e.user_id)?.name || e.user_id,
    getCompanyById(e.company_id)?.name  || e.company_id,
    getProjectById(e.company_id, e.project_id)?.name || e.project_id,
    e.hours,
    '"' + (e.note || "").replace(/"/g, '""') + '"',
  ]);
  return [header, ...rows].map(r => r.join(",")).join("\n");
}

function CSVModal({ entries, users, onClose }) {
  const csv = buildCSV(entries, users);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(csv)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {
        const el = document.getElementById("csv-ta");
        if (el) { el.select(); document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); }
      });
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:680, maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 48px rgba(0,0,0,0.18)" }}>
        <div style={{ padding:"1.25rem 1.5rem", borderBottom:"1px solid #EAECF0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>Export CSV</div>
            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>Copy and paste into Excel or Google Sheets</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={copy} style={{ background:copied?"#059669":"#1A1D23", color:"#fff", border:"none", borderRadius:8, padding:"7px 16px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"background 0.2s" }}>
              {copied ? "Copied!" : "Copy all"}
            </button>
            <button onClick={onClose} style={{ background:"none", border:"1px solid #E5E7EB", borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer", color:"#374151" }}>Close</button>
          </div>
        </div>
        <textarea id="csv-ta" readOnly value={csv} onClick={e => e.target.select()}
          style={{ flex:1, padding:"1rem 1.5rem", fontFamily:"monospace", fontSize:12, border:"none", outline:"none", resize:"none", overflowY:"auto", background:"#FAFAFA", color:"#374151", lineHeight:1.6, minHeight:280 }} />
        <div style={{ padding:"0.75rem 1.5rem", borderTop:"1px solid #EAECF0", fontSize:12, color:"#9CA3AF" }}>
          Click inside the text to select all, then Ctrl+C / Cmd+C
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  app:      { minHeight:"100vh", background:"#F7F8FA", fontFamily:"'Inter', sans-serif", color:"#1A1D23" },
  center:   { display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" },
  card:     { background:"#fff", borderRadius:16, boxShadow:"0 4px 32px rgba(0,0,0,0.08)", padding:"2.5rem 2rem", width:"100%", maxWidth:420 },
  page:     { maxWidth:860, margin:"0 auto", padding:"2rem 1.5rem" },
  nav:      { background:"#fff", borderBottom:"1px solid #EAECF0", padding:"0 2rem", display:"flex", alignItems:"center", justifyContent:"space-between", height:56 },
  navLogo:  { fontWeight:700, fontSize:15, letterSpacing:"-0.3px" },
  navName:  { fontSize:13, color:"#6B7280" },
  h1:       { fontSize:22, fontWeight:700, margin:"0 0 4px", letterSpacing:"-0.4px" },
  sub:      { fontSize:14, color:"#6B7280", margin:"0 0 2rem" },
  label:    { fontSize:12, fontWeight:600, color:"#374151", textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:5 },
  input:    { width:"100%", boxSizing:"border-box", border:"1px solid #E5E7EB", borderRadius:8, padding:"9px 12px", fontSize:14, outline:"none", background:"#FAFAFA" },
  select:   { width:"100%", boxSizing:"border-box", border:"1px solid #E5E7EB", borderRadius:8, padding:"9px 12px", fontSize:14, outline:"none", background:"#FAFAFA" },
  field:    { marginBottom:"1.25rem" },
  btn:      { width:"100%", background:"#1A1D23", color:"#fff", border:"none", borderRadius:10, padding:"11px", fontSize:14, fontWeight:600, cursor:"pointer" },
  btnSm:    { background:"#1A1D23", color:"#fff", border:"none", borderRadius:8, padding:"7px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
  btnGhost: { background:"none", border:"1px solid #EAECF0", borderRadius:8, padding:"5px 14px", fontSize:13, cursor:"pointer", color:"#374151" },
  error:    { background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#DC2626", marginBottom:"1rem" },
  success:  { background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#15803D", marginBottom:"1rem" },
  tableWrap:{ overflowX:"auto", borderRadius:12, border:"1px solid #EAECF0", background:"#fff" },
  table:    { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:       { background:"#F9FAFB", padding:"10px 14px", textAlign:"left", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:"0.5px", color:"#6B7280", borderBottom:"1px solid #EAECF0" },
  td:       { padding:"10px 14px", borderBottom:"1px solid #F3F4F6", color:"#374151", verticalAlign:"top" },
  tdMuted:  { padding:"10px 14px", borderBottom:"1px solid #F3F4F6", color:"#9CA3AF", fontSize:12 },
  badge:    (color) => ({ display:"inline-block", background:color+"18", color, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }),
  studyTag: { display:"inline-block", background:"#EEF2FF", color:"#4F46E5", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:600, marginLeft:6 },
  row:      { display:"flex", gap:"1rem" },
  flex:     { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" },
  empty:    { textAlign:"center", padding:"3rem 1rem", color:"#9CA3AF", fontSize:14 },
  hint:     { fontSize:12, color:"#9CA3AF", marginTop:4 },
  spinner:  { display:"flex", alignItems:"center", justifyContent:"center", padding:"3rem", color:"#9CA3AF", fontSize:14 },
};

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const [loading, setLoading]   = useState(false);

  const testConnection = async () => {
    setLoading(true); setErr(""); setDebugInfo("Testing Supabase connection...");
    try {
      const rows = await db.get("users", "?select=id,username,role&limit=5");
      setDebugInfo(`Supabase connection OK. Found ${rows.length} user row(s): ${rows.map(u => u.username).join(", ") || "none"}`);
    } catch(e) {
      console.error("Connection test failed:", e);
      setErr(e.message || "Connection test failed with an unknown error.");
      setDebugInfo(`App version ${APP_VERSION}. Supabase URL: ${SUPA_URL}`);
    } finally {
      setLoading(false);
    }
  };

  const handle = async () => {
    if (!username || !password) { setErr("Please enter username and password."); return; }
    setLoading(true); setErr(""); setDebugInfo("");
    try {
      const rows = await db.get("users", `?username=eq.${encodeURIComponent(username)}&select=*`);
      if (!rows.length || rows[0].password_hash !== password) {
        setErr("Incorrect username or password."); setLoading(false); return;
      }
      onLogin(rows[0]);
    } catch(e) {
      console.error("Login failed:", e);
      setErr(e.message || "Connection error. Please try again.");
      setDebugInfo(`App version ${APP_VERSION}. Supabase URL: ${SUPA_URL}`);
      setLoading(false);
    }
  };

  return (
    <div style={S.center}>
      <div style={S.card}>
        <div style={{ marginBottom:"2rem" }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", color:"#9CA3AF", marginBottom:8 }}>Time Reporting</div>
          <h1 style={{ ...S.h1, fontSize:26 }}>Sign in</h1>
          <p style={S.sub}>Log your hours across companies and projects.</p>
        </div>
        {err && <div style={S.error}>{err}</div>}
        {debugInfo && <div style={S.success}>{debugInfo}</div>}
        <div style={S.field}>
          <label style={S.label}>Username</label>
          <input style={S.input} value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. anna" onKeyDown={e => e.key === "Enter" && handle()} autoFocus />
        </div>
        <div style={S.field}>
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handle()} />
        </div>
        <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} onClick={handle} disabled={loading}>
          {loading ? "Working…" : "Sign in"}
        </button>
        <button
          style={{ ...S.btnGhost, width:"100%", marginTop:10, padding:"9px 12px" }}
          onClick={testConnection}
          disabled={loading}
        >
          Test Supabase connection
        </button>
        <div style={{ ...S.hint, marginTop:12 }}>App version: {APP_VERSION}</div>
      </div>
    </div>
  );
}

// ── Employee view ─────────────────────────────────────────────────────────────

function EmployeeView({ user, onLogout }) {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [date, setDate]         = useState(today());
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  const [projectId, setProjectId] = useState(COMPANIES[0].projects[0].id);
  const [hours, setHours]       = useState("");
  const [note, setNote]         = useState("");
  const [msg, setMsg]           = useState("");
  const [err, setErr]           = useState("");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.get("time_entries", `?user_id=eq.${user.id}&order=date.desc&select=*`);
      setEntries(rows);
    } catch(e) {
      console.error("Could not load time entries:", e);
      setErr(e.message || "Could not load your time entries.");
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleCompany = (cid) => { setCompanyId(cid); setProjectId(getCompanyById(cid).projects[0].id); };

  const handleSubmit = async () => {
    const h = parseFloat(hours);
    if (!date || isNaN(h) || h <= 0 || h > 24) { setErr("Please enter a valid date and hours (0.25–24)."); setMsg(""); return; }
    setSaving(true); setErr("");
    try {
      await db.post("time_entries", { user_id: user.id, date, company_id: companyId, project_id: projectId, hours: h, note });
      setHours(""); setNote(""); setMsg("Entry saved.");
      setTimeout(() => setMsg(""), 3000);
      loadEntries();
    } catch(e) {
      console.error("Could not save time entry:", e);
      setErr(e.message || "Failed to save. Please try again.");
    }
    setSaving(false);
  };

  const company = getCompanyById(companyId);
  const myTotal = entries.reduce((s, e) => s + parseFloat(e.hours), 0);

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Log time</h1>
      <p style={S.sub}>Hi {user.name.split(" ")[0]} — record your hours below.</p>

      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #EAECF0", padding:"1.75rem", marginBottom:"2rem" }}>
        {err && <div style={S.error}>{err}</div>}
        {msg && <div style={S.success}>{msg}</div>}

        <div style={S.row}>
          <div style={{ ...S.field, flex:1 }}>
            <label style={S.label}>Date</label>
            <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ ...S.field, flex:1 }}>
            <label style={S.label}>Hours</label>
            <input style={S.input} type="number" min="0.25" max="24" step="0.25" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 7.5" />
          </div>
        </div>

        <div style={S.field}>
          <label style={S.label}>Company</label>
          <select style={S.select} value={companyId} onChange={e => handleCompany(e.target.value)}>
            {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={S.field}>
          <label style={S.label}>Project{company?.projects.some(p => p.isStudy) ? " / Study" : ""}</label>
          <select style={S.select} value={projectId} onChange={e => setProjectId(e.target.value)}>
            {company?.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={S.field}>
          <label style={S.label}>Note <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0, color:"#9CA3AF" }}>(optional)</span></label>
          <input style={S.input} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Patient follow-up calls" />
        </div>

        <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving…" : "Save entry"}
        </button>
      </div>

      <div style={S.flex}>
        <h2 style={{ fontSize:16, fontWeight:700, margin:0 }}>Your entries</h2>
        <span style={{ fontSize:13, color:"#6B7280" }}>{entries.length} entries · {myTotal.toFixed(1)}h total</span>
      </div>

      {loading
        ? <div style={S.spinner}>Loading…</div>
        : entries.length === 0
          ? <div style={S.empty}>No entries yet. Log your first hours above.</div>
          : (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Company</th>
                    <th style={S.th}>Project</th>
                    <th style={S.th}>Hours</th>
                    <th style={S.th}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const c  = getCompanyById(e.company_id);
                    const p  = getProjectById(e.company_id, e.project_id);
                    const ci = COMPANIES.findIndex(x => x.id === e.company_id);
                    return (
                      <tr key={e.id}>
                        <td style={S.td}>{e.date}</td>
                        <td style={S.td}><span style={S.badge(COMPANY_COLORS[ci]||"#374151")}>{c?.name}</span></td>
                        <td style={S.td}>{p?.name}{p?.isStudy && <span style={S.studyTag}>study</span>}</td>
                        <td style={{ ...S.td, fontWeight:600 }}>{parseFloat(e.hours).toFixed(1)}h</td>
                        <td style={S.tdMuted}>{e.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
      }
    </div>
  );
}

// ── Statistics helpers ────────────────────────────────────────────────────────

function HoursBar({ hours, max, color }) {
  const pct = max > 0 ? (hours / max) * 100 : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, background:"#F3F4F6", borderRadius:4, height:8, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, background:color, height:"100%", borderRadius:4, transition:"width 0.4s" }} />
      </div>
      <span style={{ fontSize:13, fontWeight:600, minWidth:42, textAlign:"right" }}>{hours.toFixed(1)}h</span>
    </div>
  );
}

function StatisticsPanel({ filtered, users }) {
  const stats = useMemo(() => {
    const byProject = {}, byEmployee = {}, byEmpProject = {};
    filtered.forEach(e => {
      const pk = `${e.company_id}||${e.project_id}`;
      byProject[pk] = (byProject[pk] || 0) + parseFloat(e.hours);
      byEmployee[e.user_id] = (byEmployee[e.user_id] || 0) + parseFloat(e.hours);
      if (!byEmpProject[e.user_id]) byEmpProject[e.user_id] = {};
      byEmpProject[e.user_id][pk] = (byEmpProject[e.user_id][pk] || 0) + parseFloat(e.hours);
    });

    const projectRows = Object.entries(byProject).map(([key, hours]) => {
      const [cid, pid] = key.split("||");
      const ci = COMPANIES.findIndex(x => x.id === cid);
      return { key, cid, pid, hours, companyName: getCompanyById(cid)?.name, projectName: getProjectById(cid,pid)?.name, isStudy: getProjectById(cid,pid)?.isStudy, color: COMPANY_COLORS[ci]||"#374151" };
    }).sort((a,b) => b.hours - a.hours);

    const employeeRows = Object.entries(byEmployee).map(([uid, hours]) => ({
      uid, hours, name: users.find(u => u.id === uid)?.name || uid,
    })).sort((a,b) => b.hours - a.hours);

    const empProjectRows = Object.entries(byEmpProject).map(([uid, projects]) => ({
      name: users.find(u => u.id === uid)?.name || uid,
      projects: Object.entries(projects).map(([key, hours]) => {
        const [cid, pid] = key.split("||");
        const ci = COMPANIES.findIndex(x => x.id === cid);
        return { key, hours, projectName: getProjectById(cid,pid)?.name || pid, isStudy: getProjectById(cid,pid)?.isStudy, color: COMPANY_COLORS[ci]||"#374151" };
      }).sort((a,b) => b.hours - a.hours),
    }));

    return { projectRows, employeeRows, empProjectRows };
  }, [filtered, users]);

  if (filtered.length === 0) return <div style={S.empty}>No entries match the current filters.</div>;

  const maxP = stats.projectRows[0]?.hours || 1;
  const maxE = stats.employeeRows[0]?.hours || 1;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>
      <div style={{ background:"#fff", border:"1px solid #EAECF0", borderRadius:14, padding:"1.5rem" }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:"1.25rem" }}>Total hours per project</div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {stats.projectRows.map(r => (
            <div key={r.key}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{r.projectName}</span>
                {r.isStudy && <span style={S.studyTag}>study</span>}
                <span style={{ ...S.badge(r.color), marginLeft:"auto" }}>{r.companyName}</span>
              </div>
              <HoursBar hours={r.hours} max={maxP} color={r.color} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:"#fff", border:"1px solid #EAECF0", borderRadius:14, padding:"1.5rem" }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:"1.25rem" }}>Total hours per employee</div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {stats.employeeRows.map(r => (
            <div key={r.uid}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:5 }}>{r.name}</div>
              <HoursBar hours={r.hours} max={maxE} color="#1A1D23" />
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:"#fff", border:"1px solid #EAECF0", borderRadius:14, padding:"1.5rem" }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:"1.25rem" }}>Breakdown — employee × project</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>
          {stats.empProjectRows.map(emp => {
            const empMax = emp.projects[0]?.hours || 1;
            return (
              <div key={emp.name}>
                <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", color:"#6B7280", marginBottom:10 }}>{emp.name}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {emp.projects.map(p => (
                    <div key={p.key}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:12 }}>{p.projectName}</span>
                        {p.isStudy && <span style={S.studyTag}>study</span>}
                      </div>
                      <HoursBar hours={p.hours} max={empMax} color={p.color} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────

function AdminView({ onLogout }) {
  const [entries, setEntries]         = useState([]);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState("stats");
  const [showCSV, setShowCSV]         = useState(false);
  const [filterUser, setFilterUser]   = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterFrom, setFilterFrom]   = useState("");
  const [filterTo, setFilterTo]       = useState("");

  useEffect(() => {
    Promise.all([
      db.get("time_entries", "?order=date.desc&select=*"),
      db.get("users", "?role=eq.employee&select=*"),
    ]).then(([ent, usr]) => { setEntries(ent); setUsers(usr); setLoading(false); })
      .catch(e => { console.error("Could not load admin data:", e); setLoading(false); });
  }, []);

  const filtered = useMemo(() => entries.filter(e => {
    if (filterUser    !== "all" && e.user_id    !== filterUser)    return false;
    if (filterCompany !== "all" && e.company_id !== filterCompany) return false;
    if (filterFrom && e.date < filterFrom) return false;
    if (filterTo   && e.date > filterTo)   return false;
    return true;
  }), [entries, filterUser, filterCompany, filterFrom, filterTo]);

  const totalHours = filtered.reduce((s, e) => s + parseFloat(e.hours), 0);

  const tabStyle = (active) => ({
    padding:"7px 18px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", border:"none",
    background: active ? "#1A1D23" : "transparent", color: active ? "#fff" : "#6B7280",
  });

  if (loading) return <div style={S.spinner}>Loading data…</div>;

  return (
    <div style={S.page}>
      {showCSV && <CSVModal entries={filtered} users={users} onClose={() => setShowCSV(false)} />}

      <div style={S.flex}>
        <div>
          <h1 style={S.h1}>Admin dashboard</h1>
          <p style={{ ...S.sub, marginBottom:0 }}>Only you can see this view.</p>
        </div>
        {tab === "entries" && <button style={S.btnSm} onClick={() => setShowCSV(true)}>Export CSV</button>}
      </div>

      {/* Summary */}
      <div style={{ display:"flex", gap:"1rem", marginBottom:"1.75rem", flexWrap:"wrap" }}>
        {[
          { label:"Filtered entries",  value: filtered.length },
          { label:"Total hours",       value: totalHours.toFixed(1) + "h" },
          { label:"Employees active",  value: [...new Set(filtered.map(e => e.user_id))].length },
        ].map(s => (
          <div key={s.label} style={{ background:"#fff", border:"1px solid #EAECF0", borderRadius:12, padding:"1rem 1.5rem", flex:1, minWidth:120 }}>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.5px" }}>{s.value}</div>
            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #EAECF0", padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.5px", textTransform:"uppercase", color:"#9CA3AF", marginBottom:12 }}>Filters — apply to both tabs</div>
        <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:140 }}>
            <label style={S.label}>Employee</label>
            <select style={S.select} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="all">All employees</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div style={{ flex:1, minWidth:140 }}>
            <label style={S.label}>Company</label>
            <select style={S.select} value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
              <option value="all">All companies</option>
              {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex:1, minWidth:120 }}>
            <label style={S.label}>From</label>
            <input style={S.input} type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div style={{ flex:1, minWidth:120 }}>
            <label style={S.label}>To</label>
            <input style={S.input} type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:"#F3F4F6", borderRadius:10, padding:4, marginBottom:"1.5rem", width:"fit-content" }}>
        <button style={tabStyle(tab === "stats")}   onClick={() => setTab("stats")}>Statistics</button>
        <button style={tabStyle(tab === "entries")} onClick={() => setTab("entries")}>All entries</button>
      </div>

      {tab === "stats" && <StatisticsPanel filtered={filtered} users={users} />}

      {tab === "entries" && (
        filtered.length === 0
          ? <div style={S.empty}>No entries match the current filters.</div>
          : (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Employee</th>
                    <th style={S.th}>Company</th>
                    <th style={S.th}>Project</th>
                    <th style={S.th}>Hours</th>
                    <th style={S.th}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const u  = users.find(x => x.id === e.user_id);
                    const c  = getCompanyById(e.company_id);
                    const p  = getProjectById(e.company_id, e.project_id);
                    const ci = COMPANIES.findIndex(x => x.id === e.company_id);
                    return (
                      <tr key={e.id}>
                        <td style={S.td}>{e.date}</td>
                        <td style={S.td}>{u?.name}</td>
                        <td style={S.td}><span style={S.badge(COMPANY_COLORS[ci]||"#374151")}>{c?.name}</span></td>
                        <td style={S.td}>{p?.name}{p?.isStudy && <span style={S.studyTag}>study</span>}</td>
                        <td style={{ ...S.td, fontWeight:600 }}>{parseFloat(e.hours).toFixed(1)}h</td>
                        <td style={S.tdMuted}>{e.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  );
}

// ── App shell ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <div style={S.app}>
      {!user ? (
        <LoginScreen onLogin={setUser} />
      ) : (
        <>
          <nav style={S.nav}>
            <span style={S.navLogo}>⏱ TimeReport</span>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={S.navName}>{user.name}{user.role === "admin" && " · Admin"}</span>
              <button style={S.btnGhost} onClick={() => setUser(null)}>Sign out</button>
            </div>
          </nav>
          {user.role === "admin"
            ? <AdminView onLogout={() => setUser(null)} />
            : <EmployeeView user={user} onLogout={() => setUser(null)} />
          }
        </>
      )}
    </div>
  );
}
