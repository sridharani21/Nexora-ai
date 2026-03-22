// File: app/roadmap/[id]/page.jsx
"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { toast } from "sonner";

const BG      = "#080c10";
const SURFACE = "#0e1419";
const BORDER  = "#1c2530";
const MUTED   = "#3d5166";
const TEXT    = "#e2eaf2";
const SUBTEXT = "#7a96b0";
const ACCENT  = "#6ee7b7";

const MONTH_COLORS = [
  { ring:"#6ee7b7", glow:"#6ee7b720", label:"#6ee7b7" },
  { ring:"#60a5fa", glow:"#60a5fa20", label:"#60a5fa" },
  { ring:"#f472b6", glow:"#f472b620", label:"#f472b6" },
  { ring:"#fbbf24", glow:"#fbbf2420", label:"#fbbf24" },
  { ring:"#a78bfa", glow:"#a78bfa20", label:"#a78bfa" },
  { ring:"#34d399", glow:"#34d39920", label:"#34d399" },
];

const W = { maxWidth:1100, width:"100%", margin:"0 auto", padding:"0 32px" };

export default function RoadmapDetailPage({ params }) {
  const { id }     = use(params);
  const router     = useRouter();
  const roadmapRef = useRef(null);
  const [rec,     setRec]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRoadmap(); }, [id]);

  const fetchRoadmap = async () => {
    try {
      const res  = await fetch(`/api/roadmap/${id}`);
      const data = await res.json();
      if (res.ok) setRec(data.roadmap);
      else { toast.error("Roadmap not found"); router.push("/roadmap/dashboard"); }
    } catch { toast.error("Failed to load"); }
    finally  { setLoading(false); }
  };

  const downloadRoadmap = async () => {
    if (!roadmapRef.current) return;
    try {
      const dataUrl = await toPng(roadmapRef.current, {
        backgroundColor: BG, cacheBust: true, pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${rec.career.replace(/\s+/g,"_")}_roadmap.png`;
      a.click();
    } catch { toast.error("Failed to download."); }
  };

  // ── Loading state ─────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{`@keyframes rdd-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        minHeight:"100vh", background:BG,
        display:"flex", alignItems:"center", justifyContent:"center",
        paddingTop:80,
      }}>
        <div style={{
          width:28, height:28, borderRadius:"50%",
          border:`2px solid ${BORDER}`, borderTopColor:ACCENT,
          animation:"rdd-spin .8s linear infinite",
        }}/>
      </div>
    </>
  );

  if (!rec) return null;

  const roadmap = rec.data;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        .rdd-root {
          min-height: 100vh;
          background: ${BG};
          color: ${TEXT};
          font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
          padding-top: 80px;
          padding-bottom: 80px;
          box-sizing: border-box;
        }
        .rdd-root *, .rdd-root *::before, .rdd-root *::after {
          box-sizing: border-box;
        }
        .rdd-hero {
          border-bottom: 1px solid ${BORDER};
          background: linear-gradient(180deg, #0d1620 0%, ${BG} 100%);
          padding: 36px 0 28px;
          margin-bottom: 40px;
        }
        .rdd-back {
          background: transparent;
          border: 1px solid ${BORDER};
          color: ${SUBTEXT};
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: border-color .2s, color .2s;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .rdd-back:hover { border-color: ${MUTED}; color: ${TEXT}; }
        .rdd-dl {
          background: ${ACCENT};
          color: #020c07;
          border: none;
          border-radius: 10px;
          padding: 9px 20px;
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: background .2s, box-shadow .2s;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .rdd-dl:hover { background: #34d399; box-shadow: 0 0 16px ${ACCENT}40; }
        .rdd-week {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          border-radius: 12px;
          padding: 16px;
          flex: 1 1 175px;
          min-width: 150px;
          max-width: 250px;
          transition: border-color .2s, box-shadow .2s;
        }
        .rdd-week:hover {
          border-color: ${MUTED};
          box-shadow: 0 4px 24px rgba(0,0,0,.4);
        }
        .rdd-topic {
          background: #0b1117;
          border: 1px solid ${BORDER};
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12.5px;
          color: ${SUBTEXT};
          line-height: 1.45;
          transition: color .15s, border-color .15s;
        }
        .rdd-topic:hover { color: ${TEXT}; border-color: ${MUTED}; }
        @keyframes rdd-fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rdd-fu { animation: rdd-fadeUp .3s ease both; }
        @keyframes rdd-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="rdd-root">

        {/* ── Page header ──────────────────────────────── */}
        <div className="rdd-hero">
          <div style={W}>
            {/* Back + Download row */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:20 }}>
              <button className="rdd-back" onClick={() => router.push("/roadmap/dashboard")}>
                ← Back to Dashboard
              </button>
              <button className="rdd-dl" onClick={downloadRoadmap}>
                ↓ Download PNG
              </button>
            </div>

            {/* Title */}
            <h1 style={{ fontSize:"clamp(20px,3vw,32px)", fontWeight:700, color:TEXT, letterSpacing:"-0.02em", margin:"0 0 6px" }}>
              {rec.career}
            </h1>
            <p style={{ fontSize:13, color:SUBTEXT, margin:0 }}>
              {rec.months} month{rec.months > 1 ? "s" : ""} plan
              {" · "}
              Saved {new Date(rec.createdAt).toLocaleDateString("en-US",{ month:"short", day:"numeric", year:"numeric" })}
            </p>
          </div>
        </div>

        {/* ── Roadmap content ───────────────────────────── */}
        <div ref={roadmapRef} style={W}>
          {roadmap.months.map((month, mi) => {
            const col = MONTH_COLORS[mi % MONTH_COLORS.length];
            return (
              <div key={month.month} className="rdd-fu"
                style={{ animationDelay:`${mi*0.07}s`, marginBottom:44 }}>

                {/* Month header row */}
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
                  <div style={{
                    width:44, height:44, borderRadius:"50%",
                    border:`2px solid ${col.ring}`,
                    background:col.glow,
                    color:col.label,
                    fontWeight:700, fontSize:15,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    flexShrink:0,
                    boxShadow:`0 0 14px ${col.ring}28`,
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

                {/* Week cards — indented to align under month text */}
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", paddingLeft:58 }}>
                  {month.weeks.map((week, wi) => (
                    <div key={week.week} className="rdd-week rdd-fu"
                      style={{ animationDelay:`${mi*0.07+wi*0.05}s`, borderTop:`2px solid ${col.ring}` }}>

                      {/* Week badge + label */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                        <div style={{
                          width:22, height:22, borderRadius:6,
                          background:`${col.ring}18`,
                          border:`1px solid ${col.ring}40`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:10.5, fontWeight:700, color:col.label,
                          flexShrink:0,
                        }}>
                          {week.week}
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:SUBTEXT, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                          Week {week.week}
                        </span>
                      </div>

                      {/* Topics */}
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {week.topics.map((topic, ti) => (
                          <div key={ti} className="rdd-topic">
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
          <div style={{ paddingTop:22, borderTop:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginTop:8 }}>
            <span style={{ fontSize:12, color:MUTED }}>
              {rec.career} &middot; {rec.months} month{rec.months>1?"s":""} plan
            </span>
            <span style={{ fontSize:12, color:MUTED, fontFamily:"'DM Mono',monospace" }}>
              Generated by AI
            </span>
          </div>
        </div>
      </div>
    </>
  );
}