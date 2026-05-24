import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Groq from "groq-sdk";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const app        = express();
const PORT       = process.env.PORT || 3001;

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3000"], credentials: true }));
app.use(express.json());

// ── Data ──────────────────────────────────────────────────────────────────
const incidents  = JSON.parse(readFileSync(join(__dirname, "mockIncidents.json"), "utf-8"));
const MEMORY_FILE = join(__dirname, "memory.json");

function loadMemory() {
  if (!existsSync(MEMORY_FILE)) writeFileSync(MEMORY_FILE, JSON.stringify({ incidents: [], patterns: {} }, null, 2));
  return JSON.parse(readFileSync(MEMORY_FILE, "utf-8"));
}
function saveMemory(mem) {
  writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

// ── Groq ──────────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function callGroq(system, user, maxTokens = 1024) {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    temperature: 0.2,
    max_tokens: maxTokens,
  });
  return res.choices[0]?.message?.content ?? "";
}

// ── Prometheus ────────────────────────────────────────────────────────────
const PROM = "http://localhost:9090";

async function queryProm(query) {
  try {
    const r    = await fetch(`${PROM}/api/v1/query?query=${encodeURIComponent(query)}`);
    const json = await r.json();
    return json?.data?.result ?? [];
  } catch { return []; }
}

async function getLiveMetrics() {
  const [cpuR, memR, netRecvR, netSentR] = await Promise.all([
    queryProm('100 - (avg by (instance) (rate(windows_cpu_time_total{mode="idle"}[1m])) * 100)'),
    queryProm('100 - ((windows_os_physical_memory_free_bytes / windows_cs_physical_memory_bytes) * 100)'),
    queryProm('rate(windows_net_bytes_received_total[1m])'),
    queryProm('rate(windows_net_bytes_sent_total[1m])'),
  ]);
  return {
    cpu:    parseFloat(parseFloat(cpuR[0]?.value?.[1]    ?? 0).toFixed(1)),
    memory: parseFloat(parseFloat(memR[0]?.value?.[1]    ?? 0).toFixed(1)),
    net_recv: parseFloat(parseFloat(netRecvR[0]?.value?.[1] ?? 0).toFixed(0)),
    net_sent: parseFloat(parseFloat(netSentR[0]?.value?.[1] ?? 0).toFixed(0)),
    timestamp: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// AGENT TOOLS
// ══════════════════════════════════════════════════════════════════════════

// Tool 1 — query_prometheus
async function tool_query_prometheus() {
  const m = await getLiveMetrics();
  const anomalies = [];
  if (m.cpu    > 80) anomalies.push(`HIGH CPU: ${m.cpu}%`);
  if (m.memory > 85) anomalies.push(`HIGH MEMORY: ${m.memory}%`);
  return { metrics: m, anomalies, healthy: anomalies.length === 0 };
}

// Tool 2 — search_logs
function tool_search_logs(incidentId) {
  const inc = incidents.find(i => i.id === incidentId);
  if (!inc) return { error: "Incident not found" };
  const logs     = inc.logs ?? [];
  const critical = logs.filter(l => /CRITICAL|FATAL/.test(l));
  const errors   = logs.filter(l => /ERROR/.test(l));
  const warnings = logs.filter(l => /WARN/.test(l));
  return { total: logs.length, critical, errors, warnings, all: logs };
}

// Tool 3 — check_memory
function tool_check_memory(rootCauseKeyword) {
  const mem      = loadMemory();
  const keyword  = rootCauseKeyword.toLowerCase();
  const matches  = mem.incidents.filter(i =>
    i.root_cause?.toLowerCase().includes(keyword) ||
    i.incidentId?.toLowerCase().includes(keyword)
  );
  const pattern  = mem.patterns[keyword] ?? 0;
  return { matches, occurrences: pattern, isRecurring: pattern >= 2 };
}

// Tool 4 — generate_fix
async function tool_generate_fix(rootCause, context) {
  const text = await callGroq(
    "You are an SRE expert. Return ONLY a single shell command to fix the described issue. No explanation. No markdown.",
    `Root cause: ${rootCause}\nContext: ${context}`
  );
  return text.replace(/```\w*\n?/g, "").trim();
}

// ══════════════════════════════════════════════════════════════════════════
// MULTI-STEP AGENT REASONING
// ══════════════════════════════════════════════════════════════════════════
async function runAgentReasoning(incidentId, liveIncident = null) {
  const steps = [];
  const incident = liveIncident ?? incidents.find(i => i.id === incidentId);
  if (!incident) throw new Error("Incident not found");

  // ── STEP 1: OBSERVE ──────────────────────────────────────────────────
  steps.push({ step: 1, name: "OBSERVE", status: "running", detail: "Querying Prometheus for live anomalies…" });
  const promData = await tool_query_prometheus();
  steps[0].result  = promData;
  steps[0].status  = "done";
  steps[0].detail  = promData.healthy
    ? "No live anomalies detected. Analyzing incident telemetry."
    : `Anomalies: ${promData.anomalies.join(", ")}`;

  // ── STEP 2: HUNT ─────────────────────────────────────────────────────
  steps.push({ step: 2, name: "HUNT", status: "running", detail: "Scanning logs for error patterns…" });
  const logData = liveIncident
    ? { total: incident.logs?.length ?? 0, critical: [], errors: [], warnings: [], all: incident.logs ?? [] }
    : tool_search_logs(incidentId);
  steps[1].result = logData;
  steps[1].status = "done";
  steps[1].detail = `Found ${logData.critical?.length ?? 0} CRITICAL, ${logData.errors?.length ?? 0} ERROR, ${logData.warnings?.length ?? 0} WARN entries`;

  // ── STEP 3: DIAGNOSE ─────────────────────────────────────────────────
  steps.push({ step: 3, name: "DIAGNOSE", status: "running", detail: "Cross-referencing with memory for recurring patterns…" });
  const keyword    = incident.id?.split("-").slice(1).join(" ") ?? incident.title ?? "";
  const memData    = tool_check_memory(keyword);
  steps[2].result  = memData;
  steps[2].status  = "done";
  steps[2].detail  = memData.isRecurring
    ? `⚠️ RECURRING PATTERN — seen ${memData.occurrences} times before!`
    : "No prior pattern detected. Fresh incident.";

  // ── STEP 4: CONCLUDE ─────────────────────────────────────────────────
  steps.push({ step: 4, name: "CONCLUDE", status: "running", detail: "Running AI root cause analysis…" });

  const contextPayload = {
    incident:        { title: incident.title, service: incident.service, description: incident.description },
    live_metrics:    promData.metrics,
    anomalies:       promData.anomalies,
    log_summary:     { total: logData.total, critical: logData.critical?.slice(0, 3), errors: logData.errors?.slice(0, 3) },
    deployment:      incident.deployment_history?.slice(-1),
    memory_context:  memData.isRecurring ? `This pattern has occurred ${memData.occurrences} times before.` : "First occurrence.",
  };

  const rawText = await callGroq(
    `You are an elite SRE Agent. You have already observed metrics, scanned logs, and checked memory. Now conclude your analysis. Return ONLY raw JSON: { "root_cause": "", "accuracy": "", "explanation": "", "fix": "" }`,
    `Analyzed context:\n${JSON.stringify(contextPayload, null, 2)}`
  );

  const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  let conclusion;
  try { conclusion = JSON.parse(cleaned); }
  catch { conclusion = { root_cause: "Parse error", accuracy: "N/A", explanation: rawText, fix: "Manual investigation required." }; }

  // Auto-generate fix via tool if empty
  if (!conclusion.fix || conclusion.fix.length < 5) {
    conclusion.fix = await tool_generate_fix(conclusion.root_cause, incident.description ?? "");
  }

  steps[3].result = conclusion;
  steps[3].status = "done";
  steps[3].detail = `Root cause: ${conclusion.root_cause}`;

  // ── SAVE TO MEMORY ────────────────────────────────────────────────────
  const mem = loadMemory();
  mem.incidents.unshift({
    id:          Date.now(),
    incidentId:  incidentId ?? `live-${incident.title}`,
    title:       incident.title,
    service:     incident.service,
    root_cause:  conclusion.root_cause,
    accuracy:    conclusion.accuracy,
    fix:         conclusion.fix,
    timestamp:   new Date().toISOString(),
    isRecurring: memData.isRecurring,
    source:      liveIncident ? "live" : "mock",
  });
  // Update pattern count
  const pk = (incident.title ?? "").toLowerCase().split(" ").slice(0, 3).join("-");
  mem.patterns[pk] = (mem.patterns[pk] ?? 0) + 1;
  mem.incidents = mem.incidents.slice(0, 50); // keep last 50
  saveMemory(mem);

  return { steps, conclusion, memoryContext: memData };
}

// ══════════════════════════════════════════════════════════════════════════
// AUTONOMOUS WATCHER
// ══════════════════════════════════════════════════════════════════════════
let watcherActive = false;
let watcherInterval = null;
let lastAlert = null;

async function watcherTick() {
  const promData = await tool_query_prometheus();
  if (!promData.healthy) {
    // Auto-trigger analysis on the closest matching mock incident
    const incidentId = promData.anomalies.some(a => a.includes("CPU"))
      ? "incident-db-exhaustion"
      : "incident-memory-leak";

    console.log(`[WATCHER] Anomaly detected: ${promData.anomalies.join(", ")} → auto-analyzing ${incidentId}`);

    try {
      const result = await runAgentReasoning(incidentId);
      lastAlert = {
        timestamp:  new Date().toISOString(),
        anomalies:  promData.anomalies,
        incidentId,
        conclusion: result.conclusion,
        autoTriggered: true,
      };
      console.log(`[WATCHER] Auto-analysis done: ${result.conclusion.root_cause}`);
    } catch (e) {
      console.error("[WATCHER] Auto-analysis failed:", e.message);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════

// Mock incidents
app.get("/api/incidents", (_req, res) => {
  const summary = incidents.map(({ id, title, service, severity, started_at, description }) =>
    ({ id, title, service, severity, started_at, description }));
  res.json({ success: true, data: summary });
});

app.get("/api/incident/:id", (req, res) => {
  const inc = incidents.find(i => i.id === req.params.id);
  if (!inc) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data: inc });
});

// Live real-world incidents
app.get("/api/real-incidents", async (_req, res) => {
  try {
    const [cfRes, ghRes] = await Promise.allSettled([
      fetch("https://www.cloudflarestatus.com/api/v2/incidents.json"),
      fetch("https://www.githubstatus.com/api/v2/incidents.json"),
    ]);
    const cfData = cfRes.status === "fulfilled" && cfRes.value.ok ? await cfRes.value.json() : { incidents: [] };
    const ghData = ghRes.status === "fulfilled" && ghRes.value.ok ? await ghRes.value.json() : { incidents: [] };

    const map = (inc, source) => {
      const updates = (inc.incident_updates ?? []).slice(0, 15)
        .map(u => `[${u.created_at}] ${u.status?.toUpperCase()} — ${u.body}`);
      return {
        id: `live-${source}-${inc.id}`, title: inc.name, service: (inc.components ?? []).map(c => c.name).join(", ") || source,
        severity: (inc.impact ?? "critical").toUpperCase(), started_at: inc.created_at,
        description: inc.incident_updates?.[0]?.body ?? "No description.", source, status: inc.status,
        logs: updates.length ? updates : [`[${inc.created_at}] INFO — ${inc.name}`],
        metrics: {
          cpu_usage:      [45,62,78,91,88].map((v,i) => ({ time: `T+${i*5}`, value: v })),
          db_connections: [20,38,55,72,68].map((v,i) => ({ time: `T+${i*5}`, value: v })),
          http_5xx_rate:  [0.5,8.2,34.1,67.4,71.2].map((v,i) => ({ time: `T+${i*5}`, value: v })),
        },
        deployment_history: [{ version: "live", timestamp: inc.created_at, commit: inc.name, author: source, status: "active" }],
      };
    };

    const all = [
      ...(cfData.incidents ?? []).slice(0, 5).map(i => map(i, "cloudflare")),
      ...(ghData.incidents ?? []).slice(0, 5).map(i => map(i, "github")),
    ];
    res.json({ success: true, data: all });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── AGENT ANALYZE (multi-step) ────────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { incidentId, liveIncident } = req.body;
  if (!incidentId && !liveIncident) return res.status(400).json({ success: false, error: "Provide incidentId or liveIncident" });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ success: false, error: "GROQ_API_KEY missing" });

  try {
    console.log(`[POST /api/analyze] Agent reasoning for: ${incidentId ?? liveIncident?.title}`);
    const result = await runAgentReasoning(incidentId, liveIncident ?? null);
    res.json({ success: true, data: result.conclusion, steps: result.steps, memoryContext: result.memoryContext });
  } catch (err) {
    console.error("[POST /api/analyze]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── AGENT WATCHER CONTROLS ────────────────────────────────────────────────
app.post("/api/agent/start", (_req, res) => {
  if (watcherActive) return res.json({ success: true, message: "Watcher already running" });
  watcherActive   = true;
  watcherInterval = setInterval(watcherTick, 30000);
  console.log("[AGENT] Watcher started — polling every 30s");
  res.json({ success: true, message: "Agent watcher started" });
});

app.post("/api/agent/stop", (_req, res) => {
  watcherActive = false;
  clearInterval(watcherInterval);
  console.log("[AGENT] Watcher stopped");
  res.json({ success: true, message: "Agent watcher stopped" });
});

app.get("/api/agent/status", (_req, res) => {
  res.json({ success: true, data: { active: watcherActive, lastAlert, timestamp: new Date().toISOString() } });
});

app.get("/api/agent/alert", (_req, res) => {
  res.json({ success: true, data: lastAlert });
});

// ── MEMORY ────────────────────────────────────────────────────────────────
app.get("/api/memory", (_req, res) => {
  res.json({ success: true, data: loadMemory() });
});

app.delete("/api/memory", (_req, res) => {
  saveMemory({ incidents: [], patterns: {} });
  res.json({ success: true, message: "Memory cleared" });
});

// ── LIVE METRICS ──────────────────────────────────────────────────────────
app.get("/api/live-metrics", async (_req, res) => {
  try {
    const m = await getLiveMetrics();
    res.json({ success: true, data: m });
  } catch (err) {
    res.status(500).json({ success: false, error: "Prometheus unreachable" });
  }
});

// Health
app.get("/health", (_req, res) => res.json({ status: "ok", watcher: watcherActive, model: "llama-3.3-70b-versatile" }));

app.listen(PORT, () => {
  console.log(`\n🤖 SRE-Pulse AI Agent running on http://localhost:${PORT}`);
  console.log(`   Mock incidents : ${incidents.length}`);
  console.log(`   Groq key       : ${process.env.GROQ_API_KEY ? "✅ found" : "❌ MISSING"}`);
  console.log(`   Agent tools    : query_prometheus, search_logs, check_memory, generate_fix`);
  console.log(`   Watcher        : POST /api/agent/start to activate\n`);
});
