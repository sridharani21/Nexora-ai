"use client";

import { useState, useRef, useEffect } from "react";

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

const QUICK_CHIPS = [
  "Best career for CSE?",
  "Top skills for 2025",
  "How to switch to PM?",
  "Salary negotiation tips",
];

export default function CareerChatWidget() {
  const [open, setOpen]             = useState(false);
  const [tab, setTab]               = useState("chat");   // "chat" | "history"
  const [messages, setMessages]     = useState([]);
  const [sessions, setSessions]     = useState([]);
  const [sessionId, setSessionId]   = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [unread, setUnread]         = useState(0);
  const [showTeaser, setShowTeaser] = useState(true);

  // Responsive
  const [isMobile, setIsMobile] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setShowTeaser(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [open, messages]);

  useEffect(() => {
    const t = setTimeout(() => setShowTeaser(false), 6000);
    return () => clearTimeout(t);
  }, []);

  // Load sessions when history tab is opened
  useEffect(() => {
    if (tab === "history" && open) loadSessions();
  }, [tab, open]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res  = await fetch("/api/career-chat-sessions");
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch (e) { console.error(e); }
    finally { setSessionsLoading(false); }
  };

  const loadSession = (session) => {
    setMessages(session.messages || []);
    setSessionId(session.id);
    setTab("chat");
  };

  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");

    const tempUserMsg = { role: "user", content, id: "tmp-" + Date.now() };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res  = await fetch("/api/career-chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: content, sessionId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      const aiMsg = { role: "assistant", content: data.content, id: "ai-" + Date.now() };
      setMessages((prev) => [...prev, aiMsg]);
      if (!open) setUnread((n) => n + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again.", id: "err-" + Date.now() },
      ]);
    } finally { setLoading(false); }
  };

  const handleKey = (e) => { if (e.key === "Enter") { e.preventDefault(); send(); } };

  // Widget size — full screen on mobile
  const widgetW  = isMobile ? "100vw" : 370;
  const widgetH  = isMobile ? "100dvh" : 520;
  const widgetR  = isMobile ? 0 : 24;
  const widgetB  = isMobile ? 0 : 96;
  const widgetBR = isMobile ? 0 : 20;

  return (
    <>
      <style>{`
        @keyframes wcbounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }
        @keyframes wcspin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes wcpulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes wcslide  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .wc-chip:hover  { background: rgba(139,92,246,0.2) !important; border-color: rgba(139,92,246,0.5) !important; color: #c4b5fd !important; }
        .wc-sess:hover  { background: rgba(255,255,255,0.06) !important; }
        .wc-send:hover:not(:disabled) { background: #7c3aed !important; }
        .wc-send:disabled { opacity: 0.35; cursor: not-allowed; }
        .wc-tab { transition: all 0.18s; cursor: pointer; border: none; }
        .wc-panel { animation: wcslide 0.22s ease; }
      `}</style>

      {/* ── Floating button + teaser ─────────────────────────── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, fontFamily: "'DM Sans',system-ui,sans-serif" }}>

        {!open && showTeaser && !isMobile && (
          <div style={{ background: "#161622", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 14, padding: "10px 14px", maxWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Need career guidance?</p>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "#64748b" }}>Ask Nexora AI anything</p>
          </div>
        )}

        <button onClick={() => setOpen((o) => !o)}
          style={{ width: 52, height: 52, borderRadius: "50%", background: open ? "#3C3489" : "#6d28d9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(109,40,217,0.45)", transition: "all 0.2s", position: "relative" }}>
          {open ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <path d="M11 3C6.6 3 3 6.1 3 10c0 1.7.6 3.2 1.7 4.5L4 19l4.7-1.5A8.3 8.3 0 0011 18c4.4 0 8-3.1 8-7s-3.6-7-8-7Z" fill="white" fillOpacity=".9"/>
            </svg>
          )}
          {unread > 0 && !open && (
            <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* ── Widget panel ─────────────────────────────────────── */}
      {open && (
        <div className="wc-panel" style={{ position: "fixed", bottom: widgetB, right: widgetR, zIndex: 9998, width: widgetW, height: widgetH, borderRadius: widgetBR, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", background: "#09090f", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>

          {/* Header */}
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#1a0a2e,#0d0d1f)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(109,40,217,0.4)", border: "1px solid rgba(139,92,246,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#a78bfa", fontFamily: "'Syne',sans-serif" }}>N</div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>Career Guide</p>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "wcpulse 2s infinite" }} />
                  <span style={{ fontSize: 10, color: "#64748b" }}>Online · Gemini AI</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <a href="/career-chat" style={{ fontSize: 11, color: "#7c3aed", textDecoration: "none", padding: "4px 10px", borderRadius: 20, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}>
                Full view ↗
              </a>
              {isMobile && (
                <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4, display: "flex" }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0d0d16" }}>
            {[
              { id: "chat",    label: "💬 Chat" },
              { id: "history", label: "🕐 History" },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className="wc-tab"
                style={{ flex: 1, padding: "9px", fontSize: 12, fontWeight: tab === t.id ? 600 : 400, background: "none", color: tab === t.id ? "#a78bfa" : "#64748b", borderBottom: tab === t.id ? "2px solid #7c3aed" : "2px solid transparent", fontFamily: "'DM Sans',sans-serif" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── CHAT TAB ─────────────────────────────────────── */}
          {tab === "chat" && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12, background: "#09090f" }}>

                {messages.length === 0 && (
                  <>
                    <p style={{ textAlign: "center", fontSize: 12, color: "#475569", marginTop: 8 }}>
                      Ask me about careers, skills, or your next move
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                      {QUICK_CHIPS.map((c) => (
                        <button key={c} onClick={() => send(c)} className="wc-chip"
                          style={{ padding: "5px 11px", fontSize: 11, borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer", transition: "all 0.18s" }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {messages.map((msg, i) => {
                  const isUser  = msg.role === "user";
                  const skills  = !isUser ? parseSkills(msg.content) : [];
                  const careers = !isUser ? parseCareers(msg.content) : [];
                  const display = !isUser ? cleanText(msg.content) : msg.content;
                  return (
                    <div key={msg.id || i} style={{ display: "flex", gap: 8, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
                      <div style={{ width: 24, height: 24, minWidth: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0, background: isUser ? "rgba(139,92,246,0.2)" : "rgba(109,40,217,0.8)", color: isUser ? "#a78bfa" : "#fff", border: isUser ? "1px solid rgba(139,92,246,0.4)" : "none" }}>
                        {isUser ? "ME" : "N"}
                      </div>
                      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 6, alignItems: isUser ? "flex-end" : "flex-start" }}>
                        <div style={{ padding: "8px 12px", fontSize: 12, lineHeight: 1.6, borderRadius: isUser ? "14px 3px 14px 14px" : "3px 14px 14px 14px", background: isUser ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.05)", color: isUser ? "#e2e8f0" : "#cbd5e1", border: isUser ? "1px solid rgba(139,92,246,0.32)" : "1px solid rgba(255,255,255,0.07)", wordBreak: "break-word" }}>
                          {display.split("\n").map((line, j, arr) => (
                            <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                          ))}
                        </div>
                        {skills.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {skills.map((s) => (
                              <span key={s} style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>{s}</span>
                            ))}
                          </div>
                        )}
                        {careers.map((c) => (
                          <div key={c.title} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{c.title}</p>
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{c.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(109,40,217,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>N</div>
                    <div style={{ padding: "8px 14px", borderRadius: "3px 14px 14px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 4, alignItems: "center" }}>
                      {[0,1,2].map((i) => (
                        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#7c3aed", display: "inline-block", animation: "wcbounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0d0d16", display: "flex", gap: 8, alignItems: "center" }}>
                <input type="text" value={input}
                  onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
                  placeholder="Ask anything..."
                  style={{ flex: 1, fontSize: 12, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", outline: "none", fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.2s" }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(139,92,246,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                />
                <button onClick={() => send()} disabled={!input.trim() || loading} className="wc-send"
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", background: "#6d28d9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.18s", boxShadow: "0 0 10px rgba(109,40,217,0.35)" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 8L14 2L8 14L7 9L2 8Z" fill="white"/></svg>
                </button>
              </div>
            </>
          )}

          {/* ── HISTORY TAB ──────────────────────────────────── */}
          {tab === "history" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", background: "#09090f" }}>

              {sessionsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 30 }}>
                  <span style={{ width: 18, height: 18, border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#7c3aed", borderRadius: "50%", display: "inline-block", animation: "wcspin 0.8s linear infinite" }} />
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: "center", paddingTop: 30 }}>
                  <p style={{ fontSize: 13, color: "#475569" }}>No chat history yet.</p>
                  <button onClick={() => setTab("chat")} style={{ marginTop: 10, padding: "7px 16px", borderRadius: 20, fontSize: 12, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa", cursor: "pointer" }}>
                    Start a chat
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ margin: "0 0 10px 2px", fontSize: 11, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}
                  </p>
                  {sessions.map((s) => {
                    const lastMsg  = s.messages?.[s.messages.length - 1];
                    const dateStr  = new Date(s.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const isActive = sessionId === s.id;
                    return (
                      <button key={s.id} onClick={() => loadSession(s)} className="wc-sess"
                        style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", marginBottom: 6, transition: "all 0.15s", background: isActive ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.03)", outline: isActive ? "1px solid rgba(139,92,246,0.25)" : "1px solid rgba(255,255,255,0.06)", fontFamily: "'DM Sans',sans-serif" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: isActive ? "#c4b5fd" : "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {s.resumeText && <span style={{ marginRight: 5, fontSize: 10 }}>📎</span>}
                            {s.title}
                          </p>
                          <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{dateStr}</span>
                        </div>
                        {lastMsg && (
                          <p style={{ margin: 0, fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {lastMsg.role === "user" ? "You: " : "AI: "}
                            {lastMsg.content.slice(0, 50)}{lastMsg.content.length > 50 ? "..." : ""}
                          </p>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: "#334155" }}>{s.messages?.length || 0} messages</span>
                          {isActive && <span style={{ fontSize: 10, color: "#7c3aed" }}>● Active</span>}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}