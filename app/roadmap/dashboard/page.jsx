// File: app/roadmap/dashboard/page.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const BG      = "#080c10";
const SURFACE = "#0e1419";
const BORDER  = "#1c2530";
const MUTED   = "#3d5166";
const TEXT    = "#e2eaf2";
const SUBTEXT = "#7a96b0";
const ACCENT  = "#6ee7b7";

const MONTH_COLORS = [
  "#6ee7b7","#60a5fa","#f472b6","#fbbf24","#a78bfa","#34d399",
];

const W = { maxWidth:1100, width:"100%", margin:"0 auto", padding:"0 32px" };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RoadmapDashboard() {
  const router = useRouter();
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchRoadmaps(); }, []);

  const fetchRoadmaps = async () => {
    try {
      const res  = await fetch("/api/roadmap");
      const data = await res.json();
      if (res.ok) setRoadmaps(data.roadmaps);
      else toast.error(data.error || "Failed to load");
    } catch { toast.error("Failed to load roadmaps"); }
    finally  { setLoading(false); }
  };

  const deleteRoadmap = async (id) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/roadmap/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRoadmaps((prev) => prev.filter((r) => r.id !== id));
        toast.success("Roadmap deleted");
      } else toast.error("Failed to delete");
    } catch { toast.error("Delete failed"); }
    finally  { setDeleting(null); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        .rdb-root {
          min-height: 100vh;
          background: ${BG};
          color: ${TEXT};
          font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
          padding-top: 80px;
          padding-bottom: 80px;
          box-sizing: border-box;
        }
        .rdb-root *, .rdb-root *::before, .rdb-root *::after {
          box-sizing: border-box;
        }
        .rdb-hero {
          border-bottom: 1px solid ${BORDER};
          background: linear-gradient(180deg, #0d1620 0%, ${BG} 100%);
          padding: 40px 0 32px;
          margin-bottom: 40px;
        }
        .rdb-card {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          border-radius: 14px;
          padding: 20px 22px;
          transition: border-color .2s, box-shadow .2s;
          cursor: pointer;
        }
        .rdb-card:hover {
          border-color: ${MUTED};
          box-shadow: 0 4px 28px rgba(0,0,0,.5);
        }
        .rdb-del {
          background: transparent;
          border: 1px solid #3d1515;
          color: #f87171;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          transition: background .2s, border-color .2s;
          line-height: 1;
        }
        .rdb-del:hover { background: #1a0a0a; border-color: #7f1d1d; }
        .rdb-del:disabled { opacity: .4; cursor: not-allowed; }
        .rdb-new {
          background: ${ACCENT};
          color: #020c07;
          border: none;
          border-radius: 10px;
          padding: 10px 22px;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: background .2s, box-shadow .2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          line-height: 1;
        }
        .rdb-new:hover { background: #34d399; box-shadow: 0 0 18px ${ACCENT}40; }
        .rdb-skeleton {
          background: ${BORDER};
          border-radius: 4px;
          animation: rdb-pulse 1.4s ease-in-out infinite;
        }
        @keyframes rdb-pulse {
          0%, 100% { opacity: .5; }
          50%       { opacity: .25; }
        }
        @keyframes rdb-fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rdb-fu { animation: rdb-fadeUp .3s ease both; }
      `}</style>

      <div className="rdb-root">

        {/* ── Hero header ─────────────────────────────── */}
        <div className="rdb-hero">
          <div style={W}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
              <div>
                <p style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:ACCENT, marginBottom:6, margin:"0 0 6px" }}>
                  My Roadmaps
                </p>
                <h1 style={{ fontSize:"clamp(22px,3vw,34px)", fontWeight:700, color:TEXT, letterSpacing:"-0.02em", margin:"0 0 6px" }}>
                  Saved Career Plans
                </h1>
                <p style={{ fontSize:14, color:SUBTEXT, margin:0 }}>
                  {loading ? "Loading…" : `${roadmaps.length} roadmap${roadmaps.length !== 1 ? "s" : ""} saved`}
                </p>
              </div>
              <button className="rdb-new" onClick={() => router.push("/roadmap")}>
                + New Roadmap
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ──────────────────────────────────── */}
        <div style={W}>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
              {[1,2,3].map((i) => (
                <div key={i} style={{ background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:14, padding:"20px 22px" }}>
                  <div className="rdb-skeleton" style={{ height:14, width:"60%", marginBottom:10 }}/>
                  <div className="rdb-skeleton" style={{ height:10, width:"40%", marginBottom:6 }}/>
                  <div className="rdb-skeleton" style={{ height:10, width:"50%" }}/>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && roadmaps.length === 0 && (
            <div style={{ border:`1.5px dashed ${BORDER}`, borderRadius:14, padding:"56px 32px", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:14 }}>🗺️</div>
              <p style={{ fontSize:15, fontWeight:600, color:SUBTEXT, margin:"0 0 6px" }}>No roadmaps saved yet</p>
              <p style={{ fontSize:13, color:MUTED, margin:"0 0 22px" }}>Generate a career plan and save it to see it here</p>
              <button className="rdb-new" onClick={() => router.push("/roadmap")}>
                + Generate Your First Roadmap
              </button>
            </div>
          )}

          {/* Grid */}
          {!loading && roadmaps.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
              {roadmaps.map((r, i) => {
                const color = MONTH_COLORS[i % MONTH_COLORS.length];
                return (
                  <div key={r.id} className="rdb-card rdb-fu"
                    style={{ animationDelay:`${i*0.05}s` }}
                    onClick={() => router.push(`/roadmap/${r.id}`)}>

                    {/* Color strip */}
                    <div style={{ width:36, height:4, borderRadius:2, background:color, marginBottom:14 }}/>

                    {/* Career title */}
                    <h3 style={{ fontSize:15, fontWeight:600, color:TEXT, lineHeight:1.3, margin:"0 0 8px" }}>
                      {r.career}
                    </h3>

                    {/* Badges */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18, flexWrap:"wrap" }}>
                      <span style={{
                        fontSize:11, fontWeight:600, color,
                        background:`${color}15`, border:`1px solid ${color}30`,
                        borderRadius:20, padding:"3px 10px", lineHeight:1,
                      }}>
                        {r.months} month{r.months > 1 ? "s" : ""}
                      </span>
                      <span style={{ fontSize:11, color:MUTED }}>{timeAgo(r.createdAt)}</span>
                    </div>

                    {/* Footer actions */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:12, color:ACCENT, fontWeight:600 }}>View plan →</span>
                      <button className="rdb-del"
                        disabled={deleting === r.id}
                        onClick={(e) => { e.stopPropagation(); deleteRoadmap(r.id); }}>
                        {deleting === r.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}