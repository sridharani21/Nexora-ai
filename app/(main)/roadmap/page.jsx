"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";

export default function RoadmapPage() {
  const [career, setCareer] = useState("");
  const [months, setMonths] = useState(3);
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const roadmapRef = useRef(null);

  const generateRoadmap = async () => {
    if (!career.trim()) return alert("Enter a career");

    setLoading(true);
    setRoadmap(null);
    setError("");

    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career, months }),
      });
      const data = await res.json();

      if (data.error) setError(data.error);
      else setRoadmap(data.roadmap);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const downloadRoadmap = async () => {
    if (!roadmapRef.current) return;
    try {
      const dataUrl = await toPng(roadmapRef.current, {
        backgroundColor: "#000",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "roadmap.png";
      link.click();
    } catch {
      alert("Failed to download roadmap.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "40px" }}>
      <h1 style={{ textAlign: "center", fontSize: "32px", marginBottom: "30px" }}>
        AI Career Roadmap Generator
      </h1>

      {/* Inputs */}
      <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginBottom: "30px" }}>
        <input
          placeholder="Enter career (e.g., Web Development)"
          value={career}
          onChange={(e) => setCareer(e.target.value)}
          style={{ padding: "10px", borderRadius: "6px", border: "1px solid #444", background: "#111", color: "#fff", minWidth: "220px" }}
        />
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          style={{ padding: "10px", borderRadius: "6px", border: "1px solid #444", background: "#111", color: "#fff" }}
        >
          {[1,2,3,4,5,6].map((m)=> <option key={m} value={m}>{m} Month{m>1?'s':''}</option>)}
        </select>
        <button onClick={generateRoadmap} style={{ padding: "10px 20px", borderRadius: "6px", background: "#9333ea", color: "#fff", border: "none", cursor: "pointer" }}>
          Generate
        </button>
        {roadmap && (
          <button onClick={downloadRoadmap} style={{ padding: "10px 20px", borderRadius: "6px", background: "#22c55e", color: "#fff", border: "none", cursor: "pointer" }}>
            Download
          </button>
        )}
      </div>

      {loading && <p style={{ textAlign: "center" }}>Generating roadmap...</p>}
      {error && <p style={{ textAlign: "center", color: "red" }}>{error}</p>}

      {/* Roadmap */}
      {roadmap && (
        <div ref={roadmapRef} style={{ marginTop: "40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {roadmap.months.map((month, mi) => (
            <div key={month.month} style={{ position: "relative", marginBottom: "60px", width: "100%", maxWidth: "900px" }}>
              {/* Month Node */}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  display: "inline-block",
                  padding: "15px 25px",
                  borderRadius: "50px",
                  background: "#9333ea",
                  fontWeight: "bold",
                  marginBottom: "10px",
                  color: "#fff"
                }}>
                  Month {month.month}
                </div>
              </div>

              {/* Connecting Line to weeks */}
              <div style={{
                position: "absolute",
                top: "55px",
                left: "50%",
                height: "60px",
                width: "2px",
                background: "#9333ea",
                transform: "translateX(-50%)"
              }} />

              {/* Weeks */}
              <div style={{
                display: "flex",
                justifyContent: "space-around",
                marginTop: "60px",
                flexWrap: "wrap",
                gap: "30px"
              }}>
                {month.weeks.map((week) => (
                  <div key={week.week} style={{ position: "relative", textAlign: "center" }}>
                    <div style={{
                      padding: "12px 20px",
                      borderRadius: "10px",
                      border: "2px solid #22c55e",
                      background: "#111",
                      fontWeight: "bold",
                      color: "#fff",
                      marginBottom: "10px"
                    }}>
                      Week {week.week}
                    </div>

                    {/* Topics */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {week.topics.map((topic, ti) => (
                        <div key={ti} style={{
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#222",
                          color: "#fff",
                          fontSize: "14px"
                        }}>
                          {topic}
                        </div>
                      ))}
                    </div>

                    {/* Connecting line from month to week */}
                    <div style={{
                      position: "absolute",
                      top: "-55px",
                      left: "50%",
                      width: "2px",
                      height: "50px",
                      background: "#9333ea",
                      transform: "translateX(-50%)"
                    }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}