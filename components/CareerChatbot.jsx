"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

/* ─── text parsers ───────────────────────────────────────────────── */
function parseSkills(text) {
  const match = text.match(/SKILLS:\s*([^\n]+)/i);
  if (!match) return [];
  return match[1].split(",").map((s) => s.trim()).filter(Boolean);
}
function parseCareers(text) {
  const careers = [];
  const regex = /CAREER:\s*\[([^\]]+)\]\s*[—-]\s*([^\n]+)/gi;
  let m;
  while ((m = regex.exec(text)) !== null) careers.push({ title: m[1].trim(), desc: m[2].trim() });
  return careers;
}
function cleanText(text) {
  return text
    .replace(/SKILLS:\s*[^\n]+/gi, "")
    .replace(/CAREER:\s*\[[^\]]+\]\s*[—-]\s*[^\n]+/gi, "")
    .trim();
}

/* ─── sub-components ─────────────────────────────────────────────── */
function SkillPill({ label }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
      {label}
    </span>
  );
}

function CareerCard({ title, desc }) {
  return (
    <div style={{ marginTop: 8, borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0" }}>{desc}</p>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 14px" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", display: "inline-block", animation: "nbounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function Message({ msg, userInfo }) {
  const isUser  = msg.role === "user";
  const skills  = !isUser ? parseSkills(msg.content) : [];
  const careers = !isUser ? parseCareers(msg.content) : [];
  const display = !isUser ? cleanText(msg.content) : msg.content;
  return (
    <div style={{ display: "flex", gap: 10, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, background: isUser ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.8)", color: isUser ? "#a78bfa" : "#fff", border: isUser ? "1px solid rgba(139,92,246,0.4)" : "none" }}>
        {isUser ? (userInfo?.initials || "ME") : "N"}
      </div>
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 8, alignItems: isUser ? "flex-end" : "flex-start" }}>
        <div style={{ padding: "10px 14px", fontSize: 13, lineHeight: 1.65, borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px", background: isUser ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.06)", color: isUser ? "#e2e8f0" : "#cbd5e1", border: isUser ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.08)", wordBreak: "break-word" }}>
          {display.split("\n").map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
        {skills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {skills.map((s) => <SkillPill key={s} label={s} />)}
          </div>
        )}
        {careers.map((c) => <CareerCard key={c.title} title={c.title} desc={c.desc} />)}
      </div>
    </div>
  );
}

function NexoraLogo() {
  return (
    <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 20px" }}>
      <div style={{ position: "absolute", inset: -12, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)", animation: "npulse 3s ease-in-out infinite" }} />
      <img src="/logoss.png" alt="Nexora AI" style={{ width: 80, height: 80, objectFit: "contain", filter: "drop-shadow(0 0 16px rgba(139,92,246,0.6))", animation: "npulse 3s ease-in-out infinite", position: "relative", zIndex: 1 }} />
    </div>
  );
}

/* ─── constants ──────────────────────────────────────────────────── */
const SUGGESTIONS = {
  default:   ["What career suits a CSE student?", "How to get into product management?", "Top skills to learn in 2025", "How to negotiate a salary offer?"],
  resume:    ["Review my resume structure", "How to write strong bullet points?", "What should my summary say?", "ATS optimisation tips"],
  skillgap:  ["Skills needed for ML Engineer", "What skills does a PM need?", "How to learn cloud computing?", "Frontend vs backend skill sets"],
  interview: ["Common system design questions", "How to answer behavioural questions?", "What do interviewers look for?", "Prepare for a Google interview"],
};

const MODES = [
  { id: "default",   label: "Career Guide",      icon: "✦" },
  { id: "resume",    label: "Resume Review",      icon: "◈" },
  { id: "skillgap",  label: "Skill Gap Analysis", icon: "◎" },
  { id: "interview", label: "Mock Interview",      icon: "◇" },
];

const NAV_ITEMS = [
  { icon: HomeIcon,    label: "Home",              href: "/" },
  { icon: HistoryIcon, label: "History",           href: "/career-chat" },
  { icon: RoadmapIcon, label: "Roadmap Generator", href: "/roadmap", highlight: true },
];

function HomeIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M7 18v-6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
}
function HistoryIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function RoadmapIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 5h5M3 10h9M3 15h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="18" cy="15" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
function MenuIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function CloseIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

/* ─── main component ─────────────────────────────────────────────── */
export default function CareerChatbot({ userInfo }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [sessions, setSessions]               = useState([]);
  const [activeSession, setActiveSession]     = useState(null);
  const [messages, setMessages]               = useState([]);
  const [mode, setMode]                       = useState("default");
  const [input, setInput]                     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [editingId, setEditingId]             = useState(null);
  const [editTitle, setEditTitle]             = useState("");
  const [uploading, setUploading]             = useState(false);
  const [uploadSuccess, setUploadSuccess]     = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [confirmDelete, setConfirmDelete]     = useState(null);
  const [searchQuery, setSearchQuery]         = useState("");
  const [sidebarOpen, setSidebarOpen]         = useState(false); // mobile drawer

  const bottomRef    = useRef(null);
  const textareaRef  = useRef(null);
  const fileInputRef = useRef(null);
  const editInputRef = useRef(null);

  /* ── responsive breakpoint ──────────────────────────────────── */
  const [isMobile, setIsMobile]   = useState(false);
  const [isTablet, setIsTablet]   = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 640);
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  /* ── load sessions ──────────────────────────────────────────── */
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res  = await fetch("/api/career-chat-sessions");
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        if (data.sessions.length > 0) {
          const latest = data.sessions[0];
          setActiveSession(latest);
          setMessages(latest.messages || []);
          setUploadSuccess(!!latest.resumeText);
        }
      }
    } catch (e) { console.error(e); }
    finally { setSessionsLoading(false); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  }, [input]);
  useEffect(() => { if (editingId && editInputRef.current) editInputRef.current.focus(); }, [editingId]);

  /* ── new chat ────────────────────────────────────────────────── */
  const newChat = async () => {
    try {
      const res  = await fetch("/api/career-chat-sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => [data.session, ...prev]);
        setActiveSession(data.session);
        setMessages([]);
        setUploadSuccess(false);
        setUploadedFileName("");
        if (isMobile) setSidebarOpen(false);
        return data.session;
      }
    } catch (e) { console.error(e); }
  };

  const switchSession = (session) => {
    setActiveSession(session);
    setMessages(session.messages || []);
    setUploadSuccess(!!session.resumeText);
    setUploadedFileName(session.resumeText ? "Previously uploaded" : "");
    setConfirmDelete(null);
    setEditingId(null);
    if (isMobile) setSidebarOpen(false);
  };

  /* ── send ────────────────────────────────────────────────────── */
  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");

    const modePrefix =
      mode === "resume"    ? "[Resume Review Mode] " :
      mode === "skillgap"  ? "[Skill Gap Analysis Mode] " :
      mode === "interview" ? "[Mock Interview Mode] " : "";

    const optimisticMsg = { role: "user", content: modePrefix + content, id: "tmp-" + Date.now() };
    setMessages((prev) => [...prev, optimisticMsg]);
    setLoading(true);

    try {
      const res  = await fetch("/api/career-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: modePrefix + content, sessionId: activeSession?.id || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiMsg = { role: "assistant", content: data.content, id: "ai-" + Date.now() };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.sessionId && (!activeSession || activeSession.id !== data.sessionId)) {
        const ns = { id: data.sessionId, title: data.sessionTitle, messages: [optimisticMsg, aiMsg], resumeText: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        setSessions((prev) => [ns, ...prev.filter((s) => s.id !== data.sessionId)]);
        setActiveSession(ns);
      } else if (activeSession) {
        setSessions((prev) => prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, messages: [...(s.messages || []), optimisticMsg, aiMsg], updatedAt: new Date().toISOString() }
            : s
        ));
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again.", id: "err-" + Date.now() }]);
    } finally { setLoading(false); }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  /* ── rename ─────────────────────────────────────────────────── */
  const startRename = (session, e) => { e.stopPropagation(); setEditingId(session.id); setEditTitle(session.title); };
  const saveRename  = async (sessionId) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    try {
      const res  = await fetch(`/api/career-chat-sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editTitle }) });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title: data.session.title } : s));
        if (activeSession?.id === sessionId) setActiveSession((s) => ({ ...s, title: data.session.title }));
      }
    } catch (e) { console.error(e); }
    finally { setEditingId(null); }
  };
  const handleRenameKey = (e, sid) => { if (e.key === "Enter") saveRename(sid); if (e.key === "Escape") setEditingId(null); };

  /* ── delete ─────────────────────────────────────────────────── */
  const deleteSession = async (sessionId) => {
    try {
      await fetch(`/api/career-chat-sessions/${sessionId}`, { method: "DELETE" });
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (activeSession?.id === sessionId) {
        if (remaining.length > 0) switchSession(remaining[0]);
        else { setActiveSession(null); setMessages([]); setUploadSuccess(false); setUploadedFileName(""); }
      }
    } catch (e) { console.error(e); }
    finally { setConfirmDelete(null); }
  };

  /* ── upload ─────────────────────────────────────────────────── */
  const handleUploadClick = async () => {
    if (!activeSession) { const s = await newChat(); if (s) setTimeout(() => fileInputRef.current?.click(), 100); return; }
    fileInputRef.current?.click();
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".txt") && !name.endsWith(".md")) { alert("Please upload a PDF or TXT file only."); return; }
    setUploading(true); setUploadSuccess(false);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", activeSession.id);
    try {
      const res  = await fetch("/api/career-chat-upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadSuccess(true); setUploadedFileName(file.name);
        setSessions((prev) => prev.map((s) => s.id === activeSession.id ? { ...s, resumeText: "uploaded" } : s));
        setActiveSession((s) => ({ ...s, resumeText: "uploaded" }));
        setMode("resume");
        await send("I have uploaded my resume. Please give me a detailed review with specific improvements.");
      } else { alert(data.error || "Upload failed."); }
    } catch { alert("Upload failed. Please try again."); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  /* ── derived ─────────────────────────────────────────────────── */
  const chips   = SUGGESTIONS[mode] || SUGGESTIONS.default;
  const isEmpty = messages.length === 0;
  const filteredSessions = sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const grouped   = filteredSessions.reduce((acc, s) => {
    const d = new Date(s.updatedAt).toDateString();
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(s.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});
  const greeting = new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening";

  // Responsive sidebar width
  const sidebarWidth = isTablet ? 220 : 268;
  // Show sidebar: always on desktop, drawer on mobile/tablet
  const showSidebarInline = !isMobile && !isTablet;
  // Message padding
  const msgPadding = isMobile ? "16px 4%" : isTablet ? "20px 6%" : "20px 10%";
  const inputPadding = isMobile ? "10px 4%" : isTablet ? "12px 6%" : "14px 12%";

  /* ─── Sidebar content (shared between inline and drawer) ─────── */
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", boxShadow: "0 0 14px rgba(124,58,237,0.35)" }}>N</div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Syne',sans-serif", letterSpacing: "-0.02em" }}>NEXOR<span style={{ color: "#7c3aed" }}>AI</span></p>
            <p style={{ margin: 0, fontSize: 9, color: "#475569", letterSpacing: "0.06em" }}>CAREER ASSISTANT</p>
          </div>
        </div>
        {/* Close button on mobile/tablet */}
        {(isMobile || isTablet) && (
          <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Nav */}
      <div style={{ padding: "10px 10px 0" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon     = item.icon;
          return (
            <div key={item.label} className={`ncc-nav-item${isActive ? " active" : ""}${item.highlight ? " highlight" : ""}`}
              onClick={() => { router.push(item.href); if (isMobile || isTablet) setSidebarOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, marginBottom: 2, color: isActive ? "#a78bfa" : item.highlight ? "#a78bfa" : "#64748b", fontSize: 13, background: isActive ? "rgba(139,92,246,0.15)" : "transparent", outline: isActive ? "1px solid rgba(139,92,246,0.25)" : "none" }}>
              <span style={{ display: "flex", alignItems: "center", opacity: isActive ? 1 : 0.8 }}><Icon /></span>
              <span>{item.label}</span>
              {item.highlight && <span style={{ marginLeft: "auto", fontSize: 9, padding: "2px 6px", borderRadius: 20, background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>NEW</span>}
            </div>
          );
        })}
      </div>

      <div style={{ margin: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }} />

      {/* Search */}
      <div style={{ padding: "0 10px 10px" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </span>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search chats"
            style={{ width: "100%", padding: "8px 12px 8px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#94a3b8", fontSize: 12, outline: "none", fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.2s" }}
            onFocus={(e) => e.target.style.borderColor = "rgba(139,92,246,0.4)"}
            onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
          />
        </div>
      </div>

      {/* Mode */}
      <div style={{ padding: "0 10px 4px" }}>
        <p style={{ margin: "0 0 6px 4px", fontSize: 10, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>Mode</p>
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => { setMode(m.id); if (isMobile) setSidebarOpen(false); }} className="ncc-mode-btn"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, marginBottom: 2, fontSize: 12, background: active ? "rgba(139,92,246,0.15)" : "transparent", color: active ? "#a78bfa" : "#64748b", outline: active ? "1px solid rgba(139,92,246,0.28)" : "none" }}>
              <span style={{ fontSize: 13, opacity: active ? 1 : 0.7 }}>{m.icon}</span>{m.label}
            </button>
          );
        })}
      </div>

      {/* History */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px 0", minHeight: 0 }}>
        {sessionsLoading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 20 }}>
            <span style={{ width: 16, height: 16, border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#7c3aed", borderRadius: "50%", display: "inline-block", animation: "nspin 0.8s linear infinite" }} />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <p style={{ fontSize: 11, color: "#475569", padding: "4px 4px" }}>{searchQuery ? "No chats match." : "No chats yet. Start one!"}</p>
        ) : (
          Object.entries(grouped).map(([label, group]) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 5px 4px", fontSize: 10, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</p>
              {group.map((s) => (
                <div key={s.id} style={{ position: "relative", marginBottom: 2 }}>
                  {confirmDelete === s.id ? (
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <p style={{ fontSize: 11, color: "#f87171", margin: "0 0 7px" }}>Delete this chat?</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => deleteSession(s.id)} style={{ padding: "3px 10px", fontSize: 10, background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>Delete</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ padding: "3px 10px", fontSize: 10, background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : editingId === s.id ? (
                    <div style={{ padding: "3px 4px" }}>
                      <input ref={editInputRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={(e) => handleRenameKey(e, s.id)} onBlur={() => saveRename(s.id)}
                        style={{ width: "100%", fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.5)", background: "rgba(139,92,246,0.1)", color: "#e2e8f0", outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
                      <p style={{ fontSize: 10, color: "#475569", margin: "4px 0 0 2px" }}>Enter to save · Esc to cancel</p>
                    </div>
                  ) : (
                    <button onClick={() => switchSession(s)} className="ncc-session"
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, textAlign: "left", transition: "all 0.15s", background: activeSession?.id === s.id ? "rgba(139,92,246,0.12)" : "transparent", color: activeSession?.id === s.id ? "#c4b5fd" : "#64748b", outline: activeSession?.id === s.id ? "1px solid rgba(139,92,246,0.2)" : "none", fontFamily: "'DM Sans',sans-serif" }}>
                      {s.resumeText && <span style={{ fontSize: 10, color: "#7c3aed", flexShrink: 0 }}>📎</span>}
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                      <span className="ncc-session-actions" style={{ display: "flex", gap: 2, opacity: 0, transition: "opacity 0.15s", flexShrink: 0 }}>
                        <span onClick={(e) => startRename(s, e)} title="Rename" style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, cursor: "pointer", color: "#64748b" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <span onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id); }} title="Delete" style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, cursor: "pointer", color: "#64748b" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4.5 3v6M7.5 3v6M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Bottom */}
      <div style={{ padding: "10px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button onClick={newChat} className="ncc-newchat" style={{ width: "100%", padding: "9px", borderRadius: 9, marginBottom: 10, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s", fontFamily: "'DM Sans',sans-serif" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          New conversation
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 4px 2px" }}>
          {userInfo?.imageUrl ? (
            <img src={userInfo.imageUrl} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#a78bfa" }}>{userInfo?.initials || "ME"}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userInfo?.name || "You"}</p>
            <p style={{ margin: 0, fontSize: 10, color: "#475569" }}>Career Explorer</p>
          </div>
        </div>
      </div>
    </>
  );

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes nbounce    { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes nspin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes npulse     { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        @keyframes nfadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes nlivepulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes nslideIn   { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        .ncc * { box-sizing: border-box; }
        .ncc ::-webkit-scrollbar { width: 3px; }
        .ncc ::-webkit-scrollbar-track { background: transparent; }
        .ncc ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.25); border-radius: 4px; }
        .ncc-nav-item { transition: all 0.18s; cursor: pointer; }
        .ncc-nav-item:hover { background: rgba(255,255,255,0.06) !important; color: #c4b5fd !important; }
        .ncc-nav-item.active { background: rgba(139,92,246,0.15) !important; color: #a78bfa !important; outline: 1px solid rgba(139,92,246,0.25); }
        .ncc-nav-item.highlight { color: #a78bfa !important; }
        .ncc-nav-item.highlight:hover { background: rgba(139,92,246,0.2) !important; }
        .ncc-mode-btn { transition: all 0.18s; cursor: pointer; border: none; text-align: left; }
        .ncc-mode-btn:hover { background: rgba(255,255,255,0.06) !important; color: #c4b5fd !important; }
        .ncc-session:hover { background: rgba(255,255,255,0.05) !important; }
        .ncc-session:hover .ncc-session-actions { opacity: 1 !important; }
        .ncc-chip:hover { background: rgba(139,92,246,0.18) !important; border-color: rgba(139,92,246,0.45) !important; color: #c4b5fd !important; }
        .ncc-send:hover:not(:disabled) { background: #7c3aed !important; transform: scale(1.08); box-shadow: 0 0 20px rgba(124,58,237,0.5) !important; }
        .ncc-send:disabled { opacity: 0.35; cursor: not-allowed; }
        .ncc-upload:hover { border-color: rgba(139,92,246,0.55) !important; background: rgba(139,92,246,0.08) !important; }
        .ncc-msg { animation: nfadeUp 0.28s ease forwards; }
        .ncc-newchat:hover { background: rgba(139,92,246,0.22) !important; }
        .ncc-input-wrap:focus-within { border-color: rgba(139,92,246,0.45) !important; }
        .ncc-drawer { animation: nslideIn 0.25s ease; }
        .ncc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 40; backdrop-filter: blur(2px); }
      `}</style>

      <div className="ncc" style={{ display: "flex", height: "100dvh", width: "100vw", maxHeight: "100dvh", background: "#09090f", fontFamily: "'DM Sans', sans-serif", color: "#e2e8f0", overflow: "hidden", position: "relative" }}>

        {/* ── Mobile/Tablet overlay ──────────────────────────── */}
        {(isMobile || isTablet) && sidebarOpen && (
          <div className="ncc-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ══ SIDEBAR — inline on desktop, drawer on mobile/tablet ═ */}
        {showSidebarInline ? (
          <aside style={{ width: sidebarWidth, minWidth: sidebarWidth, display: "flex", flexDirection: "column", background: "#0d0d16", borderRight: "1px solid rgba(255,255,255,0.06)", height: "100dvh", overflow: "hidden" }}>
            <SidebarContent />
          </aside>
        ) : (
          sidebarOpen && (
            <aside className="ncc-drawer" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: sidebarWidth, display: "flex", flexDirection: "column", background: "#0d0d16", borderRight: "1px solid rgba(255,255,255,0.06)", zIndex: 50, height: "100dvh", overflow: "hidden" }}>
              <SidebarContent />
            </aside>
          )
        )}

        {/* ══ MAIN PANEL ════════════════════════════════════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", background: "#09090f" }}>

          <div style={{ position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)", width: isMobile ? 300 : 600, height: isMobile ? 300 : 600, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 65%)" }} />

          {/* Topbar */}
          <div style={{ padding: isMobile ? "10px 14px" : "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(13,13,22,0.85)", backdropFilter: "blur(12px)", position: "relative", zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Hamburger on mobile/tablet */}
              {(isMobile || isTablet) && (
                <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", marginRight: 4 }}>
                  <MenuIcon />
                </button>
              )}
              <div style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 6, fontSize: isMobile ? 11 : 12, color: "#94a3b8", maxWidth: isMobile ? 160 : "none", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                <span>{MODES.find((m) => m.id === mode)?.icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeSession?.title || MODES.find((m) => m.id === mode)?.label}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {!isMobile && (
                <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.22)" }}>AI Powered</span>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, background: "rgba(16,185,129,0.08)", color: "#34d399", border: "1px solid rgba(16,185,129,0.18)" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "nlivepulse 2s infinite" }} />
                {!isMobile && "Live"}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: msgPadding, display: "flex", flexDirection: "column", gap: 16, position: "relative", zIndex: 1 }}>
            {isEmpty && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", animation: "nfadeUp 0.5s ease", padding: "20px 0" }}>
                <NexoraLogo />
                <h1 style={{ margin: "0 0 8px", fontSize: isMobile ? 22 : isTablet ? 26 : 30, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Syne',sans-serif", letterSpacing: "-0.03em" }}>
                  Good {greeting}, {userInfo?.name || "there"}.
                </h1>
                <p style={{ margin: "0 0 24px", fontSize: isMobile ? 14 : 17, color: "#64748b", fontWeight: 300 }}>
                  Can I help you navigate your career?
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: isMobile ? "100%" : 560 }}>
                  {chips.map((c) => (
                    <button key={c} onClick={() => send(c)} className="ncc-chip"
                      style={{ padding: isMobile ? "7px 12px" : "8px 16px", borderRadius: 20, fontSize: isMobile ? 11 : 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#94a3b8", cursor: "pointer", transition: "all 0.18s" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={msg.id || i} className="ncc-msg">
                <Message msg={msg} userInfo={userInfo} />
              </div>
            ))}

            {loading && (
              <div className="ncc-msg" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(139,92,246,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>N</div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 18px 18px 18px" }}>
                  <TypingDots />
                </div>
              </div>
            )}

            {!isEmpty && !loading && messages[messages.length - 1]?.role === "assistant" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 38 }}>
                {chips.slice(0, isMobile ? 2 : 3).map((c) => (
                  <button key={c} onClick={() => send(c)} className="ncc-chip"
                    style={{ padding: "6px 12px", borderRadius: 20, fontSize: 11, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b", cursor: "pointer", transition: "all 0.18s" }}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ══ INPUT AREA ════════════════════════════════════ */}
          <div style={{ padding: inputPadding, borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(13,13,22,0.92)", backdropFilter: "blur(12px)", position: "relative", zIndex: 10 }}>
            <div className="ncc-input-wrap" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: isMobile ? "10px 12px" : "12px 14px", transition: "border-color 0.2s" }}>
              <textarea ref={textareaRef} rows={1} value={input}
                onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={
                  mode === "resume"    ? "Paste your resume or ask for review tips..." :
                  mode === "skillgap"  ? "Tell me your current skills and target role..." :
                  mode === "interview" ? "Tell me the role you are interviewing for..." :
                  "Ask about careers, skills, roadmaps..."
                }
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: isMobile ? 13 : 14, resize: "none", lineHeight: 1.55, maxHeight: 100, overflow: "auto", fontFamily: "'DM Sans',sans-serif" }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                  <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" style={{ display: "none" }} onChange={handleUpload} />
                  <button onClick={handleUploadClick} disabled={uploading} className="ncc-upload"
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 500, transition: "all 0.18s", flexShrink: 0, background: uploadSuccess ? "rgba(16,185,129,0.09)" : "rgba(255,255,255,0.04)", border: uploadSuccess ? "1px solid rgba(16,185,129,0.28)" : "1px solid rgba(255,255,255,0.09)", color: uploadSuccess ? "#34d399" : "#64748b" }}>
                    {uploading
                      ? <span style={{ width: 10, height: 10, border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#7c3aed", borderRadius: "50%", display: "inline-block", animation: "nspin 0.8s linear infinite" }} />
                      : uploadSuccess
                      ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      : <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 10v4h12v-4M8 2v9M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    }
                    {uploading ? "Uploading..." : uploadSuccess ? (isMobile ? "✓ Resume" : uploadedFileName || "Resume attached") : isMobile ? "Resume" : "Upload Resume"}
                  </button>
                  {/* On mobile show only active mode pill; on tablet/desktop show all */}
                  {(isMobile ? [{ label: MODES.find(m => m.id === mode)?.label || "Career Guide", id: mode }] : ["Resume Review", "Skill Gap", "Mock Interview"].map(label => ({ label, id: { "Resume Review": "resume", "Skill Gap": "skillgap", "Mock Interview": "interview" }[label] }))).map(({ label, id: modeId }) => {
                    const active = mode === modeId;
                    return (
                      <button key={modeId} onClick={() => !isMobile && setMode(modeId)}
                        style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, cursor: isMobile ? "default" : "pointer", transition: "all 0.18s", background: active ? "rgba(139,92,246,0.14)" : "rgba(255,255,255,0.03)", border: active ? "1px solid rgba(139,92,246,0.32)" : "1px solid rgba(255,255,255,0.07)", color: active ? "#a78bfa" : "#475569", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => send()} disabled={!input.trim() || loading} className="ncc-send"
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", background: "#6d28d9", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s", flexShrink: 0, marginLeft: 8, boxShadow: "0 0 14px rgba(109,40,217,0.35)" }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 8L14 2L8 14L7 9L2 8Z" fill="white"/></svg>
                </button>
              </div>
            </div>
            {!isMobile && <p style={{ textAlign: "center", fontSize: 10, color: "#1e293b", margin: "6px 0 0" }}>Nexora Career AI</p>}
          </div>
        </div>
      </div>
    </>
  );
}