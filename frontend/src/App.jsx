import React, { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Globe, Zap, Brain, Terminal, Database, Wifi, Copy, CheckCircle2,
  AlertTriangle, ChevronDown, Activity, Shield, Cpu, Radio, RefreshCw,
  Eye, Search, BookOpen, Lightbulb, Play, Square, Repeat2, CloudLightning,
  Trash2, History, Bot, Sparkles, Menu, X, ArrowRightCircle, Lock, Server,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const IMGS = {
  hero:    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80",
  logs:    "https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=1920&q=80",
  rca:     "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80",
  dbLayer: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1920&q=80",
  net:     "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80",
};

const STEP_CONFIG = [
  { name:"OBSERVE",  icon:Eye,       color:"text-cyan-400",    bg:"bg-cyan-500/10",    border:"border-cyan-500/30",    label:"Querying live metrics…"  },
  { name:"HUNT",     icon:Search,    color:"text-amber-400",   bg:"bg-amber-500/10",   border:"border-amber-500/30",   label:"Scanning log patterns…"  },
  { name:"DIAGNOSE", icon:BookOpen,  color:"text-violet-400",  bg:"bg-violet-500/10",  border:"border-violet-500/30",  label:"Cross-checking memory…"  },
  { name:"CONCLUDE", icon:Lightbulb, color:"text-emerald-400", bg:"bg-emerald-500/10", border:"border-emerald-500/30", label:"Concluding root cause…"  },
];

const NAV_LINKS = [
  { label: "Incidents", id: "section-incidents" },
  { label: "Metrics",   id: "section-metrics"   },
  { label: "Logs",      id: "section-logs"      },
  { label: "Analysis",  id: "section-analysis"  },
  { label: "Registry",  id: "section-registry"  },
];

const fadeUp = (delay = 0) => ({
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
});

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

// ── Tiny helpers ─────────────────────────────────────────────────────────
const CineImg = ({ src, className = "" }) => (
  <img src={src} alt="" className={className} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
);

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("in-view"); obs.disconnect(); } }, { rootMargin: "-80px" });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return ref;
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div className="liquid-glass rounded-xl px-3 py-2 text-xs text-white"><p className="text-white/50 mb-1">{label}</p><p className="font-semibold">{payload[0].value}</p></div>;
};

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg liquid-glass text-white/60 hover:text-white transition-colors">
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

function Ring({ pct }) {
  const r = 40, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ;
  const color = pct >= 85 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg className="-rotate-90 w-28 h-28" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} strokeWidth="5" stroke="rgba(255,255,255,0.08)" fill="none" />
        <circle cx="48" cy="48" r={r} strokeWidth="5" fill="none" stroke={color} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div className="absolute text-center"><p className="text-2xl font-black text-white leading-none">{pct}%</p><p className="text-[9px] text-white/40 uppercase tracking-widest">conf.</p></div>
    </div>
  );
}

function SourceBadge({ source }) {
  const c = { cloudflare:"text-orange-400 bg-orange-500/10 border-orange-500/20", github:"text-blue-400 bg-blue-500/10 border-blue-500/20", live:"text-emerald-400 bg-emerald-500/10 border-emerald-500/20", mock:"text-violet-400 bg-violet-500/10 border-violet-500/20" }[source] ?? "text-white/40 bg-white/5 border-white/10";
  return <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${c}`}>{source}</span>;
}

function StepCard({ step, index }) {
  const cfg = STEP_CONFIG[index]; if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <div className={`liquid-glass rounded-2xl p-4 border transition-all duration-500 ${step?.status === "running" ? `${cfg.border} shadow-lg` : step?.status === "done" ? "border-emerald-500/20" : "border-white/[0.06]"} ${!step ? "opacity-30" : "opacity-100"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${step?.status === "running" ? cfg.bg : step?.status === "done" ? "bg-emerald-500/10" : "bg-white/5"}`}>
          {step?.status === "running" ? <svg className={`w-4 h-4 animate-spin ${cfg.color}`} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
           : step?.status === "done" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
           : <Icon className="w-4 h-4 text-white/20" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${step?.status === "done" ? "text-emerald-400" : step?.status === "running" ? cfg.color : "text-white/20"}`}>Step {index + 1} — {cfg.name}</span>
          </div>
          <p className="text-xs text-white/50">{step?.detail ?? cfg.label}</p>
          {step?.status === "done" && step?.result && (
            <div className="mt-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
              <p className="text-[10px] font-mono text-white/40 truncate">{typeof step.result === "string" ? step.result : JSON.stringify(step.result).slice(0, 120) + "…"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemoryCard({ item }) {
  return (
    <div className="liquid-glass rounded-2xl p-4 border border-white/[0.06] hover:border-white/20 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <SourceBadge source={item.source ?? "mock"} />
          {item.isRecurring && <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5"><Repeat2 className="w-2.5 h-2.5" /> Recurring</span>}
        </div>
        <span className="text-[10px] text-white/20 font-mono shrink-0">{new Date(item.timestamp).toLocaleTimeString()}</span>
      </div>
      <p className="text-xs font-semibold text-white mb-1 truncate">{item.title}</p>
      <p className="text-[10px] text-white/40 leading-relaxed mb-2 line-clamp-2">{item.root_cause}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30 font-mono truncate">{item.service}</span>
        <span className={`text-[10px] font-bold ${parseInt(item.accuracy) >= 85 ? "text-emerald-400" : "text-amber-400"}`}>{item.accuracy} conf.</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
export default function App() {
  // Core
  const [mode, setMode]               = useState("mock");
  const [mockList, setMockList]       = useState([]);
  const [liveList, setLiveList]       = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [selectedId, setSelectedId]   = useState("incident-db-exhaustion");
  const [incident, setIncident]       = useState(null);
  const [liveIncident, setLiveIncident] = useState(null);
  const [dropOpen, setDropOpen]       = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  // Analysis
  const [analyzing, setAnalyzing]     = useState(false);
  const [analysis, setAnalysis]       = useState(null);
  const [steps, setSteps]             = useState([]);
  const [elapsed, setElapsed]         = useState(0);
  const [memoryContext, setMemoryContext] = useState(null);
  const [error, setError]             = useState(null);

  // Agent
  const [agentActive, setAgentActive] = useState(false);
  const [agentAlert, setAgentAlert]   = useState(null);
  const [showAlert, setShowAlert]     = useState(false);
  const [memory, setMemory]           = useState({ incidents: [], patterns: {} });
  const [activeTab, setActiveTab]     = useState("analysis");

  // Metrics
  const [liveMetrics, setLiveMetrics] = useState(null);

  const timerRef   = useRef(null);
  const alertPoll  = useRef(null);
  const analysisRef = useRef(null);

  // Reveal refs
  const metricsRef  = useReveal();
  const logsRef     = useReveal();
  const rcaRef      = useReveal();
  const threatRef   = useReveal();

  // ── Data fetching ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/incidents`).then(r => r.json()).then(d => setMockList(d.data ?? [])).catch(() => setError("Backend offline"));
  }, []);

  useEffect(() => {
    if (mode !== "mock" || !selectedId) return;
    setIncident(null); setAnalysis(null); setSteps([]);
    fetch(`${API}/api/incident/${selectedId}`).then(r => r.json()).then(d => setIncident(d.data)).catch(() => {});
  }, [selectedId, mode]);

  const fetchLiveIncidents = useCallback(() => {
    setLiveLoading(true);
    fetch(`${API}/api/real-incidents`).then(r => r.json())
      .then(d => { setLiveList(d.data ?? []); if (d.data?.length) { setLiveIncident(d.data[0]); setIncident(null); } })
      .catch(() => setError("Failed to fetch live incidents")).finally(() => setLiveLoading(false));
  }, []);

  useEffect(() => { if (mode === "live") fetchLiveIncidents(); }, [mode]);

  useEffect(() => {
    const go = () => fetch(`${API}/api/live-metrics`).then(r => r.json()).then(d => { if (d.success) setLiveMetrics(d.data); }).catch(() => {});
    go(); const t = setInterval(go, 10000); return () => clearInterval(t);
  }, []);

  const fetchMemory = useCallback(() => {
    fetch(`${API}/api/memory`).then(r => r.json()).then(d => { if (d.success) setMemory(d.data); }).catch(() => {});
  }, []);

  useEffect(() => { fetchMemory(); }, []);

  useEffect(() => {
    const poll = () => {
      fetch(`${API}/api/agent/status`).then(r => r.json()).then(d => {
        if (d.success) {
          setAgentActive(d.data.active);
          if (d.data.lastAlert && JSON.stringify(d.data.lastAlert) !== JSON.stringify(agentAlert)) {
            setAgentAlert(d.data.lastAlert); setShowAlert(true); fetchMemory();
          }
        }
      }).catch(() => {});
    };
    poll(); alertPoll.current = setInterval(poll, 15000);
    return () => clearInterval(alertPoll.current);
  }, [agentAlert]);

  useEffect(() => {
    if (analyzing) { setElapsed(0); timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [analyzing]);

  // ── Run analysis + scroll to result ──────────────────────────────────
  const runAnalysis = async () => {
    setAnalyzing(true); setAnalysis(null); setSteps([]); setError(null); setMemoryContext(null); setActiveTab("analysis");
    // Scroll to analysis section
    setTimeout(() => scrollTo("section-analysis"), 300);

    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? 0 : 800));
      setSteps(prev => { const n = [...prev]; n[i] = { step: i+1, name: STEP_CONFIG[i].name, status: "running", detail: STEP_CONFIG[i].label }; return n; });
    }

    try {
      const activeInc = mode === "live" ? liveIncident : null;
      const body = activeInc ? { liveIncident: activeInc } : { incidentId: selectedId };
      const r = await fetch(`${API}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      if (d.steps) setSteps(d.steps.map(s => ({ ...s, status: "done" })));
      setAnalysis(d.data); setMemoryContext(d.memoryContext);
      fetchMemory();
      // Scroll to result after render
      setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    } catch (e) {
      setError(e.message);
      setSteps(prev => prev.map(s => s.status === "running" ? { ...s, status: "done", detail: "Error" } : s));
    } finally { setAnalyzing(false); }
  };

  const toggleAgent = async () => {
    const ep = agentActive ? "/api/agent/stop" : "/api/agent/start";
    await fetch(`${API}${ep}`, { method: "POST" }); setAgentActive(!agentActive);
  };

  const handleSelect = (item) => {
    setDropOpen(false); setAnalysis(null); setSteps([]); setError(null);
    if (mode === "mock") setSelectedId(item.id); else { setLiveIncident(item); setIncident(null); }
  };

  const activeIncident = mode === "live" ? liveIncident : incident;
  const activeList     = mode === "mock" ? mockList : liveList;
  const dbData  = activeIncident?.metrics?.db_connections ?? [];
  const errData = activeIncident?.metrics?.http_5xx_rate  ?? [];
  const cpuData = activeIncident?.metrics?.cpu_usage      ?? [];
  const logs    = activeIncident?.logs ?? [];
  const lastCPU = cpuData[cpuData.length-1]?.value ?? 0;
  const lastDB  = dbData[dbData.length-1]?.value   ?? 0;
  const lastErr = errData[errData.length-1]?.value  ?? 0;
  const accuracy = analysis ? parseInt(analysis.accuracy, 10) : 0;
  const activeLabel = mode === "live" ? (liveIncident?.title ?? "Select Live Incident") : (mockList.find(i => i.id === selectedId)?.title ?? selectedId);

  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden" style={{ fontFamily: "'Inter',sans-serif" }}>

      {/* ── AUTO-ALERT ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAlert && agentAlert && (
          <motion.div initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}
            className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4">
            <div className="liquid-glass rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-4 flex items-center gap-4 max-w-2xl w-full shadow-2xl shadow-red-500/20">
              <Bot className="w-5 h-5 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-0.5">⚡ Agent Auto-Detection</p>
                <p className="text-sm text-white font-semibold truncate">{agentAlert.anomalies?.join(", ")}</p>
                <p className="text-xs text-white/40 truncate">{agentAlert.conclusion?.root_cause}</p>
              </div>
              <button onClick={() => { setShowAlert(false); scrollTo("section-analysis"); }}
                className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg liquid-glass whitespace-nowrap">View →</button>
              <button onClick={() => setShowAlert(false)} className="text-white/30 hover:text-white">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section id="section-hero" className="relative min-h-screen flex flex-col overflow-hidden">
        <div className="absolute inset-0"><CineImg src={IMGS.hero} className="absolute inset-0" /></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/40 to-black pointer-events-none" />

        {/* NAV */}
        <nav className="relative z-20 flex justify-center pt-6 px-6">
          <div className="liquid-glass rounded-full flex items-center gap-1 px-2 py-2 w-full max-w-4xl">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Bot className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold">SRE-Pulse <span className="text-violet-400">Agent</span></span>
            </div>
            {/* Desktop nav links */}
            <div className="hidden md:flex flex-1 items-center justify-center gap-1">
              {NAV_LINKS.map(l => (
                <button key={l.id} onClick={() => scrollTo(l.id)}
                  className="px-4 py-1.5 rounded-full text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200">{l.label}</button>
              ))}
            </div>
            {/* Agent toggle */}
            <button onClick={toggleAgent}
              className={`hidden md:flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300 border
                ${agentActive ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "liquid-glass border-white/10 text-white/60 hover:text-white"}`}>
              {agentActive ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Agent Active</> : <><Play className="w-3.5 h-3.5" />Start Agent</>}
            </button>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(true)} className="md:hidden ml-auto p-2 text-white/60 hover:text-white">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* Mobile sheet */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ ease: [0.22,1,0.36,1], duration: 0.45 }}
                className="fixed right-0 top-0 z-50 h-full w-[min(88vw,320px)] flex flex-col"
                style={{ background: "#0d0d0d", boxShadow: "-12px 0 48px rgba(0,0,0,0.5)" }}>
                <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
                  <div className="flex items-center gap-2"><Bot className="w-4 h-4 text-violet-400" /><span className="text-sm font-semibold">SRE-Pulse Agent</span></div>
                  <button onClick={() => setMobileOpen(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex flex-col p-5 gap-2 flex-1">
                  {NAV_LINKS.map((l, i) => (
                    <motion.button key={l.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + i * 0.07 }}
                      onClick={() => { scrollTo(l.id); setMobileOpen(false); }}
                      className="text-left px-4 py-3 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all">{l.label}</motion.button>
                  ))}
                </div>
                <div className="p-5 border-t border-white/10 flex flex-col gap-3">
                  <button onClick={() => { toggleAgent(); setMobileOpen(false); }}
                    className={`w-full py-3 rounded-full text-sm font-semibold transition-all ${agentActive ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white text-black"}`}>
                    {agentActive ? "Stop Agent" : "Start Agent"}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* HERO CONTENT */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-20 pt-12">
          <motion.div initial="hidden" animate="visible" variants={fadeUp(0)}
            className={`liquid-glass rounded-full px-4 py-1.5 text-xs flex items-center gap-2 mb-8 ${agentActive ? "text-emerald-400 border border-emerald-500/20" : "text-white/60"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${agentActive ? "bg-emerald-400 animate-pulse" : "bg-red-500 animate-pulse"}`} />
            {agentActive ? `🤖 Agent watching — ${activeIncident?.service ?? "all services"}` : "Agent standby — click Start Agent"}
          </motion.div>

          <motion.h1 initial="hidden" animate="visible" variants={fadeUp(0)}
            className="text-5xl sm:text-7xl lg:text-8xl font-normal leading-tight max-w-5xl mb-6"
            style={{ fontFamily: "'Helvetica Now Display Bold','Helvetica Neue',sans-serif", letterSpacing: "-0.01em", lineHeight: 1.05 }}>
            Autonomous SRE<br />
            <em className="italic text-white/70">intelligence that never sleeps.</em>
          </motion.h1>

          <motion.p initial="hidden" animate="visible" variants={fadeUp(0.15)}
            className="text-white/50 text-base max-w-xl mb-10 leading-relaxed">
            An AI agent that watches your infrastructure 24/7, thinks in multi-step chains,
            remembers every incident, and diagnoses root causes before you even notice the outage.
          </motion.p>

          {/* Mode toggle */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp(0.2)}
            className="liquid-glass rounded-full flex items-center p-1 gap-1 mb-6">
            {[{ k:"mock", icon:Database, label:"Simulation Mode" }, { k:"live", icon:Radio, label:"Live Outages" }].map(({ k, icon:Icon, label }) => (
              <button key={k} onClick={() => { setMode(k); setAnalysis(null); setSteps([]); }}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition-all flex items-center gap-2
                  ${mode === k ? "bg-white text-black" : "text-white/50 hover:text-white"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </motion.div>

          {/* Incident selector */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp(0.25)}
            className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl">
            <div className="relative flex-1 w-full" id="section-incidents">
              <button onClick={() => setDropOpen(o => !o)}
                className="liquid-glass rounded-full w-full flex items-center justify-between gap-3 px-5 py-3 text-sm text-white/70 hover:text-white transition-colors">
                <div className="flex items-center gap-2 truncate">
                  {mode === "live" && liveIncident && <SourceBadge source={liveIncident.source} />}
                  <span className="truncate">{activeLabel}</span>
                </div>
                {liveLoading ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-white/40" /> : <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${dropOpen ? "rotate-180" : ""}`} />}
              </button>
              <AnimatePresence>
                {dropOpen && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full mt-2 left-0 right-0 z-50 liquid-glass rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                    {mode === "live" && (
                      <div className="px-4 pt-3 pb-2 border-b border-white/[0.06] flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest text-white/30">Live Outages</span>
                        <button onClick={fetchLiveIncidents} className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"><RefreshCw className="w-3 h-3" />Refresh</button>
                      </div>
                    )}
                    {activeList.length === 0 && <p className="text-center text-white/30 text-xs py-6">{liveLoading ? "Fetching…" : "No incidents"}</p>}
                    {activeList.map(inc => (
                      <button key={inc.id} onClick={() => handleSelect(inc)}
                        className={`w-full text-left px-5 py-3 text-sm hover:bg-white/10 transition-colors border-b border-white/5 last:border-0
                          ${(mode === "mock" ? inc.id === selectedId : inc.id === liveIncident?.id) ? "bg-white/10 text-white" : "text-white/50"}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          {inc.source && <SourceBadge source={inc.source} />}
                          <p className="font-medium text-white truncate">{inc.title}</p>
                        </div>
                        <p className="text-xs text-white/30 truncate">{inc.service}</p>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CTA — Run Analysis */}
            <motion.button onClick={runAnalysis} disabled={analyzing || !activeIncident}
              whileHover={{ scale: 1.04, filter: "brightness(1.1)" }} whileTap={{ scale: 0.96 }}
              className="flex items-center justify-between gap-8 rounded-full px-6 py-4 text-sm font-semibold whitespace-nowrap transition-all disabled:opacity-50 disabled:cursor-wait min-w-[210px]"
              style={{ background: "#7342E2", boxShadow: "0 4px 24px rgba(115,66,226,0.35)" }}>
              {analyzing
                ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>Agent thinking… {elapsed}s</>
                : <><span>Run Agent Analysis</span><ArrowRightCircle className="w-5 h-5" /></>}
            </motion.button>
          </motion.div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm liquid-glass rounded-full px-4 py-2">
              <AlertTriangle className="w-4 h-4" />{error}
            </div>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/30 animate-bounce cursor-pointer" onClick={() => scrollTo("section-metrics")}>
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>

      {/* ── LIVE MONITORING BANNER ───────────────────────────────────── */}
      {liveMetrics && (
        <div className="flex justify-center py-4 px-6 bg-black sticky top-0 z-30">
          <div className="liquid-glass rounded-full flex flex-wrap items-center gap-4 px-6 py-2.5 text-xs w-full max-w-4xl justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/40 uppercase tracking-widest text-[10px]">Live Monitor</span>
            </div>
            {liveMetrics.monitors?.length > 0 ? (
              liveMetrics.monitors.map(m => (
                <div key={m.name} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${m.status==="UP"?"bg-emerald-400":m.status==="DEGRADED"?"bg-amber-400":"bg-red-400"}`} />
                  <span className="text-white/50">{m.name}</span>
                  <span className={`font-bold ${m.status==="UP"?"text-emerald-400":m.status==="DEGRADED"?"text-amber-400":"text-red-400"}`}>{m.status}</span>
                  <span className="text-white/30">{m.response_time}ms</span>
                  <span className="text-white/20">↑{m.uptime}%</span>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-violet-400" /><span className="text-white/60">CPU</span><span className={`font-bold ${liveMetrics.cpu>80?"text-red-400":"text-white"}`}>{liveMetrics.cpu}ms</span></div>
                <div className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-indigo-400" /><span className="text-white/60">Memory</span><span className={`font-bold ${liveMetrics.memory>85?"text-red-400":"text-white"}`}>{liveMetrics.memory}ms</span></div>
                <div className="flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5 text-cyan-400" /><span className="text-white/60">Net ↓</span><span className="font-bold text-white">{(liveMetrics.network_recv_bytes/1024).toFixed?.(1)} KB/s</span></div>
              </>
            )}
            <div className="flex items-center gap-3">
              <button onClick={toggleAgent}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-all
                  ${agentActive?"text-emerald-400 bg-emerald-500/10 border-emerald-500/30 cursor-pointer":"text-white/30 bg-white/5 border-white/10 cursor-pointer"}`}>
                <Bot className="w-3 h-3" />{agentActive ? "Agent ON" : "Agent OFF"}
              </button>
              <span className="text-white/20 text-[10px]">{new Date(liveMetrics.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — METRICS
      ══════════════════════════════════════════════════════ */}
      <section id="section-metrics" ref={metricsRef} className="relative py-32 px-6"
        style={{ opacity:0, transform:"translateY(24px)", transition:"opacity 0.9s ease, transform 0.9s ease" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse 60% 50% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)" }} />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-4">Live Telemetry</p>
            <h2 className="text-5xl font-normal" style={{ fontFamily:"'Helvetica Now Display Bold','Helvetica Neue',sans-serif" }}>
              Infrastructure anomalies, <em className="italic text-white/60">visualised.</em>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { icon:Cpu,           label:"CPU Load",       value:`${lastCPU}%`, danger:lastCPU>80  },
              { icon:Database,      label:"DB Connections", value:lastDB,        danger:lastDB>80   },
              { icon:CloudLightning,label:"5xx Rate",       value:`${lastErr}%`, danger:true        },
            ].map(({ icon:Icon, label, value, danger }) => (
              <div key={label} className="liquid-glass rounded-3xl p-6 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${danger?"bg-red-500/20":"bg-indigo-500/20"}`}>
                  <Icon className={`w-5 h-5 ${danger?"text-red-400":"text-indigo-400"}`} />
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
                  <p className={`text-2xl font-bold ${danger?"text-red-400":"text-white"}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ data:dbData, color:"#6366f1", label:"Active DB Connections" }, { data:errData, color:"#f43f5e", label:"HTTP 5xx Error Rate (%)" }].map(({ data, color, label }) => (
              <div key={label} className="liquid-glass rounded-3xl p-6">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-4">{label}</p>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={data} margin={{ top:4, right:4, left:-28, bottom:0 }}>
                    <defs><linearGradient id={`g${color}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill:"#ffffff30", fontSize:9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:"#ffffff30", fontSize:9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g${color})`} dot={false} activeDot={{ r:4, fill:color, strokeWidth:0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
          <div className="liquid-glass rounded-3xl p-6 mt-4 flex items-center gap-6">
            <Cpu className="w-5 h-5 text-violet-400 shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between mb-2"><span className="text-xs text-white/40 uppercase tracking-wider">CPU Utilization</span><span className="text-sm font-bold">{lastCPU}%</span></div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width:`${lastCPU}%`, background:lastCPU>80?"linear-gradient(90deg,#f43f5e,#fb923c)":"linear-gradient(90deg,#6366f1,#8b5cf6)", boxShadow:`0 0 12px ${lastCPU>80?"#f43f5e60":"#6366f160"}` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — LOGS
      ══════════════════════════════════════════════════════ */}
      <section id="section-logs" ref={logsRef} className="relative py-32 overflow-hidden"
        style={{ opacity:0, transform:"translateY(24px)", transition:"opacity 0.9s ease, transform 0.9s ease" }}>
        <div className="absolute inset-0"><CineImg src={IMGS.logs} className="absolute inset-0" /><div className="absolute inset-0 bg-black/80" /></div>
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-4">System Intelligence</p>
            <h2 className="text-5xl font-normal" style={{ fontFamily:"'Helvetica Now Display Bold','Helvetica Neue',sans-serif" }}>
              Raw signals, <em className="italic text-white/60">decoded by the agent.</em>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <div className="liquid-glass rounded-3xl overflow-hidden flex flex-col" style={{ height:"480px" }}>
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                <div className="w-3 h-3 rounded-full bg-red-500/70" /><div className="w-3 h-3 rounded-full bg-amber-500/70" /><div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <span className="ml-3 text-xs text-white/30 font-mono">{activeIncident?.service ?? "—"}</span>
                <div className="ml-auto flex items-center gap-2">
                  {mode==="live" && liveIncident && <SourceBadge source={liveIncident.source} />}
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] leading-relaxed space-y-1.5">
                {logs.length===0 && <p className="text-white/20 text-center mt-10">Select an incident…</p>}
                {logs.map((line,i) => {
                  const isErr=/ERROR|CRITICAL|FATAL/.test(line), isWarn=/WARN/.test(line);
                  return <div key={i} className={`flex gap-2.5 rounded-lg px-2 py-1 hover:bg-white/[0.04] transition-colors ${isErr?"text-red-400 bg-red-500/5":isWarn?"text-amber-400":"text-white/40"}`}><span className="text-white/20 shrink-0 w-5 text-right select-none">{String(i+1).padStart(2,"0")}</span><span className="break-all">{line}</span></div>;
                })}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="liquid-glass rounded-3xl p-5">
                <p className="text-xs uppercase tracking-widest text-white/30 mb-4">Incidents</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {activeList.map(inc => (
                    <button key={inc.id} onClick={() => handleSelect(inc)}
                      className={`w-full text-left rounded-2xl px-4 py-3 transition-all border ${(mode==="mock"?inc.id===selectedId:inc.id===liveIncident?.id)?"bg-white/10 border-white/20":"border-transparent hover:bg-white/5"}`}>
                      {inc.source && <SourceBadge source={inc.source} />}
                      <p className="text-xs font-semibold text-white truncate mt-1">{inc.title}</p>
                      <p className="text-[10px] text-white/40 mt-0.5 truncate">{inc.service}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="liquid-glass rounded-3xl p-5">
                <p className="text-xs uppercase tracking-widest text-white/30 mb-3">Log Summary</p>
                {[
                  { label:"Total",    value:logs.length,                                 color:"text-white"       },
                  { label:"CRITICAL", value:logs.filter(l=>/CRITICAL/.test(l)).length,   color:"text-red-400"     },
                  { label:"ERROR",    value:logs.filter(l=>/ERROR/.test(l)).length,      color:"text-red-400"     },
                  { label:"WARN",     value:logs.filter(l=>/WARN/.test(l)).length,       color:"text-amber-400"   },
                  { label:"INFO",     value:logs.filter(l=>/INFO/.test(l)).length,       color:"text-emerald-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center py-1">
                    <span className="text-xs text-white/40">{label}</span>
                    <span className={`text-xs font-bold font-mono ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — AI AGENT ANALYSIS
      ══════════════════════════════════════════════════════ */}
      <section id="section-analysis" ref={rcaRef} className="relative py-32 px-6"
        style={{ opacity:0, transform:"translateY(24px)", transition:"opacity 0.9s ease, transform 0.9s ease" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse 50% 60% at 80% 50%, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-4">Autonomous AI Agent</p>
            <h2 className="text-5xl font-normal" style={{ fontFamily:"'Helvetica Now Display Bold','Helvetica Neue',sans-serif" }}>
              Multi-step reasoning <em className="italic text-white/60">in action.</em>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
            {/* LEFT — controls */}
            <div className="flex flex-col gap-4">
              <div className="liquid-glass rounded-3xl overflow-hidden relative" style={{ height:"220px" }}>
                <CineImg src={IMGS.rca} className="absolute inset-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Processing Core</p>
                  <p className="text-2xl font-normal" style={{ fontFamily:"'Helvetica Now Display Bold','Helvetica Neue',sans-serif" }}>Telemetry Analysis</p>
                </div>
              </div>

              <div className="liquid-glass rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Bot className="w-4 h-4 text-violet-400" /><p className="text-xs uppercase tracking-widest text-white/40">Agent Control</p></div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${agentActive?"text-emerald-400 bg-emerald-500/10 border-emerald-500/30":"text-white/30 bg-white/5 border-white/10"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${agentActive?"bg-emerald-400 animate-pulse":"bg-white/30"}`} />
                    {agentActive?"WATCHING":"STANDBY"}
                  </div>
                </div>
                <div className="space-y-3">
                  <motion.button onClick={toggleAgent} whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                    className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 border
                      ${agentActive?"bg-red-500/10 border-red-500/30 text-red-400":"bg-white text-black border-transparent"}`}>
                    {agentActive ? <><Square className="w-4 h-4"/>Stop Watcher</> : <><Play className="w-4 h-4"/>Start Autonomous Watcher</>}
                  </motion.button>
                  <motion.button onClick={runAnalysis} disabled={analyzing||!activeIncident} whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                    className="w-full rounded-2xl py-3 text-sm font-semibold transition-all liquid-glass border border-white/10 hover:border-violet-500/40 flex items-center justify-center gap-2 disabled:opacity-40">
                    <Sparkles className="w-4 h-4 text-violet-400" />{analyzing?`Analyzing… ${elapsed}s`:"Run Manual Analysis"}
                  </motion.button>
                </div>
                {agentActive && (
                  <div className="mt-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-3">
                    <p className="text-[10px] text-emerald-400 font-medium mb-1">🤖 Agent is watching</p>
                    <p className="text-[10px] text-white/40">Polling every 30s. Auto-diagnoses anomalies and alerts you instantly.</p>
                  </div>
                )}
                {agentAlert && (
                  <div className="mt-3 rounded-2xl bg-red-500/5 border border-red-500/20 p-3">
                    <p className="text-[10px] text-red-400 font-medium mb-1">⚡ Last auto-detection</p>
                    <p className="text-[10px] text-white/60 font-semibold truncate">{agentAlert.conclusion?.root_cause}</p>
                    <p className="text-[10px] text-white/20 mt-0.5">{agentAlert.timestamp?new Date(agentAlert.timestamp).toLocaleTimeString():""}</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — chain of thought + results */}
            <div className="flex flex-col gap-4">
              {/* Tabs */}
              <div className="liquid-glass rounded-full flex items-center p-1 gap-1">
                {[{ key:"analysis", icon:Brain, label:"Chain of Thought" }, { key:"memory", icon:History, label:`Memory (${memory.incidents.length})` }].map(({ key, icon:Icon, label }) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5
                      ${activeTab===key?"bg-white text-black":"text-white/50 hover:text-white"}`}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              {activeTab === "analysis" && (
                <div className="flex flex-col gap-4">
                  {/* Steps */}
                  <div className="liquid-glass rounded-3xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <p className="text-xs uppercase tracking-widest text-white/40">Agent Reasoning Chain</p>
                      {analyzing && <span className="ml-auto text-[10px] text-violet-400 font-mono animate-pulse">{elapsed}s</span>}
                    </div>
                    {steps.length===0 && !analyzing && (
                      <div className="flex flex-col items-center py-8 gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center"><Brain className="w-6 h-6 text-violet-400 opacity-50" /></div>
                        <p className="text-xs text-white/30 text-center">Click <strong className="text-white/60">Run Agent Analysis</strong> to watch the AI think step by step</p>
                      </div>
                    )}
                    <div className="space-y-3">
                      {STEP_CONFIG.map((_, i) => <StepCard key={i} step={steps[i]} index={i} />)}
                    </div>
                    {(analyzing||steps.length>0) && (
                      <div className="mt-4">
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width:`${(steps.filter(s=>s?.status==="done").length/4)*100}%`, background:"linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)", boxShadow:"0 0 10px rgba(99,102,241,0.5)" }} />
                        </div>
                        <p className="text-[10px] text-white/30 mt-1 text-right">{steps.filter(s=>s?.status==="done").length}/4 steps complete</p>
                      </div>
                    )}
                  </div>

                  {/* Results */}
                  <div ref={analysisRef}>
                    {analysis && (
                      <AnimatePresence>
                        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }} className="flex flex-col gap-4">
                          {memoryContext?.isRecurring && (
                            <div className="liquid-glass rounded-2xl p-4 border border-red-500/30 bg-red-500/5 flex items-center gap-3">
                              <Repeat2 className="w-5 h-5 text-red-400 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-red-400">Recurring Pattern Detected</p>
                                <p className="text-[10px] text-white/40 mt-0.5">Seen {memoryContext.occurrences} times before</p>
                              </div>
                            </div>
                          )}
                          <div className="liquid-glass rounded-3xl p-6 flex items-start gap-5 border border-violet-500/20">
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2">Root Cause Identified</p>
                              <p className="text-base font-bold text-white leading-snug mb-3">{analysis.root_cause}</p>
                              <div className="liquid-glass rounded-2xl p-4"><p className="text-xs text-white/50 leading-relaxed">{analysis.explanation}</p></div>
                              <div className="flex items-center gap-1.5 mt-3"><Shield className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400">Confidence: {analysis.accuracy}</span></div>
                            </div>
                          </div>
                          <div className="liquid-glass rounded-3xl p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2"><Terminal className="w-4 h-4 text-emerald-400" /><p className="text-[10px] uppercase tracking-widest text-white/40">Remediation Command</p></div>
                              <CopyBtn text={analysis.fix} />
                            </div>
                            <div className="rounded-2xl bg-black/60 border border-emerald-500/10 p-4 overflow-x-auto">
                              <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap break-all leading-relaxed">{analysis.fix}</pre>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "memory" && (
                <div className="liquid-glass rounded-3xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2"><History className="w-4 h-4 text-indigo-400" /><p className="text-xs uppercase tracking-widest text-white/40">Incident Memory</p></div>
                    <div className="flex items-center gap-2">
                      <button onClick={fetchMemory} className="text-[10px] text-white/40 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
                      <button onClick={async()=>{ await fetch(`${API}/api/memory`,{method:"DELETE"}); setMemory({incidents:[],patterns:{}}); }} className="text-[10px] text-red-400/60 hover:text-red-400 flex items-center gap-1"><Trash2 className="w-3 h-3"/>Clear</button>
                    </div>
                  </div>
                  {Object.keys(memory.patterns).length>0 && (
                    <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-3 mb-4">
                      <p className="text-[10px] text-amber-400 font-bold mb-2 uppercase tracking-widest">Detected Patterns</p>
                      {Object.entries(memory.patterns).filter(([,v])=>v>0).map(([k,v])=>(
                        <div key={k} className="flex items-center justify-between">
                          <span className="text-[10px] text-white/50 font-mono truncate">{k}</span>
                          <span className={`text-[10px] font-bold ${v>=3?"text-red-400":v>=2?"text-amber-400":"text-white/40"}`}>×{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {memory.incidents.length===0 && (
                      <div className="text-center py-8"><BookOpen className="w-8 h-8 text-white/10 mx-auto mb-2" /><p className="text-xs text-white/20">No incidents in memory yet</p></div>
                    )}
                    {memory.incidents.map(item=><MemoryCard key={item.id} item={item} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 5 — REGISTRY
      ══════════════════════════════════════════════════════ */}
      <section id="section-registry" ref={threatRef} className="relative py-32 px-6"
        style={{ opacity:0, transform:"translateY(24px)", transition:"opacity 0.9s ease, transform 0.9s ease" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-4">System Health Registry</p>
            <h2 className="text-5xl font-normal" style={{ fontFamily:"'Helvetica Now Display Bold','Helvetica Neue',sans-serif" }}>
              Infrastructure layers, <em className="italic text-white/60">monitored relentlessly.</em>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { src:IMGS.dbLayer, icon:Database, accent:"text-indigo-400", tag:"Database Layer Health", title:"Connection Pool", sub:"State Monitor",
                stats:[{label:"Active Connections",value:lastDB,danger:lastDB>80},{label:"Pool Capacity",value:"100",danger:false},{label:"Avg Acquire Time",value:">5000ms",danger:true},{label:"Rejected Requests",value:"HIGH",danger:true}] },
              { src:IMGS.net, icon:Wifi, accent:"text-violet-400", tag:"Network Layer Latency", title:"API Failure", sub:"Rate Tracker",
                stats:[{label:"5xx Error Rate",value:`${lastErr}%`,danger:true},{label:"Avg Response Time",value:">30s",danger:true},{label:"Worker Threads",value:"512/512",danger:true},{label:"Success Rate",value:"3.1%",danger:true}] },
            ].map(({ src, icon:Icon, accent, tag, title, sub, stats }) => (
              <motion.div key={tag} whileHover={{ scale:1.02 }} className="liquid-glass rounded-3xl overflow-hidden relative cursor-pointer" style={{ minHeight:"420px" }}>
                <CineImg src={src} className="absolute inset-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <div className="flex items-center gap-2 mb-3"><Icon className={`w-4 h-4 ${accent}`} /><span className="text-[10px] uppercase tracking-widest text-white/40">{tag}</span></div>
                  <h3 className="text-3xl font-normal mb-4" style={{ fontFamily:"'Helvetica Now Display Bold','Helvetica Neue',sans-serif" }}>
                    {title}<br /><em className="italic text-white/60">{sub}</em>
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {stats.map(({ label, value, danger }) => (
                      <div key={label} className="liquid-glass rounded-2xl px-3 py-2.5">
                        <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
                        <p className={`text-sm font-bold ${danger?"text-red-400":"text-white"}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2"><Bot className="w-4 h-4 text-violet-400" /><span className="text-white/40" style={{ fontFamily:"'Helvetica Now Display Bold','Helvetica Neue',sans-serif" }}>SRE-Pulse AI Agent</span></div>
          <p className="text-xs text-white/20">{new Date().getFullYear()}  · 4-Tool Agent</p>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-emerald-400" />UptimeRobot</span>
            <span className="flex items-center gap-1"><Radio className="w-3.5 h-3.5 text-orange-400" />StatusPage APIs</span>
            <span className={`flex items-center gap-1 cursor-pointer hover:text-white transition-colors ${agentActive?"text-emerald-400":""}`} onClick={toggleAgent}>
              <Bot className="w-3.5 h-3.5" />{agentActive?"Agent Active — click to stop":"Agent Off — click to start"}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
