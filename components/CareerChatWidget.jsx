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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showTeaser, setShowTeaser] = useState(true);
  const bottomRef = useRef(null);

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

  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");

    const tempUserMsg = { role: "user", content, id: "tmp-" + Date.now() };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/career-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, sessionId }),
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
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); send(); }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {!open && showTeaser && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-gray-100 dark:border-zinc-700 px-4 py-3 max-w-[200px]">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Need career guidance?</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Ask Nexora AI anything</p>
          </div>
        )}
        <button onClick={() => setOpen((o) => !o)}
          className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform relative"
          style={{ background: open ? "#3C3489" : "#534AB7" }}>
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 3C6.6 3 3 6.1 3 10c0 1.7.6 3.2 1.7 4.5L4 19l4.7-1.5A8.3 8.3 0 0011 18c4.4 0 8-3.1 8-7s-3.6-7-8-7Z" fill="white" fillOpacity=".9"/>
            </svg>
          )}
          {unread > 0 && !open && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-700 flex flex-col overflow-hidden"
          style={{ height: 480, background: "white", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between"
            style={{ background: "#534AB7" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">N</div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">Career Guide</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-violet-200">Online · Powered by Gemini</span>
                </div>
              </div>
            </div>
            <a href="/career-chat" className="text-[11px] text-violet-200 hover:text-white border border-white/30 rounded-full px-2.5 py-1 transition-colors">
              Full view ↗
            </a>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3" style={{ background: "#FAFAFA" }}>
            {messages.length === 0 && (
              <>
                <p className="text-center text-xs text-gray-400 pt-2">Ask me about careers, skills, or your next move</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {QUICK_CHIPS.map((c) => (
                    <button key={c} onClick={() => send(c)}
                      className="px-2.5 py-1 text-[11px] rounded-full border border-gray-200 text-gray-500 bg-white hover:border-violet-400 hover:text-violet-600 transition-colors">
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const skills = !isUser ? parseSkills(msg.content) : [];
              const careers = !isUser ? parseCareers(msg.content) : [];
              const display = !isUser ? cleanText(msg.content) : msg.content;
              return (
                <div key={msg.id || i} className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
                  <div className={`w-6 h-6 min-w-[24px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isUser ? "bg-emerald-100 text-emerald-700" : "text-white"
                  }`} style={!isUser ? { background: "#534AB7" } : {}}>
                    {isUser ? "ME" : "N"}
                  </div>
                  <div className={`flex flex-col gap-1.5 max-w-[80%] ${isUser ? "items-end" : ""}`}>
                    <div className={`px-3 py-2 text-xs rounded-xl leading-relaxed ${
                      isUser ? "text-white rounded-tr-sm" : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"
                    }`} style={isUser ? { background: "#534AB7" } : {}}>
                      {display.split("\n").map((line, j, arr) => (
                        <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                      ))}
                    </div>
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skills.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: "#EEEDFE", color: "#534AB7" }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {careers.map((c) => (
                      <div key={c.title} className="bg-white border border-gray-100 rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-gray-900">{c.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0"
                  style={{ background: "#534AB7" }}>N</div>
                <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 flex gap-1 items-center">
                  {[0,1,2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 border-t border-gray-100 bg-white flex gap-2">
            <input type="text" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Ask anything..."
              className="flex-1 text-xs rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition-colors" />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 disabled:opacity-40"
              style={{ background: "#534AB7" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="white" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}