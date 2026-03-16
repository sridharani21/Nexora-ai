"use client";

// app/(main)/course-recommend/page.jsx

import { useState, useRef, useEffect } from "react";
import { getLatestResumeAnalysis, getPastRecommendations } from "@/actions/courseRecommendActions";

// ─── Constants ────────────────────────────────────────────────────────────────
const DOMAINS = [
  { id: "frontend",      label: "Frontend Dev",    icon: "⬡", desc: "React, Next.js, CSS",          color: "#38bdf8" },
  { id: "backend",       label: "Backend Dev",     icon: "⬡", desc: "Node.js, APIs, Databases",     color: "#a78bfa" },
  { id: "fullstack",     label: "Full Stack",      icon: "⬡", desc: "End-to-end development",       color: "#34d399" },
  { id: "data-science",  label: "Data Science",    icon: "⬡", desc: "Python, ML, Analytics",        color: "#fbbf24" },
  { id: "ai-ml",         label: "AI / ML",         icon: "⬡", desc: "LLMs, PyTorch, MLOps",         color: "#f472b6" },
  { id: "devops",        label: "DevOps",          icon: "⬡", desc: "Docker, K8s, CI/CD",           color: "#fb923c" },
  { id: "mobile",        label: "Mobile Dev",      icon: "⬡", desc: "React Native, Flutter",        color: "#60a5fa" },
  { id: "cybersecurity", label: "Cybersecurity",   icon: "⬡", desc: "Pen Testing, OWASP",           color: "#f87171" },
];

const PLATFORM_COLORS = {
  "Coursera":          "#0056D2",
  "Udemy":             "#A435F0",
  "freeCodeCamp":      "#0A0A23",
  "YouTube":           "#FF0000",
  "Frontend Masters":  "#C02020",
  "Scrimba":           "#1C1C33",
  "edX":               "#02262B",
  "DataCamp":          "#03EF62",
  "The Odin Project":  "#D64000",
  "fast.ai":           "#1F2937",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBar({ current }) {
  const steps = ["Upload Resume", "Pick Domain", "Results"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 44 }}>
      {steps.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "initial" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, transition: "all 0.3s",
              background: i < current ? "#22c55e" : i === current ? "#38bdf8" : "rgba(255,255,255,0.07)",
              border: `2px solid ${i < current ? "#22c55e" : i === current ? "#38bdf8" : "rgba(255,255,255,0.12)"}`,
              color: i <= current ? "#fff" : "rgba(255,255,255,0.3)",
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap",
              color: i === current ? "#38bdf8" : i < current ? "#22c55e" : "rgba(255,255,255,0.28)",
            }}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: "0 10px", marginBottom: 22,
              background: i < current ? "#22c55e" : "rgba(255,255,255,0.08)",
              transition: "background 0.4s",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function Spinner({ size = 16, color = "#fff" }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", display: "inline-block", flexShrink: 0,
      border: `2px solid ${color}33`, borderTopColor: color,
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

function Badge({ label, variant = "neutral" }) {
  const map = {
    strong:  { bg: "rgba(34,197,94,0.14)",  b: "#22c55e55", c: "#86efac" },
    gap:     { bg: "rgba(239,68,68,0.14)",  b: "#ef444455", c: "#fca5a5" },
    partial: { bg: "rgba(251,191,36,0.14)", b: "#fbbf2455", c: "#fde68a" },
    neutral: { bg: "rgba(99,102,241,0.12)", b: "#6366f144", c: "#c7d2fe" },
  };
  const s = map[variant] || map.neutral;
  return (
    <span style={{
      padding: "3px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500,
      background: s.bg, border: `1px solid ${s.b}`, color: s.c,
    }}>{label}</span>
  );
}

function ReadinessRing({ score }) {
  const r = 42, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ position: "relative", width: 108, height: 108, flexShrink: 0 }}>
      <svg width={108} height={108} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={54} cy={54} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
        <circle cx={54} cy={54} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>/100</span>
      </div>
    </div>
  );
}

function CourseCard({ course, index }) {
  const prio = {
    high:   { bg: "rgba(239,68,68,0.12)",  b: "#ef444466", c: "#fca5a5" },
    medium: { bg: "rgba(251,191,36,0.12)", b: "#fbbf2466", c: "#fde68a" },
    low:    { bg: "rgba(99,102,241,0.12)", b: "#6366f166", c: "#a5b4fc" },
  }[course.priority] || { bg: "rgba(99,102,241,0.12)", b: "#6366f166", c: "#a5b4fc" };

  const platColor = PLATFORM_COLORS[course.platform] || "#6366f1";

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12,
      animation: `fadeUp 0.4s ease ${index * 0.07}s both`,
    }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              padding: "2px 8px", borderRadius: 4,
              background: platColor + "22", color: platColor, border: `1px solid ${platColor}44`,
            }}>{course.platform}</span>
            {course.free && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                background: "rgba(34,197,94,0.14)", color: "#86efac", border: "1px solid #22c55e44",
              }}>FREE</span>
            )}
          </div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.35 }}>
            {course.title}
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.38)" }}>
            {course.instructor}
          </p>
        </div>
        <span style={{
          padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
          background: prio.bg, border: `1px solid ${prio.b}`, color: prio.c, whiteSpace: "nowrap",
        }}>{course.priority} priority</span>
      </div>

      {/* Why recommended */}
      <p style={{
        margin: 0, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.65,
        fontStyle: "italic", borderLeft: "2px solid rgba(56,189,248,0.35)", paddingLeft: 10,
      }}>{course.whyRecommended}</p>

      {/* Skills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(course.skillsCovered || []).map((s) => <Badge key={s} label={s} />)}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", gap: 18, fontSize: 12, color: "rgba(255,255,255,0.35)",
        paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span>⏱ ~{course.estimatedHours}h</span>
        <span style={{ textTransform: "capitalize" }}>📶 {course.difficulty}</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CourseRecommendPage() {
  // Steps: 0=upload, 1=domain, 2=results
  const [step, setStep] = useState(0);

  // Step 0
  const [inputMode, setInputMode] = useState("paste");
  const [resumeText, setResumeText]   = useState("");
  const [file, setFile]               = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef(null);

  // Step 1
  const [resumeAnalysisId, setResumeAnalysisId]   = useState(null);
  const [resumeStatus, setResumeStatus]           = useState("pending");
  const [extractedSkills, setExtractedSkills]     = useState(null);
  const [selectedDomain, setSelectedDomain]       = useState(null);
  const [generating, setGenerating]               = useState(false);
  const [genError, setGenError]                   = useState("");

  // Step 2
  const [results, setResults] = useState(null);

  // History
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load past recommendations on mount
  useEffect(() => {
    getPastRecommendations()
      .then(setHistory)
      .catch(() => {});
  }, []);

  // ── Poll resume analysis ─────────────────────────────────────────────────
  const pollResume = (id) => {
    const timer = setInterval(async () => {
      try {
        const res  = await fetch(`/api/course-recommend/resume/${id}`);
        const data = await res.json();
        setResumeStatus(data.status);
        if (data.status === "completed") {
          clearInterval(timer);
          setExtractedSkills(data.extractedSkills);
        } else if (data.status === "failed") {
          clearInterval(timer);
          setGenError(data.errorMessage ?? "Resume analysis failed");
        }
      } catch (e) {
        clearInterval(timer);
        setGenError(e.message);
      }
    }, 2500);
  };

  // ── Upload / paste submit ────────────────────────────────────────────────
  const handleUpload = async () => {
    setUploadError("");
    setUploading(true);
    try {
      let res;
      if (inputMode === "file" && file) {
        const fd = new FormData();
        fd.append("resume", file);
        res = await fetch("/api/course-recommend/resume", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/course-recommend/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResumeAnalysisId(data.resumeAnalysisId);
      setStep(1);
      pollResume(data.resumeAnalysisId);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Generate recommendations ─────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedDomain || resumeStatus !== "completed") return;
    setGenError("");
    setGenerating(true);
    try {
      const res  = await fetch("/api/course-recommend/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeAnalysisId, domain: selectedDomain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");

      // Poll recommendation
      const timer = setInterval(async () => {
        try {
          const r = await fetch(`/api/course-recommend/generate/${data.recommendationId}`);
          const d = await r.json();
          if (d.status === "completed") {
            clearInterval(timer);
            setResults(d);
            setGenerating(false);
            setStep(2);
            // Refresh history
            getPastRecommendations().then(setHistory).catch(() => {});
          } else if (d.status === "failed") {
            clearInterval(timer);
            setGenError(d.errorMessage ?? "Generation failed");
            setGenerating(false);
          }
        } catch (e) {
          clearInterval(timer);
          setGenError(e.message);
          setGenerating(false);
        }
      }, 2500);
    } catch (e) {
      setGenError(e.message);
      setGenerating(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = () => {
    setStep(0); setResumeText(""); setFile(null);
    setResumeAnalysisId(null); setResumeStatus("pending");
    setExtractedSkills(null); setSelectedDomain(null);
    setResults(null); setGenError(""); setUploadError("");
    setUploading(false); setGenerating(false);
  };

  const skillGaps = results?.skillGaps ?? {};
  const recs      = results?.recommendations ?? {};
  const courses   = recs.courses ?? [];
  const lp        = recs.learningPath ?? {};
  const allSkills = [
    ...(extractedSkills?.languages ?? []),
    ...(extractedSkills?.frameworks ?? []),
    ...(extractedSkills?.technicalSkills ?? []),
    ...(extractedSkills?.tools ?? []),
  ].slice(0, 28);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }
        .upload-zone:hover { border-color:#38bdf8!important; background:rgba(56,189,248,0.05)!important; }
        .domain-card { transition:all 0.18s ease; cursor:pointer; user-select:none; }
        .domain-card:hover { transform:translateY(-3px); }
        .tab-btn:hover { color:#f1f5f9!important; }
        .hist-row:hover { background:rgba(255,255,255,0.05)!important; }
        .btn-primary:hover:not(:disabled) { filter:brightness(1.12); transform:translateY(-1px); }
        .btn-primary:disabled { opacity:0.42; cursor:not-allowed; }
        .btn-ghost:hover { border-color:rgba(255,255,255,0.28)!important; color:#f1f5f9!important; }
        textarea:focus { outline:none; border-color:#38bdf8!important; }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-thumb { background:#ffffff22; border-radius:4px; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg,#060d1a 0%,#0c1120 55%,#060d1a 100%)",
        fontFamily: "'DM Sans',sans-serif",
        color: "#f1f5f9",
        padding: "48px 24px 80px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* ── Page Header ─────────────────────────────────────────────── */}
          <div style={{ animation: "fadeUp 0.45s ease both", textAlign: "center", marginBottom: 52 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 18,
              padding: "5px 14px", borderRadius: 99, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", color: "#38bdf8",
              background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.22)",
            }}>✦ AI-POWERED · GROQ LLAMA3</span>

            <h1 style={{
              margin: "0 0 14px", fontFamily: "'Syne',sans-serif",
              fontSize: "clamp(26px,5vw,42px)", fontWeight: 800, lineHeight: 1.15,
              background: "linear-gradient(130deg,#f1f5f9 25%,#38bdf8 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Course Recommendations</h1>

            <p style={{ margin: 0, fontSize: 16, color: "rgba(255,255,255,0.42)", fontWeight: 300, lineHeight: 1.7 }}>
              Upload your resume · choose your target domain<br />
              Get a personalized skill gap analysis and 12-week learning path
            </p>

            {/* History toggle */}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="tab-btn"
                style={{
                  marginTop: 20, background: "none", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8, padding: "7px 18px", cursor: "pointer",
                  fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.45)",
                  transition: "all 0.2s",
                }}
              >
                {showHistory ? "Hide" : "View"} past recommendations ({history.length})
              </button>
            )}
          </div>

          {/* ── History panel ──────────────────────────────────────────── */}
          {showHistory && history.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "20px 24px", marginBottom: 36,
              animation: "fadeUp 0.3s ease both",
            }}>
              <h3 style={{ margin: "0 0 16px", fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em" }}>
                PAST RECOMMENDATIONS
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {history.map((h) => {
                  const d = DOMAINS.find((x) => x.id === h.domain);
                  const score = h.skillGaps?.readinessScore ?? "–";
                  return (
                    <div
                      key={h.id}
                      className="hist-row"
                      onClick={() => { setResults(h); setStep(2); setShowHistory(false); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: d?.color ?? "#6366f1",
                        }} />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{d?.label ?? h.domain}</span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                          {new Date(h.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
                        Score: {score}/100 →
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step indicator ─────────────────────────────────────────── */}
          <StepBar current={step} />

          {/* ════════════════════════════════════════════════════════════
              STEP 0 — Upload / Paste Resume
          ════════════════════════════════════════════════════════════ */}
          {step === 0 && (
            <div style={{ animation: "fadeUp 0.38s ease both" }}>
              <div style={{
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: "36px 40px",
              }}>
                <h2 style={{ margin: "0 0 6px", fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700 }}>
                  Your Resume
                </h2>
                <p style={{ margin: "0 0 28px", fontSize: 14, color: "rgba(255,255,255,0.38)" }}>
                  Paste resume text or upload a PDF/TXT file
                </p>

                {/* Mode toggle */}
                <div style={{
                  display: "inline-flex", background: "rgba(255,255,255,0.05)",
                  borderRadius: 10, padding: 4, marginBottom: 26,
                }}>
                  {[["paste","✏️  Paste Text"],["file","📎  Upload File"]].map(([m, lbl]) => (
                    <button key={m} onClick={() => setInputMode(m)} style={{
                      padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13,
                      background: inputMode === m ? "rgba(56,189,248,0.2)" : "transparent",
                      color: inputMode === m ? "#38bdf8" : "rgba(255,255,255,0.4)",
                      transition: "all 0.2s",
                    }}>{lbl}</button>
                  ))}
                </div>

                {/* Paste */}
                {inputMode === "paste" && (
                  <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste your resume here — work experience, skills, projects, education..."
                    rows={12}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                      padding: "15px 17px", color: "#f1f5f9",
                      fontFamily: "'DM Sans',sans-serif", fontSize: 14, lineHeight: 1.75,
                      resize: "vertical", transition: "border-color 0.2s",
                    }}
                  />
                )}

                {/* File drop */}
                {inputMode === "file" && (
                  <div
                    className="upload-zone"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${file ? "#22c55e" : "rgba(255,255,255,0.14)"}`,
                      borderRadius: 16, padding: "52px 24px", textAlign: "center",
                      cursor: "pointer", transition: "all 0.2s",
                      background: file ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <input ref={fileRef} type="file" accept=".pdf,.txt"
                      style={{ display: "none" }}
                      onChange={(e) => setFile(e.target.files[0] ?? null)}
                    />
                    <div style={{ fontSize: 38, marginBottom: 12 }}>{file ? "✅" : "📄"}</div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: file ? "#86efac" : "#f1f5f9" }}>
                      {file ? file.name : "Click or drag your PDF / TXT file here"}
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                      {file ? `${(file.size / 1024).toFixed(0)} KB` : "Supports .pdf and .txt · max 5 MB"}
                    </p>
                  </div>
                )}

                {uploadError && (
                  <div style={{
                    marginTop: 16, padding: "12px 16px", borderRadius: 10,
                    background: "rgba(239,68,68,0.1)", border: "1px solid #ef444440",
                    color: "#fca5a5", fontSize: 13,
                  }}>⚠ {uploadError}</div>
                )}

                <button
                  className="btn-primary"
                  onClick={handleUpload}
                  disabled={uploading || (inputMode === "paste" ? resumeText.trim().length < 100 : !file)}
                  style={{
                    marginTop: 28, padding: "13px 30px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg,#0ea5e9,#38bdf8)",
                    color: "#fff", fontFamily: "'Syne',sans-serif",
                    fontWeight: 700, fontSize: 15, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 10, transition: "all 0.2s",
                  }}
                >
                  {uploading && <Spinner />}
                  {uploading ? "Uploading…" : "Analyze My Resume →"}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 1 — Pick Domain (resume analyzing in background)
          ════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div style={{ animation: "fadeUp 0.38s ease both" }}>

              {/* Analysis status banner */}
              <div style={{
                padding: "14px 20px", borderRadius: 12, marginBottom: 32,
                background: resumeStatus === "completed" ? "rgba(34,197,94,0.09)" : "rgba(56,189,248,0.09)",
                border: `1px solid ${resumeStatus === "completed" ? "#22c55e40" : "#38bdf840"}`,
                display: "flex", alignItems: "center", gap: 12, fontSize: 14,
              }}>
                {resumeStatus === "completed" ? (
                  <>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                      <span style={{ fontWeight: 700, color: "#86efac" }}>Resume analyzed!</span>
                      <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 10 }}>
                        {allSkills.length} skills found · {extractedSkills?.experienceLevel} level
                        {extractedSkills?.currentRole ? ` · ${extractedSkills.currentRole}` : ""}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <Spinner color="#38bdf8" />
                    <span style={{ color: "#38bdf8", fontWeight: 500 }}>
                      Analyzing your resume with Groq Llama3…
                    </span>
                  </>
                )}
              </div>

              {/* Extracted skills preview */}
              {extractedSkills && allSkills.length > 0 && (
                <div style={{
                  background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16, padding: "22px 28px", marginBottom: 36,
                }}>
                  <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.38)" }}>
                    DETECTED SKILLS
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {allSkills.map((s) => <Badge key={s} label={s} variant="strong" />)}
                  </div>
                  {extractedSkills.summary && (
                    <p style={{
                      margin: "16px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)",
                      lineHeight: 1.7, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14,
                    }}>{extractedSkills.summary}</p>
                  )}
                </div>
              )}

              {/* Domain cards */}
              <h2 style={{ margin: "0 0 18px", fontFamily: "'Syne',sans-serif", fontSize: 19, fontWeight: 700 }}>
                Choose Your Target Domain
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))",
                gap: 12, marginBottom: 36,
              }}>
                {DOMAINS.map((d) => {
                  const active = selectedDomain === d.id;
                  return (
                    <div
                      key={d.id}
                      className="domain-card"
                      onClick={() => setSelectedDomain(d.id)}
                      style={{
                        padding: "18px 16px", borderRadius: 14,
                        background: active ? `${d.color}16` : "rgba(255,255,255,0.025)",
                        border: `1px solid ${active ? d.color + "88" : "rgba(255,255,255,0.07)"}`,
                        transform: active ? "translateY(-3px)" : undefined,
                        boxShadow: active ? `0 8px 24px ${d.color}22` : "none",
                      }}
                    >
                      <div style={{ fontSize: 22, marginBottom: 9, color: d.color }}>◈</div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: active ? d.color : "#f1f5f9" }}>
                        {d.label}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                        {d.desc}
                      </div>
                    </div>
                  );
                })}
              </div>

              {genError && (
                <div style={{
                  marginBottom: 20, padding: "12px 16px", borderRadius: 10,
                  background: "rgba(239,68,68,0.1)", border: "1px solid #ef444440",
                  color: "#fca5a5", fontSize: 13,
                }}>⚠ {genError}</div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <button
                  className="btn-primary"
                  onClick={handleGenerate}
                  disabled={!selectedDomain || resumeStatus !== "completed" || generating}
                  style={{
                    padding: "13px 34px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
                    color: "#fff", fontFamily: "'Syne',sans-serif",
                    fontWeight: 700, fontSize: 15, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 10, transition: "all 0.2s",
                  }}
                >
                  {generating && <Spinner />}
                  {generating ? "Building your path…" : "Generate Learning Path →"}
                </button>

                <button className="btn-ghost" onClick={reset} style={{
                  padding: "12px 22px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                  color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans',sans-serif",
                  fontSize: 14, cursor: "pointer", transition: "all 0.2s",
                }}>← Start over</button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 2 — Results
          ════════════════════════════════════════════════════════════ */}
          {step === 2 && results && (
            <div style={{ animation: "fadeUp 0.38s ease both" }}>

              {/* ── Skill gap card ─────────────────────────────────────── */}
              <div style={{
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: "32px 36px", marginBottom: 30,
              }}>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <ReadinessRing score={skillGaps.readinessScore ?? 0} />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: 21, fontWeight: 800 }}>
                        Skill Gap Analysis
                      </h2>
                      <span style={{
                        padding: "3px 11px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                        background: "rgba(167,139,250,0.14)", color: "#c4b5fd",
                        border: "1px solid #a78bfa44", textTransform: "capitalize",
                      }}>{skillGaps.overallReadiness}</span>
                      {(() => {
                        const d = DOMAINS.find((x) => x.id === results.domain);
                        return d ? (
                          <span style={{
                            padding: "3px 11px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                            background: d.color + "18", color: d.color, border: `1px solid ${d.color}44`,
                          }}>{d.label}</span>
                        ) : null;
                      })()}
                    </div>

                    <p style={{ margin: "0 0 22px", fontSize: 14, color: "rgba(255,255,255,0.52)", lineHeight: 1.75 }}>
                      {skillGaps.summary}
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {[
                        { label: "Strong Skills",        items: skillGaps.strongSkills,  v: "strong" },
                        { label: "Missing Skills",        items: skillGaps.gapSkills,     v: "gap" },
                        { label: "Needs Improvement",     items: skillGaps.partialSkills, v: "partial" },
                      ].filter((r) => r.items?.length).map(({ label, items, v }) => (
                        <div key={label}>
                          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,255,255,0.32)" }}>
                            {label.toUpperCase()}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                            {items.map((s) => <Badge key={s} label={s} variant={v} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Career tip ─────────────────────────────────────────── */}
              {recs.careerTip && (
                <div style={{
                  padding: "16px 22px", borderRadius: 14, marginBottom: 30,
                  background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#fde68a" }}>CAREER TIP</p>
                    <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.58)", lineHeight: 1.7 }}>{recs.careerTip}</p>
                  </div>
                </div>
              )}

              {/* ── Courses ────────────────────────────────────────────── */}
              <h2 style={{ margin: "0 0 18px", fontFamily: "'Syne',sans-serif", fontSize: 19, fontWeight: 700 }}>
                Recommended Courses
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))",
                gap: 16, marginBottom: 44,
              }}>
                {courses.map((c, i) => <CourseCard key={c.id ?? i} course={c} index={i} />)}
              </div>

              {/* ── 12-week learning path ──────────────────────────────── */}
              {Object.keys(lp).length > 0 && (
                <>
                  <h2 style={{ margin: "0 0 24px", fontFamily: "'Syne',sans-serif", fontSize: 19, fontWeight: 700 }}>
                    Your 12-Week Learning Path
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {Object.entries(lp).map(([key, phase], i) => {
                      const colors = ["#38bdf8","#a78bfa","#22c55e"];
                      const c = colors[i] ?? "#38bdf8";
                      return (
                        <div key={key} style={{ display: "flex", gap: 22, paddingBottom: i < 2 ? 32 : 0 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                              background: c + "18", border: `2px solid ${c}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: c,
                            }}>{i + 1}</div>
                            {i < 2 && <div style={{ flex: 1, width: 2, background: "rgba(255,255,255,0.07)", marginTop: 8 }} />}
                          </div>
                          <div style={{ paddingTop: 8 }}>
                            <h3 style={{ margin: "0 0 5px", fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: c }}>
                              {phase.title}
                            </h3>
                            <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(255,255,255,0.48)", lineHeight: 1.65 }}>
                              {phase.focus}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {(phase.courseIds ?? []).map((cid) => {
                                const course = courses.find((x) => x.id === cid);
                                return course ? (
                                  <span key={cid} style={{
                                    padding: "4px 13px", borderRadius: 8,
                                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                                    fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)",
                                  }}>{course.title}</span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Actions ────────────────────────────────────────────── */}
              <div style={{ display: "flex", gap: 12, marginTop: 52, flexWrap: "wrap" }}>
                <button
                  onClick={() => { setStep(1); setResults(null); setSelectedDomain(null); setGenError(""); }}
                  style={{
                    padding: "12px 26px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
                    color: "#fff", fontFamily: "'Syne',sans-serif",
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}
                >
                  Try Another Domain
                </button>
                <button className="btn-ghost" onClick={reset} style={{
                  padding: "11px 22px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                  color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans',sans-serif",
                  fontSize: 14, cursor: "pointer", transition: "all 0.2s",
                }}>← Upload New Resume</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}