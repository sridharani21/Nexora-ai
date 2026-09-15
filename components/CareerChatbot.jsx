"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  FileText,
  GraduationCap,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  ScanSearch,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const MODE_PREFIXES = {
  resume: "[Resume Review Mode] ",
  skillgap: "[Skill Gap Analysis Mode] ",
  interview: "[Mock Interview Mode] ",
};

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
function stripModePrefix(text) {
  return text.replace(/^\[(Resume Review Mode|Skill Gap Analysis Mode|Mock Interview Mode)\]\s*/, "");
}

function Message({ msg, userInfo }) {
  const isUser = msg.role === "user";
  const raw = isUser ? stripModePrefix(msg.content) : cleanText(msg.content);
  const skills = !isUser ? parseSkills(msg.content) : [];
  const careers = !isUser ? parseCareers(msg.content) : [];

  return (
    <div className={cn("flex gap-2 sm:gap-3 items-start", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "size-7 sm:size-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border",
          isUser
            ? "bg-primary/15 text-primary border-primary/30"
            : "bg-primary text-primary-foreground border-transparent"
        )}
      >
        {isUser ? userInfo?.initials || "ME" : "N"}
      </div>
      <div className={cn("max-w-[min(100%,28rem)] sm:max-w-[80%] flex flex-col gap-2 min-w-0", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "px-3 py-2 sm:px-3.5 sm:py-2.5 text-[13px] sm:text-sm leading-relaxed break-words border",
            isUser
              ? "rounded-2xl rounded-tr-sm bg-primary/15 text-foreground border-primary/25"
              : "rounded-2xl rounded-tl-sm bg-card text-muted-foreground border-border"
          )}
        >
          {raw.split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs font-medium">
                {s}
              </Badge>
            ))}
          </div>
        )}
        {careers.map((c) => (
          <div key={c.title} className="w-full rounded-lg border border-border bg-card/60 px-3 py-2">
            <p className="text-sm font-semibold text-foreground m-0">{c.title}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-0">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const SUGGESTIONS = {
  default: ["What career suits a CSE student?", "How to get into product management?", "Top skills to learn in 2025", "How to negotiate a salary offer?"],
  resume: ["Review my resume structure", "How to write strong bullet points?", "What should my summary say?", "ATS optimisation tips"],
  skillgap: ["Skills needed for ML Engineer", "What skills does a PM need?", "How to learn cloud computing?", "Frontend vs backend skill sets"],
  interview: ["Common system design questions", "How to answer behavioural questions?", "What do interviewers look for?", "Prepare for a Google interview"],
};

const MODES = [
  { id: "default", label: "Guide", full: "Career Guide", icon: Briefcase },
  { id: "resume", label: "Resume", full: "Resume Review", icon: FileText },
  { id: "skillgap", label: "Skills", full: "Skill Gap", icon: ScanSearch },
  { id: "interview", label: "Interview", full: "Mock Interview", icon: GraduationCap },
];

export default function CareerChatbot({ userInfo }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("default");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(null);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(h);
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/career-chat-sessions");
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
    } catch (e) {
      console.error(e);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
  }, [input]);

  const newChat = async () => {
    try {
      const res = await fetch("/api/career-chat-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => [data.session, ...prev]);
        setActiveSession(data.session);
        setMessages([]);
        setUploadSuccess(false);
        setUploadedFileName("");
        setSidebarOpen(false);
        textareaRef.current?.focus();
        return data.session;
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not start a new chat.");
    }
  };

  const switchSession = (session) => {
    setActiveSession(session);
    setMessages(session.messages || []);
    setUploadSuccess(!!session.resumeText);
    setUploadedFileName(session.resumeText ? "Previously uploaded" : "");
    setConfirmDelete(null);
    setEditingId(null);
    setSidebarOpen(false);
  };

  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");

    const modePrefix = MODE_PREFIXES[mode] || "";
    const optimisticMsg = { role: "user", content: modePrefix + content, id: "tmp-" + Date.now() };
    setMessages((prev) => [...prev, optimisticMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/career-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: modePrefix + content, sessionId: activeSession?.id || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiMsg = { role: "assistant", content: data.content, id: "ai-" + Date.now() };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.sessionId && (!activeSession || activeSession.id !== data.sessionId)) {
        const ns = {
          id: data.sessionId,
          title: data.sessionTitle,
          messages: [optimisticMsg, aiMsg],
          resumeText: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSessions((prev) => [ns, ...prev.filter((s) => s.id !== data.sessionId)]);
        setActiveSession(ns);
      } else if (activeSession) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? { ...s, messages: [...(s.messages || []), optimisticMsg, aiMsg], updatedAt: new Date().toISOString() }
              : s
          )
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again.", id: "err-" + Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const startRename = (session, e) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };
  const saveRename = async (sessionId) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/career-chat-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: data.session.title } : s)));
        if (activeSession?.id === sessionId) setActiveSession((s) => ({ ...s, title: data.session.title }));
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not rename chat.");
    } finally {
      setEditingId(null);
    }
  };
  const handleRenameKey = (e, sid) => {
    if (e.key === "Enter") saveRename(sid);
    if (e.key === "Escape") setEditingId(null);
  };

  const deleteSession = async (sessionId) => {
    try {
      await fetch(`/api/career-chat-sessions/${sessionId}`, { method: "DELETE" });
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (activeSession?.id === sessionId) {
        if (remaining.length > 0) switchSession(remaining[0]);
        else {
          setActiveSession(null);
          setMessages([]);
          setUploadSuccess(false);
          setUploadedFileName("");
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not delete chat.");
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleUploadClick = async () => {
    if (!activeSession) {
      const s = await newChat();
      if (s) setTimeout(() => fileInputRef.current?.click(), 100);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".txt") && !name.endsWith(".md")) {
      toast.error("Please upload a PDF or TXT file.");
      return;
    }
    setUploading(true);
    setUploadSuccess(false);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", activeSession.id);
    try {
      const res = await fetch("/api/career-chat-upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadSuccess(true);
        setUploadedFileName(file.name);
        setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? { ...s, resumeText: "uploaded" } : s)));
        setActiveSession((s) => ({ ...s, resumeText: "uploaded" }));
        setMode("resume");
        toast.success("Resume attached");
        await send("I have uploaded my resume. Please give me a detailed review with specific improvements.");
      } else {
        toast.error(data.error || "Upload failed.");
      }
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const chips = SUGGESTIONS[mode] || SUGGESTIONS.default;
  const isEmpty = messages.length === 0;
  const filteredSessions = sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const grouped = filteredSessions.reduce((acc, s) => {
    const d = new Date(s.updatedAt).toDateString();
    const label =
      d === today
        ? "Today"
        : d === yesterday
          ? "Yesterday"
          : new Date(s.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});
  const greeting = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";
  const shellHeight = viewportHeight ? viewportHeight - 64 : undefined;

  return (
    <div
      className="flex bg-background overflow-hidden"
      style={{
        marginTop: 64,
        height: shellHeight ? `${shellHeight}px` : "calc(100dvh - 4rem)",
      }}
    >
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close history"
          className="fixed inset-0 top-16 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:relative z-40 top-16 bottom-0 left-0 w-[min(20rem,88vw)] lg:top-auto lg:bottom-auto lg:w-72 xl:w-80",
          "bg-background border-r border-border flex flex-col",
          "transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 border-b border-border shrink-0 space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">History</h2>
            <Badge variant="secondary" className="text-xs ml-auto">
              {sessions.length}
            </Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close history"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={newChat} className="w-full" size="sm">
            <Plus className="w-4 h-4" />
            New chat
          </Button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats"
              className="pl-8 h-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-4">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground px-2">
              {searchQuery ? "No chats match." : "No chats yet. Start one from the composer."}
            </p>
          ) : (
            Object.entries(grouped).map(([label, group]) => (
              <div key={label} className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground px-1">{label}</p>
                {group.map((s) => (
                  <div key={s.id}>
                    {confirmDelete === s.id ? (
                      <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 space-y-2">
                        <p className="text-xs text-destructive m-0">Delete this chat?</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteSession(s.id)}>
                            Delete
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmDelete(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : editingId === s.id ? (
                      <div className="space-y-1">
                        <Input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => handleRenameKey(e, s.id)}
                          onBlur={() => saveRename(s.id)}
                          className="h-8 text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground px-1">Enter to save · Esc to cancel</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchSession(s)}
                        className={cn(
                          "group w-full text-left p-2.5 rounded-lg border transition-colors",
                          activeSession?.id === s.id
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:border-border hover:bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                          <p className="font-medium text-sm truncate flex-1 min-w-0">
                            {s.resumeText && <Paperclip className="w-3 h-3 text-primary inline mr-1 align-middle" />}
                            {s.title}
                          </p>
                          <span className="flex shrink-0 lg:opacity-0 lg:group-hover:opacity-100">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => startRename(s, e)}
                              className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-background"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(s.id);
                              }}
                              className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="shrink-0 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="flex items-center gap-2 px-3 sm:px-4 h-12 sm:h-14">
            <Button
              variant="outline"
              size="icon-sm"
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open history"
            >
              <History className="w-4 h-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-semibold truncate leading-tight">
                {activeSession?.title && activeSession.title !== "New Chat" ? activeSession.title : "Career Guidance"}
              </p>
              <p className="hidden sm:block text-xs text-muted-foreground truncate">
                Paths, skills, resumes, and interviews in one chat
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 h-8 px-2 sm:px-3" onClick={newChat}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>
          <div className="flex gap-1.5 px-3 sm:px-4 pb-2 overflow-x-auto no-scrollbar">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <Button
                  key={m.id}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setMode(m.id)}
                  className="shrink-0 h-8"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="sm:hidden">{m.label}</span>
                  <span className="hidden sm:inline">{m.full}</span>
                </Button>
              );
            })}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 py-4 sm:py-6">
          <div className={cn("mx-auto w-full max-w-3xl flex flex-col gap-3 sm:gap-4", isEmpty && "min-h-full")}>
            {isEmpty && (
              <div className="flex flex-1 flex-col items-center justify-center text-center px-1 py-6 sm:py-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1">
                  Good {greeting}, {userInfo?.name || "there"}
                </h2>
                <p className="text-sm text-muted-foreground mb-5 max-w-md">
                  Pick a mode above, or start with a suggestion.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {chips.map((c) => (
                    <Button
                      key={c}
                      variant="outline"
                      className="h-auto py-2.5 px-3 whitespace-normal text-left justify-start text-sm font-normal"
                      onClick={() => send(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <Message key={msg.id || i} msg={msg} userInfo={userInfo} />
            ))}

            {loading && (
              <div className="flex gap-2 sm:gap-3 items-start">
                <div className="size-7 sm:size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                  N
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="inline-block size-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!isEmpty && !loading && messages[messages.length - 1]?.role === "assistant" && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pl-9 sm:pl-11">
                {chips.slice(0, 3).map((c) => (
                  <Button key={c} variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => send(c)}>
                    {c}
                  </Button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-3 sm:px-6 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/60 p-2 sm:p-2.5 shadow-sm">
            <div className="flex items-end gap-1.5 sm:gap-2">
              <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleUpload} />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={handleUploadClick}
                disabled={uploading}
                aria-label="Upload resume"
                className={cn("shrink-0 mb-0.5", uploadSuccess && "border-emerald-500/40 text-emerald-500")}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </Button>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={
                  mode === "resume"
                    ? "Ask for resume feedback…"
                    : mode === "skillgap"
                      ? "Your skills and target role…"
                      : mode === "interview"
                        ? "Role you’re interviewing for…"
                        : "Ask about careers, skills, roadmaps…"
                }
                className="flex-1 min-w-0 bg-transparent border-none outline-none resize-none text-base sm:text-sm leading-relaxed max-h-32 overflow-auto placeholder:text-muted-foreground py-1.5"
              />
              <Button
                size="icon-sm"
                className="shrink-0 mb-0.5"
                onClick={() => send()}
                disabled={!input.trim() || loading}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {uploadSuccess && (
              <p className="text-[11px] text-emerald-500 truncate px-1 pt-1.5">
                Resume attached{uploadedFileName ? ` · ${uploadedFileName}` : ""}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
