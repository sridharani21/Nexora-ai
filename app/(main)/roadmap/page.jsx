"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const ACCENT  = "#6ee7b7";
const ACCENT2 = "#34d399";
const BG      = "#080c10";
const SURFACE = "#0e1419";
const BORDER  = "#1c2530";
const MUTED   = "#3d5166";
const TEXT    = "#e2eaf2";
const SUBTEXT = "#7a96b0";

const MONTH_COLORS = [
  { ring:"#6ee7b7", glow:"#6ee7b720", label:"#6ee7b7" },
  { ring:"#60a5fa", glow:"#60a5fa20", label:"#60a5fa" },
  { ring:"#f472b6", glow:"#f472b620", label:"#f472b6" },
  { ring:"#fbbf24", glow:"#fbbf2420", label:"#fbbf24" },
  { ring:"#a78bfa", glow:"#a78bfa20", label:"#a78bfa" },
  { ring:"#34d399", glow:"#34d39920", label:"#34d399" },
];

const W = { maxWidth:1100, width:"100%", margin:"0 auto", padding:"0 32px" };

export default function RoadmapPage() {
  const router = useRouter();
  const [career,  setCareer]  = useState("");
  const [months,  setMonths]  = useState(3);
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const roadmapRef = useRef(null);

  const generateRoadmap = async () => {
    if (!career.trim()) return;
    setLoading(true); setRoadmap(null); setError("");
    try {
      const res  = await fetch("/api/roadmap", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ career, months }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setRoadmap(data.roadmap);
    } catch { setError("Something went wrong. Please try again."); }
    finally  { setLoading(false); }
  };

  const saveRoadmap = async () => {
    if (!roadmap) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/roadmap/save", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ career, months, roadmap }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Roadmap saved to dashboard!");
        router.push("/roadmap/dashboard");
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch { toast.error("Save failed. Please try again."); }
    finally  { setSaving(false); }
  };

  const downloadRoadmap = async () => {
    if (!roadmapRef.current) return;
    try {
      const dataUrl = await toPng(roadmapRef.current, {
        backgroundColor:BG, cacheBust:true, pixelRatio:2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${career.replace(/\s+/g,"_")}_roadmap.png`;
      a.click();
    } catch { toast.error("Failed to download image."); }
  };

  return (
    <>
      {/* ── Scoped styles — NO global reset ────────────────────
          All class names prefixed with "rmp-" to avoid any
          collision with Tailwind or other page components.
      ─────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        .rmp-root {
          min-height: 100vh;
          background: ${BG};
          color: ${TEXT};
          font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
          padding-top: 64px;
          padding-bottom: 80px;
        }
        /* Only reset box-sizing inside our root — never globally */
        .rmp-root *, .rmp-root *::before, .rmp-root *::after {
          box-sizing: border-box;
        }

        .rmp-hero {
          border-bottom: 1px solid ${BORDER};
          background: linear-gradient(180deg, #0d1620 0%, ${BG} 100%);
          padding: 40px 0 36px;
          margin-bottom: 40px;
        }

        .rmp-input {
          background: ${SURFACE};
          border: 1.5px solid ${BORDER};
          color: ${TEXT};
          border-radius: 10px;
          padding: 0 16px;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          height: 44px;
          width: 100%;
          min-width: 0;
          transition: border-color .2s, box-shadow .2s;
        }
        .rmp-input:focus {
          border-color: ${ACCENT};
          box-shadow: 0 0 0 3px ${ACCENT}18;
        }
        .rmp-input::placeholder { color: ${MUTED}; }

        .rmp-select {
          background: ${SURFACE};
          border: 1.5px solid ${BORDER};
          color: ${TEXT};
          border-radius: 10px;
          padding: 0 38px 0 14px;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          height: 44px;
          width: 100%;
          min-width: 0;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%237a96b0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 13px center;
          transition: border-color .2s;
        }
        .rmp-select:focus { border-color: ${ACCENT}; }

        .rmp-btn {
          height: 44px;
          border-radius: 10px;
          padding: 0 22px;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background .2s, box-shadow .2s, opacity .15s, transform .1s;
          line-height: 1;
        }
        .rmp-btn:active  { transform: scale(.98); }
        .rmp-btn:disabled { opacity: .45; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

        .rmp-btn-primary { background: ${ACCENT}; color: #020c07; }
        .rmp-btn-primary:hover:not(:disabled) { background: ${ACCENT2}; box-shadow: 0 0 20px ${ACCENT}40; }

        .rmp-btn-outline { background: transparent; color: ${ACCENT}; border: 1.5px solid ${ACCENT}50; }
        .rmp-btn-outline:hover:not(:disabled) { background: ${ACCENT}12; border-color: ${ACCENT}; }

        .rmp-btn-save { background: transparent; color: #a78bfa; border: 1.5px solid #a78bfa50; }
        .rmp-btn-save:hover:not(:disabled) { background: #a78bfa12; border-color: #a78bfa; }

        .rmp-week {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          border-radius: 12px;
          padding: 16px;
          flex: 1 1 175px;
          min-width: 150px;
          max-width: 250px;
          transition: border-color .2s, box-shadow .2s;
        }
        .rmp-week:hover { border-color: ${MUTED}; box-shadow: 0 4px 24px rgba(0,0,0,.4); }

        .rmp-topic {
          background: #0b1117;
          border: 1px solid ${BORDER};
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12.5px;
          color: ${SUBTEXT};
          line-height: 1.4;
          transition: color .15s, border-color .15s;
        }
        .rmp-topic:hover { color: ${TEXT}; border-color: ${MUTED}; }

        @keyframes rmp-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes rmp-fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rmp-fu { animation: rmp-fadeUp .35s ease both; }
      `}</style>

      <div className="rmp-root">

        {/* ── HERO ─────────────────────────────────────────── */}
        <div className="rmp-hero">
          <div style={W}>

            {/* Badge */}
            <div style={{ marginBottom:16 }}>
              <span style={{
                display:"inline-flex", alignItems:"center", gap:7,
                background:`${ACCENT}12`, border:`1px solid ${ACCENT}30`,
                borderRadius:100, padding:"5px 14px",
                fontSize:11, color:ACCENT, fontWeight:600,
                letterSpacing:"0.08em", textTransform:"uppercase",
              }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:ACCENT, flexShrink:0 }}/>
                AI-Powered
              </span>
            </div>

            <h1 style={{
              fontSize:"clamp(24px,3.5vw,40px)", fontWeight:700,
              color:TEXT, letterSpacing:"-0.02em", lineHeight:1.15,
              margin:"0 0 8px",
            }}>
              Career Roadmap Generator
            </h1>

            <p style={{ fontSize:14, color:SUBTEXT, margin:"0 0 28px", maxWidth:440 }}>
              Get a personalized week-by-week learning plan, then save it to your dashboard
            </p>

            {/* Controls */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <div style={{ flex:"1 1 240px", maxWidth:370 }}>
                <input className="rmp-input"
                  placeholder="e.g. Full Stack Developer, Data Scientist…"
                  value={career}
                  onChange={(e) => setCareer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generateRoadmap()}
                />
              </div>

              <div style={{ flex:"0 0 134px" }}>
                <select className="rmp-select" value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}>
                  {[1,2,3,4,5,6].map((m) => (
                    <option key={m} value={m}>{m} Month{m>1?"s":""}</option>
                  ))}
                </select>
              </div>

              <button className="rmp-btn rmp-btn-primary"
                onClick={generateRoadmap}
                disabled={loading || !career.trim()}>
                {loading
                  ? <><RmpSpinner color="#020c07"/> Generating…</>
                  : "Generate →"}
              </button>

              {roadmap && <>
                <button className="rmp-btn rmp-btn-save"
                  onClick={saveRoadmap} disabled={saving}>
                  {saving
                    ? <><RmpSpinner color="#a78bfa"/> Saving…</>
                    : "✓ Save to Dashboard"}
                </button>
                <button className="rmp-btn rmp-btn-outline"
                  onClick={downloadRoadmap}>
                  ↓ Download PNG
                </button>
              </>}
            </div>
          </div>
        </div>

        {/* ── LOADING ──────────────────────────────────────── */}
        {loading && (
          <div style={W}>
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"40px 0" }}>
              <RmpSpinner color={ACCENT} size={22}/>
              <span style={{ color:SUBTEXT, fontSize:14 }}>
                Building your personalized roadmap…
              </span>
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────── */}
        {error && (
          <div style={W}>
            <div style={{ background:"#1a0a0a", border:"1px solid #3d1515", borderRadius:10, padding:"13px 18px", color:"#f87171", fontSize:14 }}>
              {error}
            </div>
          </div>
        )}

        {/* ── ROADMAP ──────────────────────────────────────── */}
        {roadmap && (
          <div ref={roadmapRef} style={W}>
            {roadmap.months.map((month, mi) => {
              const col = MONTH_COLORS[mi % MONTH_COLORS.length];
              return (
                <div key={month.month} className="rmp-fu"
                  style={{ animationDelay:`${mi*0.07}s`, marginBottom:44 }}>

                  {/* Month header */}
                  <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
                    <div style={{
                      width:44, height:44, borderRadius:"50%",
                      border:`2px solid ${col.ring}`, background:col.glow,
                      color:col.label, fontWeight:700, fontSize:15,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, boxShadow:`0 0 14px ${col.ring}28`,
                    }}>
                      {month.month}
                    </div>
                    <div>
                      <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:col.label, margin:"0 0 2px" }}>
                        Month {month.month}
                      </div>
                      <div style={{ fontSize:17, fontWeight:600, color:TEXT, letterSpacing:"-0.01em", margin:0 }}>
                        {month.title || `Phase ${month.month}`}
                      </div>
                    </div>
                    <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${col.ring}35,transparent)` }}/>
                  </div>

                  {/* Week cards */}
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap", paddingLeft:58 }}>
                    {month.weeks.map((week, wi) => (
                      <div key={week.week} className="rmp-week rmp-fu"
                        style={{ animationDelay:`${mi*0.07+wi*0.05}s`, borderTop:`2px solid ${col.ring}` }}>

                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                          <div style={{
                            width:22, height:22, borderRadius:6,
                            background:`${col.ring}18`, border:`1px solid ${col.ring}40`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:10.5, fontWeight:700, color:col.label, flexShrink:0,
                          }}>
                            {week.week}
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color:SUBTEXT, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                            Week {week.week}
                          </span>
                        </div>

                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {week.topics.map((topic, ti) => (
                            <div key={ti} className="rmp-topic">
                              <span style={{ color:col.label, marginRight:6, fontSize:9 }}>&#9658;</span>
                              {topic}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ paddingTop:22, borderTop:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <span style={{ fontSize:12, color:MUTED }}>
                {career} &middot; {months} month{months>1?"s":""} plan
              </span>
              <span style={{ fontSize:12, color:MUTED, fontFamily:"'DM Mono',monospace" }}>
                Generated by AI
              </span>
            </div>
          </div>
        )}

        {/* ── EMPTY STATE ──────────────────────────────────── */}
        {!roadmap && !loading && !error && (
          <div style={W}>
            <div style={{ border:`1.5px dashed ${BORDER}`, borderRadius:14, padding:"52px 32px", textAlign:"center", color:MUTED }}>
              <div style={{ fontSize:32, marginBottom:12 }}>&#128506;</div>
              <p style={{ fontSize:14, margin:0 }}>
                Enter a career above and click Generate
              </p>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

function RmpSpinner({ color = "#6ee7b7", size = 15 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      border:`2px solid ${color}40`,
      borderTopColor:color,
      animation:"rmp-spin .7s linear infinite",
      flexShrink:0,
    }}/>
  );
}