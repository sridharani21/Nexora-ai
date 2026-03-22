// ==================================================================
// File: components/resume-template.jsx
// FIXES:
//   1. Projects section added to ALL templates that were missing it
//   2. printResume() utility exported for isolated PDF download
// ==================================================================
"use client";

import React from "react";

export const TEMPLATE_REGISTRY = [
  { id:"faang-clean",       name:"Google Clean",      category:"FAANG & Big Tech",        desc:"Minimal single-column, ATS-perfect" },
  { id:"faang-technical",   name:"Meta Technical",    category:"FAANG & Big Tech",        desc:"Skills chip bar + metrics emphasis" },
  { id:"faang-modern",      name:"Apple Modern",      category:"FAANG & Big Tech",        desc:"Ultra whitespace, bold typography" },
  { id:"faang-amazon",      name:"Amazon Impact",     category:"FAANG & Big Tech",        desc:"Results-driven, orange accent bar" },
  { id:"finance-classic",   name:"Wall Street",       category:"Finance & Consulting",    desc:"Traditional centered serif" },
  { id:"finance-prestige",  name:"McKinsey",          category:"Finance & Consulting",    desc:"Structured hierarchy, navy top bar" },
  { id:"finance-banking",   name:"Investment Bank",   category:"Finance & Consulting",    desc:"Dense, bold headers, ATS-tight" },
  { id:"startup-bold",      name:"Startup Sidebar",   category:"Startups & Tech",         desc:"Dark left sidebar + main content" },
  { id:"startup-modern",    name:"YC Modern",         category:"Startups & Tech",         desc:"Clean accent, pill skill tags" },
  { id:"startup-sidebar",   name:"Sidebar Pro",       category:"Startups & Tech",         desc:"Dark sidebar with skill dots" },
  { id:"creative-designer", name:"Portfolio",         category:"Creative & Design",       desc:"Purple header block + project grid" },
  { id:"creative-agency",   name:"Agency",            category:"Creative & Design",       desc:"Bold dark header, right panel" },
  { id:"creative-twocol",   name:"Studio",            category:"Creative & Design",       desc:"Pink sidebar two-tone layout" },
  { id:"academic-standard", name:"Academic CV",       category:"Healthcare & Academia",   desc:"Centered serif, research-ready" },
  { id:"medical-clean",     name:"Medical",           category:"Healthcare & Academia",   desc:"Credentials-first, teal accent" },
  { id:"govt-federal",      name:"Federal",           category:"Government & Non-profit", desc:"Navy header block, formal detail" },
  { id:"govt-traditional",  name:"Traditional",       category:"Government & Non-profit", desc:"Conservative full-caps serif" },
  { id:"general-ats",       name:"ATS Optimized",     category:"General Purpose",         desc:"Max machine readability, plain" },
  { id:"general-balanced",  name:"Balanced",          category:"General Purpose",         desc:"Navy header + left skill panel" },
  { id:"general-executive", name:"Executive",         category:"General Purpose",         desc:"Senior leadership, italic summary" },
];

export const TEMPLATE_CATEGORIES = [
  "All",
  "FAANG & Big Tech",
  "Finance & Consulting",
  "Startups & Tech",
  "Creative & Design",
  "Healthcare & Academia",
  "Government & Non-profit",
  "General Purpose",
];

// ─── PDF download — renders resume to actual PDF file ────────────
export async function downloadResumeAsPDF(elementId = "resume-preview", filename = "resume.pdf") {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Resume element not found");

  const loadScript = (src, globalCheck) => new Promise((res, rej) => {
    if (globalCheck && window[globalCheck]) return res();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) existing.remove();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    "html2canvas"
  );
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    null
  );

  if (!window.html2canvas) throw new Error("html2canvas not loaded");
  if (!window.jspdf) throw new Error("jsPDF not loaded");

  const originalStyle = el.style.cssText;
  el.style.width = "794px";
  el.style.maxWidth = "794px";

  let canvas;
  try {
    canvas = await window.html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
      onclone: (clonedDoc, clonedEl) => {
        clonedEl.style.overflow = "visible";
        clonedEl.style.height = "auto";

        // ── Nuclear fix for lab()/oklch()/oklab() in Tailwind v4 ──────
        // 1. Scrub every existing stylesheet in the clone — replace any
        //    rule containing lab/oklch/oklab/lch with a safe fallback.
        Array.from(clonedDoc.styleSheets || []).forEach((sheet) => {
          try {
            const rules = Array.from(sheet.cssRules || []);
            rules.forEach((rule, idx) => {
              if (!rule.cssText) return;
              if (/lab\(|oklch\(|oklab\(|lch\(/.test(rule.cssText)) {
                try {
                  // Replace the whole rule with a sanitised version
                  const safe = rule.cssText
                    .replace(/:\s*lab\([^;})]+\)/gi, ": transparent")
                    .replace(/:\s*oklch\([^;})]+\)/gi, ": transparent")
                    .replace(/:\s*oklab\([^;})]+\)/gi, ": transparent")
                    .replace(/:\s*lch\([^;})]+\)/gi, ": transparent")
                    .replace(/:\s*color\([^;})]+\)/gi, ": transparent");
                  sheet.deleteRule(idx);
                  sheet.insertRule(safe, idx);
                } catch (_) {
                  // Some rules can't be replaced — just delete them
                  try { sheet.deleteRule(idx); } catch (__) {}
                }
              }
            });
          } catch (_) {
            // Cross-origin sheets throw on cssRules access — skip
          }
        });

        // 2. Inject an override <style> that resets every CSS custom
        //    property Tailwind v4 might have set to a lab/oklch value,
        //    and forces all elements to use only safe colors.
        const override = clonedDoc.createElement("style");
        override.textContent = `
          *, *::before, *::after {
            --tw-ring-color: transparent !important;
            --tw-ring-shadow: none !important;
            --tw-shadow-color: transparent !important;
          }
          [style*="lab("], [style*="oklch("], [style*="oklab("], [style*="lch("] {
            color: inherit !important;
            background-color: transparent !important;
            border-color: transparent !important;
          }
        `;
        clonedDoc.head.appendChild(override);

        // 3. Walk every element and strip any inline style that uses lab/oklch
        const badColor = /\b(lab|oklch|oklab|lch)\s*\(/i;
        const walk = (node) => {
          if (node.nodeType !== 1) return;
          if (node.style && node.style.cssText && badColor.test(node.style.cssText)) {
            node.style.cssText = node.style.cssText.replace(
              /:\s*(lab|oklch|oklab|lch)\([^;)]+\)/gi,
              ": transparent"
            );
          }
          node.childNodes.forEach(walk);
        };
        walk(clonedEl);
      },
    });
  } finally {
    el.style.cssText = originalStyle;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "px", format: "a4", orientation: "portrait", hotfixes: ["px_scaling"] });

  const pageW   = pdf.internal.pageSize.getWidth();
  const pageH   = pdf.internal.pageSize.getHeight();
  const scale   = pageW / canvas.width;
  const scaledH = canvas.height * scale;

  const imgData = canvas.toDataURL("image/png");

  if (scaledH <= pageH) {
    pdf.addImage(imgData, "PNG", 0, 0, pageW, scaledH);
  } else {
    const pageCanvasH = Math.floor(pageH / scale);
    let yCanvas = 0;
    while (yCanvas < canvas.height) {
      if (yCanvas > 0) pdf.addPage();
      const sliceH = Math.min(pageCanvasH, canvas.height - yCanvas);
      const slice  = document.createElement("canvas");
      slice.width  = canvas.width;
      slice.height = sliceH;
      slice.getContext("2d").drawImage(
        canvas, 0, yCanvas, canvas.width, sliceH, 0, 0, canvas.width, sliceH
      );
      pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageW, sliceH * scale);
      yCanvas += pageCanvasH;
    }
  }

  pdf.save(filename);
}

// ─── Helpers ─────────────────────────────────────────────────────
const safe = (arr) => (Array.isArray(arr) ? arr : []);
const str = (v) => v || "";

function Contacts({ data, color = "#555", sep = " · " }) {
  const parts = [
    data.email, data.phone, data.location,
    data.linkedin && "LinkedIn",
    data.github && "GitHub",
    data.portfolio && "Portfolio",
  ].filter(Boolean);
  return (
    <div style={{ fontSize: 10.5, color, lineHeight: 1.7 }}>
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && <span style={{ margin: "0 4px" }}>{sep}</span>}{p}</span>
      ))}
    </div>
  );
}

function Bullets({ items, color = "#444" }) {
  const list = safe(items).filter(Boolean);
  if (!list.length) return null;
  return (
    <ul style={{ margin: "4px 0 0", paddingLeft: 14 }}>
      {list.map((item, i) => (
        <li key={i} style={{ fontSize: 10.5, color, lineHeight: 1.65, marginBottom: 2 }}>{item}</li>
      ))}
    </ul>
  );
}

function skills2groups(skills) {
  return safe(skills).reduce((acc, s) => {
    const k = s.category || "Skills";
    (acc[k] = acc[k] || []).push(s.name);
    return acc;
  }, {});
}

// ─── Shared project block — used by templates without a custom layout ──
function ProjectsBlock({ projects, color = "#111", accentColor = "#333" }) {
  if (!safe(projects).length) return null;
  return (
    <>
      {safe(projects).map((p, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ fontSize: 12, color }}>{p.name}</b>
            <div style={{ display: "flex", gap: 8 }}>
              {p.link && <span style={{ fontSize: 10, color: accentColor }}>Live ↗</span>}
              {p.github && <span style={{ fontSize: 10, color: accentColor }}>GitHub ↗</span>}
            </div>
          </div>
          {p.description && (
            <div style={{ fontSize: 10.5, color: "#555", lineHeight: 1.6, marginTop: 2 }}>{p.description}</div>
          )}
          {safe(p.technologies).filter(Boolean).length > 0 && (
            <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
              {p.technologies.filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ─── Shared certs block ───────────────────────────────────────────
function CertsBlock({ certifications, color = "#111", subColor = "#555", dateColor = "#777" }) {
  if (!safe(certifications).length) return null;
  return (
    <>
      {safe(certifications).map((c, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
          <div>
            <b style={{ fontSize:11, color }}>{c.name}</b>
            {c.issuer && <span style={{ fontSize:10.5, color:subColor }}> · {c.issuer}</span>}
          </div>
          {c.issueDate && <span style={{ fontSize:10, color:dateColor, flexShrink:0, marginLeft:8 }}>{c.issueDate}</span>}
        </div>
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 1. FAANG CLEAN — Google-style minimal
// ═══════════════════════════════════════════════════════════════════
function FAANGClean({ data }) {
  const g = skills2groups(data.skills);
  return (
    <div style={{ background:"#fff", color:"#111", fontFamily:"Arial,sans-serif", padding:"40px 48px", minHeight:"11in" }}>
      <h1 style={{ fontSize:24, fontWeight:700, margin:"0 0 4px", letterSpacing:"-0.01em" }}>{str(data.fullName)}</h1>
      <Contacts data={data} />
      <div style={{ height:1.5, background:"#111", margin:"10px 0 14px" }} />
      {data.summary && <><SecHead>Summary</SecHead><p style={{ fontSize:10.5, lineHeight:1.7, color:"#444", margin:"0 0 14px" }}>{data.summary}</p></>}
      {safe(data.experiences).length>0 && <><SecHead>Experience</SecHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:12 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.position}</b><div style={{ fontSize:11, color:"#555" }}>{e.company}{e.location?`, ${e.location}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#777" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} />
        </div>
      ))}</>}
      {safe(data.education).length>0 && <><SecHead>Education</SecHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:8 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.degree}{e.field?` in ${e.field}`:""}</b><div style={{ fontSize:11, color:"#555" }}>{e.institution}{e.gpa?` · GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#777" }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {/* ✅ PROJECTS — was missing */}
      {safe(data.projects).length>0 && <><SecHead>Projects</SecHead><ProjectsBlock projects={data.projects} color="#111" accentColor="#1a73e8"/></>}
      {safe(data.skills).length>0 && <><SecHead>Skills</SecHead>{Object.entries(g).map(([cat,sks])=>(
        <div key={cat} style={{ fontSize:10.5, marginBottom:3 }}><b>{cat}:</b> <span style={{ color:"#555" }}>{sks.join(", ")}</span></div>
      ))}</>}
      {safe(data.certifications).length>0 && <><SecHead>Certifications</SecHead><CertsBlock certifications={data.certifications}/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 2. FAANG TECHNICAL — chip skillbar
// ═══════════════════════════════════════════════════════════════════
function FAANGTechnical({ data }) {
  const acc = "#1a73e8";
  return (
    <div style={{ background:"#fff", color:"#202124", fontFamily:"Roboto,Arial,sans-serif", padding:"36px 44px", minHeight:"11in" }}>
      <h1 style={{ fontSize:26, fontWeight:400, margin:"0 0 4px" }}>{str(data.fullName)}</h1>
      <Contacts data={data} color="#5f6368" />
      <div style={{ width:60, height:2, background:acc, margin:"12px 0 14px" }} />
      {data.summary && <p style={{ fontSize:11, lineHeight:1.6, color:"#5f6368", margin:"0 0 14px", borderLeft:`3px solid ${acc}`, paddingLeft:10 }}>{data.summary}</p>}
      {safe(data.skills).length>0 && (
        <div style={{ background:"#f8f9fa", borderRadius:4, padding:"10px 14px", marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:acc, marginBottom:6 }}>Technical Skills</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 6px" }}>
            {safe(data.skills).map((s,i)=><span key={i} style={{ fontSize:10, padding:"2px 8px", background:"#fff", border:"1px solid #dadce0", borderRadius:12, color:"#3c4043" }}>{s.name}</span>)}
          </div>
        </div>
      )}
      {safe(data.experiences).length>0 && <><ColorHead color={acc}>Experience</ColorHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:14 }}>
          <Row left={<><span style={{ fontSize:12.5, fontWeight:500 }}>{e.position}</span><div style={{ fontSize:11, color:"#5f6368" }}>{e.company}</div></>}
            right={<span style={{ fontSize:10, color:"#80868b" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#3c4043" />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><ColorHead color={acc}>Projects</ColorHead><ProjectsBlock projects={data.projects} color="#202124" accentColor={acc}/></>}
      {safe(data.education).length>0 && <><ColorHead color={acc}>Education</ColorHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:6 }}>
          <Row left={<><div style={{ fontSize:12, fontWeight:500 }}>{e.degree}{e.field?` in ${e.field}`:""}</div><div style={{ fontSize:11, color:"#5f6368" }}>{e.institution}{e.gpa?` · GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:10, color:"#80868b" }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.certifications).length>0 && <><ColorHead color={acc}>Certifications</ColorHead><CertsBlock certifications={data.certifications} color="#202124" subColor="#5f6368" dateColor="#80868b"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 3. FAANG MODERN — Apple whitespace
// ═══════════════════════════════════════════════════════════════════
function FAANGModern({ data }) {
  return (
    <div style={{ background:"#fff", color:"#1d1d1f", fontFamily:"-apple-system,Helvetica,sans-serif", padding:"48px 52px", minHeight:"11in" }}>
      <h1 style={{ fontSize:32, fontWeight:700, margin:"0 0 6px", letterSpacing:"-0.02em" }}>{str(data.fullName)}</h1>
      <Contacts data={data} color="#86868b" sep="  ·  " />
      <div style={{ height:1, background:"#d2d2d7", margin:"16px 0" }} />
      {data.summary && <p style={{ fontSize:12, lineHeight:1.8, color:"#515154", margin:"0 0 20px" }}>{data.summary}</p>}
      {safe(data.experiences).length>0 && <><AppleHead>Experience</AppleHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:16, paddingBottom:16, borderBottom:i<data.experiences.length-1?"1px solid #f2f2f7":"none" }}>
          <Row left={<><div style={{ fontSize:13, fontWeight:600 }}>{e.position}</div><div style={{ fontSize:11.5, color:"#515154" }}>{e.company}</div></>}
            right={<span style={{ fontSize:10.5, color:"#86868b" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#515154" />
        </div>
      ))}</>}
      {safe(data.education).length>0 && <><AppleHead>Education</AppleHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:8 }}>
          <Row left={<><div style={{ fontSize:12.5, fontWeight:600 }}>{e.degree}{e.field?` in ${e.field}`:""}</div><div style={{ fontSize:11, color:"#515154" }}>{e.institution}{e.gpa?` · GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#86868b" }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><AppleHead>Projects</AppleHead><ProjectsBlock projects={data.projects} color="#1d1d1f" accentColor="#0071e3"/></>}
      {safe(data.skills).length>0 && <><AppleHead>Skills</AppleHead>{Object.entries(skills2groups(data.skills)).map(([cat,sks])=>(
        <div key={cat} style={{ fontSize:11, marginBottom:4, color:"#515154" }}><b style={{ color:"#1d1d1f" }}>{cat}: </b>{sks.join(", ")}</div>
      ))}</>}
      {safe(data.certifications).length>0 && <><AppleHead>Certifications</AppleHead><CertsBlock certifications={data.certifications} color="#1d1d1f" subColor="#515154" dateColor="#86868b"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 4. AMAZON IMPACT
// ═══════════════════════════════════════════════════════════════════
function FAANGAmazon({ data }) {
  const acc = "#ff9900";
  return (
    <div style={{ background:"#fff", color:"#0f1111", fontFamily:"Arial,sans-serif", padding:"36px 44px", minHeight:"11in" }}>
      <div style={{ borderBottom:`3px solid ${acc}`, paddingBottom:12, marginBottom:14 }}>
        <h1 style={{ fontSize:24, fontWeight:700, margin:"0 0 4px" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#565959" />
      </div>
      {data.summary && <p style={{ fontSize:11, lineHeight:1.7, color:"#565959", margin:"0 0 14px", padding:"8px 12px", background:"#fafafa", borderLeft:`3px solid ${acc}` }}>{data.summary}</p>}
      {safe(data.experiences).length>0 && <><ColorHead color={acc}>Professional Experience</ColorHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:12 }}>
          <Row left={<><b style={{ fontSize:12.5 }}>{e.position} — {e.company}</b>{e.location&&<div style={{ fontSize:10.5, color:"#888" }}>{e.location}</div>}</>}
            right={<span style={{ fontSize:10.5, color:"#565959" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><ColorHead color={acc}>Projects</ColorHead><ProjectsBlock projects={data.projects} color="#0f1111" accentColor={acc}/></>}
      {safe(data.education).length>0 && <><ColorHead color={acc}>Education</ColorHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:6 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.degree}{e.field?` in ${e.field}`:""}</b><div style={{ fontSize:11, color:"#565959" }}>{e.institution}{e.gpa?` · GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#565959" }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.skills).length>0 && <><ColorHead color={acc}>Skills</ColorHead>{Object.entries(skills2groups(data.skills)).map(([c,s])=>(
        <div key={c} style={{ fontSize:11, marginBottom:3 }}><b>{c}:</b> <span style={{ color:"#565959" }}>{s.join(", ")}</span></div>
      ))}</>}
      {safe(data.certifications).length>0 && <><ColorHead color={acc}>Certifications</ColorHead><CertsBlock certifications={data.certifications} color="#0f1111" subColor="#565959" dateColor="#888"/></>}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════
function FinanceClassic({ data }) {
  return (
    <div style={{ background:"#fff", color:"#1a1a1a", fontFamily:"Georgia,'Times New Roman',serif", padding:"44px 52px", minHeight:"11in" }}>
      <div style={{ textAlign:"center", marginBottom:14 }}>
        <h1 style={{ fontSize:22, fontWeight:700, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.06em" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#555" sep=" | " />
      </div>
      <div style={{ height:2, background:"#1a1a1a", margin:"0 0 3px" }} />
      <div style={{ height:1, background:"#1a1a1a", margin:"0 0 16px" }} />
      {data.summary && <><CenteredHead>Professional Profile</CenteredHead><p style={{ fontSize:10.5, lineHeight:1.7, color:"#333", margin:"0 0 14px", textAlign:"justify" }}>{data.summary}</p><HDivider/></>}
      {safe(data.experiences).length>0 && <><CenteredHead>Professional Experience</CenteredHead><HDivider/>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:13 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.company}</b><div style={{ fontSize:11.5, fontStyle:"italic", color:"#333" }}>{e.position}{e.location?`, ${e.location}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#555", fontStyle:"italic" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#333" />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><HDivider/><CenteredHead>Projects</CenteredHead><HDivider/><ProjectsBlock projects={data.projects} color="#1a1a1a" accentColor="#555"/></>}
      {safe(data.education).length>0 && <><HDivider/><CenteredHead>Education</CenteredHead><HDivider/>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:7 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.institution}</b><div style={{ fontSize:11, fontStyle:"italic", color:"#555" }}>{e.degree}{e.field?` in ${e.field}`:""}{e.gpa?` — GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#555", fontStyle:"italic" }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.certifications).length>0 && <><HDivider/><CenteredHead>Certifications</CenteredHead><HDivider/><CertsBlock certifications={data.certifications} color="#1a1a1a" subColor="#555" dateColor="#777"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 6. McKINSEY PRESTIGE
// ═══════════════════════════════════════════════════════════════════
function FinancePrestige({ data }) {
  const acc = "#003366";
  return (
    <div style={{ background:"#fff", color:"#1a1a2e", fontFamily:"Georgia,serif", padding:"40px 50px", minHeight:"11in" }}>
      <div style={{ borderTop:`5px solid ${acc}`, paddingTop:16, marginBottom:14 }}>
        <h1 style={{ fontSize:22, fontWeight:700, margin:"0 0 3px" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#666" />
      </div>
      {data.summary && <div style={{ fontSize:11, lineHeight:1.7, color:"#333", margin:"0 0 16px", padding:"10px 14px", borderLeft:`4px solid ${acc}`, background:"#f7f9fc" }}>{data.summary}</div>}
      {safe(data.experiences).length>0 && <><LinedHead color={acc}>Experience</LinedHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:14 }}>
          <Row left={<><div style={{ fontSize:12.5, fontWeight:700, color:acc }}>{e.position}</div><div style={{ fontSize:11.5, fontWeight:600, color:"#333" }}>{e.company}{e.location?`, ${e.location}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#777", fontStyle:"italic" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#444" />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><LinedHead color={acc}>Projects</LinedHead><ProjectsBlock projects={data.projects} color="#1a1a2e" accentColor={acc}/></>}
      {safe(data.education).length>0 && <><LinedHead color={acc}>Education</LinedHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:7 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.degree}{e.field?` in ${e.field}`:""}</b><div style={{ fontSize:11, color:"#555" }}>{e.institution}{e.gpa?` · GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#777", fontStyle:"italic" }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.skills).length>0 && <><LinedHead color={acc}>Skills</LinedHead><div style={{ display:"flex", flexWrap:"wrap", gap:"4px 16px" }}>{safe(data.skills).map((s,i)=><span key={i} style={{ fontSize:10.5, color:"#444" }}>· {s.name}</span>)}</div></>}
      {safe(data.certifications).length>0 && <><LinedHead color={acc}>Certifications</LinedHead><CertsBlock certifications={data.certifications} color="#1a1a2e" subColor="#666" dateColor="#777"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 7. INVESTMENT BANKING — dense
// ═══════════════════════════════════════════════════════════════════
function FinanceBanking({ data }) {
  return (
    <div style={{ background:"#fff", color:"#0d0d0d", fontFamily:"Arial,Helvetica,sans-serif", padding:"32px 44px", minHeight:"11in" }}>
      <div style={{ textAlign:"center", marginBottom:10 }}>
        <h1 style={{ fontSize:18, fontWeight:700, margin:"0 0 3px", textTransform:"uppercase", letterSpacing:"0.08em" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#333" />
      </div>
      <div style={{ height:1.5, background:"#0d0d0d", marginBottom:10 }} />
      {data.summary && <p style={{ fontSize:10.5, lineHeight:1.6, margin:"0 0 10px" }}>{data.summary}</p>}
      {safe(data.experiences).length>0 && <><BoldHead>Experience</BoldHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:10 }}>
          <Row left={<><b style={{ fontSize:11.5 }}>{e.company}</b><div style={{ fontSize:11, fontStyle:"italic", color:"#333" }}>{e.position}{e.location?` · ${e.location}`:""}</div></>}
            right={<span style={{ fontSize:10, color:"#555" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><BoldHead>Projects</BoldHead><ProjectsBlock projects={data.projects} color="#0d0d0d" accentColor="#555"/></>}
      {safe(data.education).length>0 && <><BoldHead>Education</BoldHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:5 }}>
          <Row left={<><b style={{ fontSize:11.5 }}>{e.institution}</b><span style={{ fontSize:10.5, color:"#444" }}> · {e.degree}{e.field?` in ${e.field}`:""}{e.gpa?` · GPA: ${e.gpa}`:""}</span></>}
            right={<span style={{ fontSize:10, color:"#555" }}>{e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.skills).length>0 && <><BoldHead>Skills</BoldHead><p style={{ fontSize:10.5, color:"#333", margin:0, lineHeight:1.7 }}>{safe(data.skills).map(s=>s.name).filter(Boolean).join(" · ")}</p></>}
      {safe(data.certifications).length>0 && <><BoldHead>Certifications</BoldHead><CertsBlock certifications={data.certifications} color="#0d0d0d" subColor="#444" dateColor="#555"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 8. STARTUP BOLD — indigo sidebar
// ═══════════════════════════════════════════════════════════════════
function StartupBold({ data }) {
  const acc = "#6366f1";
  const g = skills2groups(data.skills);
  return (
    <div style={{ background:"#fff", fontFamily:"system-ui,sans-serif", display:"flex", minHeight:"11in" }}>
      <div style={{ width:195, background:"#1e1b4b", color:"#e0e7ff", padding:"32px 18px", flexShrink:0 }}>
        <div style={{ width:52, height:52, borderRadius:"50%", background:acc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:700, color:"#fff", marginBottom:12 }}>{(data.fullName||"?")[0]}</div>
        <h1 style={{ fontSize:14, fontWeight:700, color:"#fff", margin:"0 0 10px", lineHeight:1.3 }}>{str(data.fullName)}</h1>
        <div style={{ fontSize:9.5, color:"#a5b4fc", lineHeight:1.9, marginBottom:18 }}>
          {[data.email,data.phone,data.location].filter(Boolean).map((v,i)=><div key={i}>{v}</div>)}
          {data.linkedin&&<div style={{ color:acc }}>LinkedIn</div>}
          {data.github&&<div style={{ color:acc }}>GitHub</div>}
        </div>
        {Object.entries(g).map(([cat,sks])=>(
          <div key={cat} style={{ marginBottom:13 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#a5b4fc", marginBottom:5 }}>{cat}</div>
            {sks.map((sk,i)=><div key={i} style={{ fontSize:10, color:"#c7d2fe", marginBottom:2 }}>· {sk}</div>)}
          </div>
        ))}
        {safe(data.certifications).length>0 && (
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", color:"#a5b4fc", marginBottom:5 }}>Certs</div>
            {safe(data.certifications).map((c,i)=><div key={i} style={{ fontSize:10, color:"#c7d2fe", marginBottom:3 }}>{c.name}</div>)}
          </div>
        )}
      </div>
      <div style={{ flex:1, padding:"32px 28px" }}>
        {data.summary && <p style={{ fontSize:11, lineHeight:1.7, color:"#4b5563", margin:"0 0 16px", borderLeft:`3px solid ${acc}`, paddingLeft:10 }}>{data.summary}</p>}
        {safe(data.experiences).length>0 && <><ColorHead color={acc}>Experience</ColorHead>{safe(data.experiences).map((e,i)=>(
          <div key={i} style={{ marginBottom:13 }}>
            <Row left={<><b style={{ fontSize:12.5, color:"#111827" }}>{e.position}</b><div style={{ fontSize:11, color:acc }}>{e.company}</div></>}
              right={<span style={{ fontSize:10, color:"#9ca3af" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
            <Bullets items={e.description} color="#374151" />
          </div>
        ))}</>}
        {safe(data.education).length>0 && <><ColorHead color={acc}>Education</ColorHead>{safe(data.education).map((e,i)=>(
          <div key={i} style={{ marginBottom:7 }}>
            <Row left={<><b style={{ fontSize:12, color:"#111827" }}>{e.degree}{e.field?` in ${e.field}`:""}</b><div style={{ fontSize:11, color:"#6b7280" }}>{e.institution}{e.gpa?` · GPA: ${e.gpa}`:""}</div></>}
              right={<span style={{ fontSize:10, color:"#9ca3af" }}>{e.startDate} – {e.endDate}</span>}/>
          </div>
        ))}</>}
        {safe(data.projects).length>0 && <><ColorHead color={acc}>Projects</ColorHead>{safe(data.projects).map((p,i)=>(
          <div key={i} style={{ marginBottom:9 }}>
            <b style={{ fontSize:12, color:"#111827" }}>{p.name}</b>
            {p.description && <div style={{ fontSize:10.5, color:"#6b7280", lineHeight:1.6 }}>{p.description}</div>}
            {safe(p.technologies).filter(Boolean).length>0 && <div style={{ fontSize:10, color:"#9ca3af" }}>{p.technologies.filter(Boolean).join(", ")}</div>}
          </div>
        ))}</>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 9. YC MODERN — orange accent + pill tags (already had projects ✅)
// ═══════════════════════════════════════════════════════════════════
function StartupModern({ data }) {
  const acc = "#e15c25";
  return (
    <div style={{ background:"#fff", color:"#1a1a1a", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", padding:"40px 48px", minHeight:"11in" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14, paddingBottom:12, borderBottom:`2px solid ${acc}` }}>
        <h1 style={{ fontSize:28, fontWeight:700, margin:0, letterSpacing:"-0.01em" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#666" />
      </div>
      {data.summary && <p style={{ fontSize:11, lineHeight:1.7, color:"#444", margin:"0 0 16px" }}>{data.summary}</p>}
      {safe(data.experiences).length>0 && <><ColorHead color={acc}>Experience</ColorHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:14 }}>
          <Row left={<><span style={{ fontSize:13, fontWeight:700 }}>{e.position} <span style={{ fontWeight:400, color:"#666" }}>@ {e.company}</span></span></>}
            right={<span style={{ fontSize:10.5, color:"#888" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#555" />
        </div>
      ))}</>}
      {safe(data.skills).length>0 && (
        <div style={{ margin:"14px 0" }}>
          <ColorHead color={acc}>Skills</ColorHead>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 6px" }}>
            {safe(data.skills).map((s,i)=><span key={i} style={{ fontSize:10, padding:"3px 9px", background:"#f3f4f6", borderRadius:4, color:"#374151", border:"1px solid #e5e7eb" }}>{s.name}</span>)}
          </div>
        </div>
      )}
      {safe(data.education).length>0 && <><ColorHead color={acc}>Education</ColorHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:6 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.degree}{e.field?` in ${e.field}`:""}</b><div style={{ fontSize:11, color:"#666" }}>{e.institution}{e.gpa?` · GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#888" }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.projects).length>0 && <><ColorHead color={acc}>Projects</ColorHead>{safe(data.projects).map((p,i)=>(
        <div key={i} style={{ marginBottom:8 }}>
          <b style={{ fontSize:12 }}>{p.name}</b>
          {safe(p.technologies).filter(Boolean).length>0 && <span style={{ fontSize:10, color:"#888", marginLeft:6 }}>[{p.technologies.filter(Boolean).join(", ")}]</span>}
          {p.description && <div style={{ fontSize:10.5, color:"#555", lineHeight:1.6, marginTop:2 }}>{p.description}</div>}
        </div>
      ))}</>}
      {safe(data.certifications).length>0 && <><ColorHead color={acc}>Certifications</ColorHead><CertsBlock certifications={data.certifications} color="#1a1a1a" subColor="#666" dateColor="#888"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 10. SIDEBAR PRO — dark sidebar + dot skills (already had projects ✅)
// ═══════════════════════════════════════════════════════════════════
function StartupSidebar({ data }) {
  const acc = "#10b981";
  const g = skills2groups(data.skills);
  return (
    <div style={{ background:"#fff", fontFamily:"system-ui,sans-serif", display:"flex", minHeight:"11in" }}>
      <div style={{ width:185, background:"#111827", padding:"32px 16px", flexShrink:0 }}>
        <h1 style={{ fontSize:14, fontWeight:700, color:"#fff", margin:"0 0 6px", lineHeight:1.3 }}>{str(data.fullName)}</h1>
        <div style={{ fontSize:9.5, color:"#9ca3af", lineHeight:1.9, marginBottom:18 }}>
          {[data.email,data.phone,data.location].filter(Boolean).map((v,i)=><div key={i}>{v}</div>)}
          {data.linkedin&&<div style={{ color:acc }}>LinkedIn</div>}
          {data.github&&<div style={{ color:acc }}>GitHub</div>}
        </div>
        {Object.entries(g).map(([cat,sks])=>(
          <div key={cat} style={{ marginBottom:13 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", color:acc, letterSpacing:"0.1em", marginBottom:5 }}>{cat}</div>
            {sks.map((sk,i)=>(
              <div key={i} style={{ fontSize:9.5, color:"#d1d5db", marginBottom:3, display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:4, height:4, borderRadius:"50%", background:acc, flexShrink:0 }}/>{sk}
              </div>
            ))}
          </div>
        ))}
        {safe(data.education).length>0 && (
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", color:acc, marginBottom:5 }}>Education</div>
            {safe(data.education).map((e,i)=>(
              <div key={i} style={{ marginBottom:8 }}>
                <div style={{ fontSize:9.5, fontWeight:600, color:"#f3f4f6" }}>{e.degree}</div>
                <div style={{ fontSize:9, color:"#9ca3af" }}>{e.institution}</div>
                <div style={{ fontSize:9, color:"#6b7280" }}>{e.endDate}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex:1, padding:"32px 26px" }}>
        {data.summary && <p style={{ fontSize:11, lineHeight:1.7, color:"#374151", margin:"0 0 16px", borderBottom:"1px solid #e5e7eb", paddingBottom:13 }}>{data.summary}</p>}
        {safe(data.experiences).length>0 && <><ColorHead color={acc}>Work Experience</ColorHead>{safe(data.experiences).map((e,i)=>(
          <div key={i} style={{ marginBottom:13 }}>
            <Row left={<><b style={{ fontSize:13, color:"#111827" }}>{e.position}</b><div style={{ fontSize:11, color:acc }}>{e.company}{e.location?` · ${e.location}`:""}</div></>}
              right={<span style={{ fontSize:10, color:"#9ca3af" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
            <Bullets items={e.description} color="#4b5563" />
          </div>
        ))}</>}
        {safe(data.projects).length>0 && <><ColorHead color={acc}>Projects</ColorHead>{safe(data.projects).map((p,i)=>(
          <div key={i} style={{ marginBottom:10 }}>
            <Row left={<b style={{ fontSize:12, color:"#111827" }}>{p.name}</b>}
              right={<div style={{ display:"flex", gap:6 }}>{p.link&&<span style={{ fontSize:10, color:acc }}>Live ↗</span>}{p.github&&<span style={{ fontSize:10, color:acc }}>GitHub ↗</span>}</div>}/>
            {p.description && <div style={{ fontSize:10.5, color:"#6b7280", lineHeight:1.6 }}>{p.description}</div>}
            {safe(p.technologies).filter(Boolean).length>0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:"3px 5px", marginTop:3 }}>
                {p.technologies.filter(Boolean).map((t,j)=><span key={j} style={{ fontSize:9.5, padding:"1px 6px", background:`${acc}15`, color:acc, borderRadius:3 }}>{t}</span>)}
              </div>
            )}
          </div>
        ))}</>}
        {safe(data.certifications).length>0 && <><ColorHead color={acc}>Certifications</ColorHead><CertsBlock certifications={data.certifications} color="#111827" subColor="#6b7280" dateColor="#9ca3af"/></>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 11. CREATIVE PORTFOLIO — already had projects ✅
// ═══════════════════════════════════════════════════════════════════
function CreativeDesigner({ data }) {
  const acc = "#8b5cf6";
  return (
    <div style={{ background:"#fafafa", color:"#1a1a1a", fontFamily:"'Helvetica Neue',sans-serif", minHeight:"11in" }}>
      <div style={{ background:acc, color:"#fff", padding:"36px 48px 24px" }}>
        <h1 style={{ fontSize:32, fontWeight:900, margin:"0 0 8px", letterSpacing:"-0.02em" }}>{str(data.fullName)}</h1>
        <div style={{ fontSize:11, opacity:0.85, lineHeight:1.7 }}>
          {[data.email,data.phone,data.location,data.portfolio,data.linkedin].filter(Boolean).join("  ·  ")}
        </div>
      </div>
      <div style={{ padding:"24px 48px" }}>
        {data.summary && <p style={{ fontSize:12, lineHeight:1.8, color:"#555", margin:"0 0 18px", borderLeft:`3px solid ${acc}`, paddingLeft:12 }}>{data.summary}</p>}
        {safe(data.experiences).length>0 && <><ColorHead color={acc}>Experience</ColorHead>{safe(data.experiences).map((e,i)=>(
          <div key={i} style={{ marginBottom:14 }}>
            <Row left={<><b style={{ fontSize:13 }}>{e.position}</b><div style={{ fontSize:11.5, color:acc }}>{e.company}</div></>}
              right={<span style={{ fontSize:10, color:"#999" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
            <Bullets items={e.description} color="#555" />
          </div>
        ))}</>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, marginTop:14 }}>
          {safe(data.skills).length>0 && (
            <div>
              <ColorHead color={acc}>Skills</ColorHead>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
                {safe(data.skills).map((s,i)=><span key={i} style={{ fontSize:10, padding:"3px 9px", background:`${acc}12`, color:acc, borderRadius:20, border:`1px solid ${acc}30` }}>{s.name}</span>)}
              </div>
            </div>
          )}
          {safe(data.education).length>0 && (
            <div>
              <ColorHead color={acc}>Education</ColorHead>
              {safe(data.education).map((e,i)=>(
                <div key={i} style={{ marginBottom:7 }}>
                  <b style={{ fontSize:12 }}>{e.degree}{e.field?` in ${e.field}`:""}</b>
                  <div style={{ fontSize:11, color:"#666" }}>{e.institution}</div>
                  <div style={{ fontSize:10, color:"#999" }}>{e.startDate} – {e.endDate}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {safe(data.projects).length>0 && (
          <div style={{ marginTop:18 }}>
            <ColorHead color={acc}>Projects</ColorHead>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {safe(data.projects).map((p,i)=>(
                <div key={i} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:"10px 14px" }}>
                  <b style={{ fontSize:12 }}>{p.name}</b>
                  {p.description && <div style={{ fontSize:10, color:"#666", lineHeight:1.5, marginTop:2 }}>{p.description}</div>}
                  {safe(p.technologies).filter(Boolean).length>0 && <div style={{ fontSize:9.5, color:acc, marginTop:4 }}>{p.technologies.filter(Boolean).join(", ")}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {safe(data.certifications).length>0 && <><ColorHead color={acc}>Certifications</ColorHead><CertsBlock certifications={data.certifications} color="#1a1a1a" subColor="#666" dateColor="#999"/></>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 12. AGENCY — bold black header (already had experience, adding projects)
// ═══════════════════════════════════════════════════════════════════
function CreativeAgency({ data }) {
  const acc = "#f97316";
  return (
    <div style={{ background:"#fff", fontFamily:"'Helvetica Neue',sans-serif", minHeight:"11in" }}>
      <div style={{ background:"#111", color:"#fff", padding:"32px 40px 24px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, right:0, width:80, height:"100%", background:acc, opacity:0.85 }}/>
        <div style={{ position:"relative" }}>
          <h1 style={{ fontSize:28, fontWeight:900, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"-0.01em" }}>{str(data.fullName)}</h1>
          <Contacts data={data} color="#aaa" />
        </div>
      </div>
      <div style={{ padding:"20px 40px", display:"grid", gridTemplateColumns:"1fr 210px", gap:22 }}>
        <div>
          {data.summary && <p style={{ fontSize:11.5, lineHeight:1.8, color:"#444", margin:"0 0 16px", borderBottom:"1px solid #eee", paddingBottom:14 }}>{data.summary}</p>}
          {safe(data.experiences).length>0 && <><ColorHead color={acc}>Experience</ColorHead>{safe(data.experiences).map((e,i)=>(
            <div key={i} style={{ marginBottom:13 }}>
              <Row left={<><b style={{ fontSize:13 }}>{e.position}</b><div style={{ fontSize:11.5, color:acc }}>{e.company}</div></>}
                right={<span style={{ fontSize:10, color:"#999" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
              <Bullets items={e.description} color="#555" />
            </div>
          ))}</>}
          {/* ✅ PROJECTS */}
          {safe(data.projects).length>0 && <><ColorHead color={acc}>Projects</ColorHead><ProjectsBlock projects={data.projects} color="#111" accentColor={acc}/></>}
        </div>
        <div>
          {safe(data.skills).length>0 && (
            <div style={{ marginBottom:18 }}>
              <ColorHead color={acc}>Skills</ColorHead>
              {safe(data.skills).map((s,i)=>(
                <div key={i} style={{ fontSize:10.5, marginBottom:4, display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:3, height:3, background:acc, borderRadius:"50%", flexShrink:0 }}/>{s.name}
                </div>
              ))}
            </div>
          )}
          {safe(data.education).length>0 && (
            <div>
              <ColorHead color={acc}>Education</ColorHead>
              {safe(data.education).map((e,i)=>(
                <div key={i} style={{ marginBottom:9 }}>
                  <b style={{ fontSize:11.5 }}>{e.degree}</b>
                  <div style={{ fontSize:10, color:"#666" }}>{e.institution}</div>
                  <div style={{ fontSize:10, color:"#999" }}>{e.endDate}</div>
                </div>
              ))}
            </div>
          )}
          {safe(data.certifications).length>0 && (
            <div style={{ marginTop:14 }}>
              <ColorHead color={acc}>Certifications</ColorHead>
              <CertsBlock certifications={data.certifications} color="#111" subColor="#666" dateColor="#999"/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 13. STUDIO — pink sidebar (already had projects ✅)
// ═══════════════════════════════════════════════════════════════════
function CreativeTwocol({ data }) {
  const acc = "#ec4899";
  return (
    <div style={{ background:"#fff", fontFamily:"system-ui,sans-serif", display:"flex", minHeight:"11in" }}>
      <div style={{ width:195, background:"#fdf2f8", padding:"32px 16px", borderRight:`3px solid ${acc}`, flexShrink:0 }}>
        <div style={{ width:50, height:50, borderRadius:"50%", background:acc, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, marginBottom:12 }}>{(data.fullName||"?")[0]}</div>
        <h1 style={{ fontSize:14, fontWeight:700, color:"#831843", margin:"0 0 10px", lineHeight:1.3 }}>{str(data.fullName)}</h1>
        <div style={{ fontSize:9.5, color:"#9d174d", lineHeight:1.9, marginBottom:16 }}>
          {[data.email,data.phone,data.location].filter(Boolean).map((v,i)=><div key={i}>{v}</div>)}
        </div>
        <ColorHead color={acc}>Skills</ColorHead>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"3px" }}>
          {safe(data.skills).map((s,i)=><span key={i} style={{ display:"inline-block", fontSize:9.5, padding:"2px 7px", background:`${acc}20`, color:"#831843", borderRadius:10, marginBottom:3 }}>{s.name}</span>)}
        </div>
        {safe(data.education).length>0 && (
          <div style={{ marginTop:14 }}>
            <ColorHead color={acc}>Education</ColorHead>
            {safe(data.education).map((e,i)=>(
              <div key={i} style={{ marginBottom:8 }}>
                <b style={{ fontSize:10.5, color:"#831843" }}>{e.degree}</b>
                <div style={{ fontSize:9.5, color:"#9d174d" }}>{e.institution}</div>
                <div style={{ fontSize:9, color:"#be185d" }}>{e.endDate}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex:1, padding:"32px 24px" }}>
        {data.summary && <p style={{ fontSize:11, lineHeight:1.7, color:"#374151", margin:"0 0 16px", background:"#fdf2f8", padding:"9px 12px", borderRadius:5 }}>{data.summary}</p>}
        {safe(data.experiences).length>0 && <><ColorHead color={acc}>Experience</ColorHead>{safe(data.experiences).map((e,i)=>(
          <div key={i} style={{ marginBottom:13 }}>
            <Row left={<><b style={{ fontSize:13 }}>{e.position}</b><div style={{ fontSize:11, color:acc }}>{e.company}</div></>}
              right={<span style={{ fontSize:10, color:"#9ca3af" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
            <Bullets items={e.description} color="#374151" />
          </div>
        ))}</>}
        {safe(data.projects).length>0 && <><ColorHead color={acc}>Projects</ColorHead>{safe(data.projects).map((p,i)=>(
          <div key={i} style={{ marginBottom:9 }}>
            <b style={{ fontSize:12 }}>{p.name}</b>
            {p.description && <div style={{ fontSize:10.5, color:"#6b7280", lineHeight:1.6 }}>{p.description}</div>}
          </div>
        ))}</>}
        {safe(data.certifications).length>0 && <><ColorHead color={acc}>Certifications</ColorHead><CertsBlock certifications={data.certifications} color="#831843" subColor="#9d174d" dateColor="#be185d"/></>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 14. ACADEMIC CV
// ═══════════════════════════════════════════════════════════════════
function AcademicStandard({ data }) {
  return (
    <div style={{ background:"#fff", color:"#111", fontFamily:"Georgia,serif", padding:"44px 52px", minHeight:"11in" }}>
      <div style={{ textAlign:"center", marginBottom:16 }}>
        <h1 style={{ fontSize:20, fontWeight:700, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.12em" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#444" />
        <div style={{ height:2, background:"#111", margin:"10px auto 0", width:"60%" }} />
      </div>
      {data.summary && <><CenteredHead>Research Interests</CenteredHead><p style={{ fontSize:11, lineHeight:1.8, color:"#333", margin:"0 0 14px", textAlign:"justify" }}>{data.summary}</p><HDivider/></>}
      {safe(data.education).length>0 && <><CenteredHead>Education</CenteredHead><HDivider/>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <div>
            <b style={{ fontSize:12 }}>{e.degree}{e.field?`, ${e.field}`:""}</b>
            <div style={{ fontSize:11, fontStyle:"italic" }}>{e.institution}{e.location?`, ${e.location}`:""}</div>
            {e.gpa && <div style={{ fontSize:10.5, color:"#555" }}>GPA: {e.gpa}</div>}
          </div>
          <span style={{ fontSize:10.5, color:"#555", fontStyle:"italic" }}>{e.startDate} – {e.endDate}</span>
        </div>
      ))}</>}
      {safe(data.experiences).length>0 && <><HDivider/><CenteredHead>Experience</CenteredHead><HDivider/>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:12 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.position}</b><div style={{ fontSize:11, fontStyle:"italic", color:"#444" }}>{e.company}</div></>}
            right={<span style={{ fontSize:10.5, fontStyle:"italic", color:"#555" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#333" />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><HDivider/><CenteredHead>Projects & Publications</CenteredHead><HDivider/><ProjectsBlock projects={data.projects} color="#111" accentColor="#333"/></>}
      {safe(data.certifications).length>0 && <><HDivider/><CenteredHead>Certifications</CenteredHead><HDivider/><CertsBlock certifications={data.certifications} color="#111" subColor="#555" dateColor="#777"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 15. MEDICAL CLEAN
// ═══════════════════════════════════════════════════════════════════
function MedicalClean({ data }) {
  const acc = "#0891b2";
  return (
    <div style={{ background:"#fff", color:"#0c1b33", fontFamily:"Arial,sans-serif", padding:"40px 48px", minHeight:"11in" }}>
      <div style={{ borderBottom:`2px solid ${acc}`, paddingBottom:12, marginBottom:14 }}>
        <h1 style={{ fontSize:22, fontWeight:700, margin:"0 0 4px" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#555" />
      </div>
      {safe(data.education).length>0 && <><ColorHead color={acc}>Education & Training</ColorHead><div style={{ height:1, background:`${acc}40`, marginBottom:8 }}/>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:8 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.degree}{e.field?`, ${e.field}`:""}</b><div style={{ fontSize:11, color:"#555" }}>{e.institution}{e.location?`, ${e.location}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#777" }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {data.summary && <><ColorHead color={acc}>Professional Summary</ColorHead><div style={{ height:1, background:`${acc}40`, marginBottom:8 }}/><p style={{ fontSize:11, lineHeight:1.7, color:"#444", margin:"0 0 12px" }}>{data.summary}</p></>}
      {safe(data.experiences).length>0 && <><ColorHead color={acc}>Clinical Experience</ColorHead><div style={{ height:1, background:`${acc}40`, marginBottom:8 }}/>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:11 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.position}</b><div style={{ fontSize:11, color:acc }}>{e.company}{e.location?`, ${e.location}`:""}</div></>}
            right={<span style={{ fontSize:10.5, color:"#777" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#333" />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><ColorHead color={acc}>Research & Projects</ColorHead><div style={{ height:1, background:`${acc}40`, marginBottom:8 }}/><ProjectsBlock projects={data.projects} color="#0c1b33" accentColor={acc}/></>}
      {safe(data.certifications).length>0 && <><ColorHead color={acc}>Certifications</ColorHead><div style={{ height:1, background:`${acc}40`, marginBottom:8 }}/>{safe(data.certifications).map((c,i)=>(
        <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
          <div style={{ fontSize:11 }}><b>{c.name}</b> · {c.issuer}</div>
          <span style={{ fontSize:10.5, color:"#777" }}>{c.issueDate}</span>
        </div>
      ))}</>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 16. FEDERAL RESUME
// ═══════════════════════════════════════════════════════════════════
function GovtFederal({ data }) {
  return (
    <div style={{ background:"#fff", color:"#111", fontFamily:"Arial,sans-serif", padding:"36px 44px", minHeight:"11in" }}>
      <div style={{ background:"#1e3a5f", color:"#fff", padding:"13px 18px", marginBottom:14, borderRadius:2 }}>
        <h1 style={{ fontSize:18, fontWeight:700, margin:"0 0 4px" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#b3c5d9" />
      </div>
      {data.summary && <><FedHead>Professional Summary</FedHead><p style={{ fontSize:11, lineHeight:1.8, margin:"0 0 14px", color:"#222" }}>{data.summary}</p></>}
      {safe(data.experiences).length>0 && <><FedHead>Work Experience</FedHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:13 }}>
          <b style={{ fontSize:12 }}>{e.position}</b>
          <div style={{ fontSize:11, color:"#333" }}>{e.company}{e.location?` | ${e.location}`:""}</div>
          <div style={{ fontSize:10.5, color:"#666", marginBottom:4 }}>{e.startDate} – {e.current?"Present":e.endDate}</div>
          <Bullets items={e.description} color="#222" />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><FedHead>Projects & Initiatives</FedHead><ProjectsBlock projects={data.projects} color="#111" accentColor="#1e3a5f"/></>}
      {safe(data.education).length>0 && <><FedHead>Education</FedHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:8 }}>
          <b style={{ fontSize:12 }}>{e.degree}{e.field?`, ${e.field}`:""}</b>
          <div style={{ fontSize:11, color:"#333" }}>{e.institution}{e.location?` | ${e.location}`:""}</div>
          {e.gpa && <div style={{ fontSize:10.5, color:"#555" }}>GPA: {e.gpa}</div>}
          <div style={{ fontSize:10.5, color:"#666" }}>{e.startDate} – {e.endDate}</div>
        </div>
      ))}</>}
      {safe(data.certifications).length>0 && <><FedHead>Certifications</FedHead><CertsBlock certifications={data.certifications} color="#111" subColor="#333" dateColor="#666"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 17. TRADITIONAL SERIF
// ═══════════════════════════════════════════════════════════════════
function GovtTraditional({ data }) {
  return (
    <div style={{ background:"#fff", color:"#111", fontFamily:"'Times New Roman',serif", padding:"44px 52px", minHeight:"11in" }}>
      <div style={{ textAlign:"center", marginBottom:12 }}>
        <h1 style={{ fontSize:20, fontWeight:700, margin:"0 0 4px", letterSpacing:"0.06em" }}>{str(data.fullName).toUpperCase()}</h1>
        <Contacts data={data} color="#333" sep=" | " />
      </div>
      <div style={{ height:2, background:"#111", marginBottom:14 }} />
      {data.summary && <p style={{ fontSize:11, lineHeight:1.7, margin:"0 0 12px", textAlign:"justify" }}>{data.summary}</p>}
      {safe(data.experiences).length>0 && <><OldHead>Professional Experience</OldHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:11 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.position}, {e.company}</b>{e.location&&<div style={{ fontSize:10.5, fontStyle:"italic", color:"#555" }}>{e.location}</div>}</>}
            right={<span style={{ fontSize:10.5, fontStyle:"italic" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#222" />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><OldHead>Projects</OldHead><ProjectsBlock projects={data.projects} color="#111" accentColor="#444"/></>}
      {safe(data.education).length>0 && <><OldHead>Education</OldHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:6 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.degree}{e.field?` in ${e.field}`:""}</b><div style={{ fontSize:11, fontStyle:"italic" }}>{e.institution}{e.gpa?` — GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:10.5, fontStyle:"italic" }}>{e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.skills).length>0 && <><OldHead>Skills</OldHead><p style={{ fontSize:11, lineHeight:1.7, margin:0 }}>{safe(data.skills).map(s=>s.name).filter(Boolean).join(", ")}</p></>}
      {safe(data.certifications).length>0 && <><OldHead>Certifications</OldHead><CertsBlock certifications={data.certifications} color="#111" subColor="#444" dateColor="#666"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 18. ATS OPTIMIZED
// ═══════════════════════════════════════════════════════════════════
function GeneralATS({ data }) {
  return (
    <div style={{ background:"#fff", color:"#000", fontFamily:"Arial,Calibri,sans-serif", padding:"36px 44px", minHeight:"11in" }}>
      <h1 style={{ fontSize:20, fontWeight:700, margin:"0 0 3px", textAlign:"center" }}>{str(data.fullName)}</h1>
      <div style={{ textAlign:"center", marginBottom:10 }}><Contacts data={data} color="#333" sep=" | " /></div>
      <div style={{ height:1, background:"#000", marginBottom:10 }} />
      {data.summary && <><BoldHead>Summary</BoldHead><p style={{ fontSize:11, lineHeight:1.6, margin:"0 0 10px" }}>{data.summary}</p></>}
      {safe(data.experiences).length>0 && <><BoldHead>Work Experience</BoldHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:10 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.position}</b><b style={{ fontSize:11.5, display:"block" }}>{e.company}{e.location?`, ${e.location}`:""}</b></>}
            right={<span style={{ fontSize:11 }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><BoldHead>Projects</BoldHead><ProjectsBlock projects={data.projects} color="#000" accentColor="#333"/></>}
      {safe(data.skills).length>0 && <><BoldHead>Skills</BoldHead>{Object.entries(skills2groups(data.skills)).map(([c,s])=>(
        <div key={c} style={{ fontSize:11, marginBottom:3 }}><b>{c}:</b> {s.join(", ")}</div>
      ))}</>}
      {safe(data.education).length>0 && <><BoldHead>Education</BoldHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:6 }}>
          <Row left={<><b style={{ fontSize:12 }}>{e.degree}{e.field?` in ${e.field}`:""}</b><div style={{ fontSize:11 }}>{e.institution}{e.gpa?` | GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:11 }}>{e.startDate} – {e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.certifications).length>0 && <><BoldHead>Certifications</BoldHead><CertsBlock certifications={data.certifications} color="#000" subColor="#333" dateColor="#555"/></>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 19. BALANCED — navy header + left skill column (already had projects ✅)
// ═══════════════════════════════════════════════════════════════════
function GeneralBalanced({ data }) {
  const acc = "#0f4c81";
  const g = skills2groups(data.skills);
  return (
    <div style={{ background:"#fff", fontFamily:"Calibri,Arial,sans-serif", minHeight:"11in" }}>
      <div style={{ background:acc, color:"#fff", padding:"24px 36px 18px" }}>
        <h1 style={{ fontSize:24, fontWeight:700, margin:"0 0 5px" }}>{str(data.fullName)}</h1>
        <Contacts data={data} color="#a8c4e0" sep="  ·  " />
      </div>
      <div style={{ display:"flex" }}>
        <div style={{ width:205, background:"#f0f4f8", padding:"18px 16px", flexShrink:0 }}>
          {data.summary && <><div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", color:acc, letterSpacing:"0.1em", marginBottom:5 }}>Profile</div><p style={{ fontSize:10, lineHeight:1.7, color:"#444", margin:"0 0 14px" }}>{data.summary}</p></>}
          {Object.entries(g).map(([cat,sks])=>(
            <div key={cat} style={{ marginBottom:13 }}>
              <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", color:acc, letterSpacing:"0.1em", marginBottom:5 }}>{cat}</div>
              {sks.map((sk,i)=><div key={i} style={{ fontSize:10.5, color:"#333", marginBottom:3, paddingLeft:8, borderLeft:`2px solid ${acc}` }}>{sk}</div>)}
            </div>
          ))}
          {safe(data.education).length>0 && (
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", color:acc, letterSpacing:"0.1em", marginBottom:5 }}>Education</div>
              {safe(data.education).map((e,i)=>(
                <div key={i} style={{ marginBottom:9 }}>
                  <b style={{ fontSize:10.5 }}>{e.degree}</b>
                  <div style={{ fontSize:10, color:"#555" }}>{e.institution}</div>
                  <div style={{ fontSize:9.5, color:"#888" }}>{e.endDate}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex:1, padding:"18px 24px" }}>
          {safe(data.experiences).length>0 && <><LinedHead color={acc}>Experience</LinedHead>{safe(data.experiences).map((e,i)=>(
            <div key={i} style={{ marginBottom:12 }}>
              <Row left={<><b style={{ fontSize:12.5 }}>{e.position}</b><div style={{ fontSize:11, color:acc }}>{e.company}</div></>}
                right={<span style={{ fontSize:10, color:"#888" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
              <Bullets items={e.description} color="#444" />
            </div>
          ))}</>}
          {safe(data.projects).length>0 && <><LinedHead color={acc}>Projects</LinedHead>{safe(data.projects).map((p,i)=>(
            <div key={i} style={{ marginBottom:9 }}>
              <b style={{ fontSize:12 }}>{p.name}</b>
              {p.description && <div style={{ fontSize:10.5, color:"#555", lineHeight:1.6 }}>{p.description}</div>}
              {safe(p.technologies).filter(Boolean).length>0 && <div style={{ fontSize:10, color:"#888" }}>{p.technologies.filter(Boolean).join(", ")}</div>}
            </div>
          ))}</>}
          {safe(data.certifications).length>0 && <><LinedHead color={acc}>Certifications</LinedHead>{safe(data.certifications).map((c,i)=>(
            <div key={i} style={{ fontSize:11, marginBottom:4 }}><b>{c.name}</b> — {c.issuer} · {c.issueDate}</div>
          ))}</>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 20. EXECUTIVE — senior leadership serif
// ═══════════════════════════════════════════════════════════════════
function GeneralExecutive({ data }) {
  return (
    <div style={{ background:"#fff", color:"#1a1a1a", fontFamily:"Georgia,'Times New Roman',serif", padding:"44px 52px", minHeight:"11in" }}>
      <div style={{ borderTop:"4px solid #1a1a1a", borderBottom:"1px solid #ccc", padding:"14px 0", marginBottom:16 }}>
        <h1 style={{ fontSize:26, fontWeight:700, margin:"0 0 5px", letterSpacing:"0.04em" }}>{str(data.fullName).toUpperCase()}</h1>
        <Contacts data={data} color="#555" sep="  |  " />
      </div>
      {data.summary && <div style={{ marginBottom:16, padding:"11px 15px", background:"#f9f9f9", borderLeft:"3px solid #1a1a1a" }}><p style={{ fontSize:11.5, lineHeight:1.8, margin:0, color:"#333", fontStyle:"italic" }}>{data.summary}</p></div>}
      {safe(data.experiences).length>0 && <><ExecHead>Executive Experience</ExecHead>{safe(data.experiences).map((e,i)=>(
        <div key={i} style={{ marginBottom:15 }}>
          <Row left={<><b style={{ fontSize:13.5 }}>{e.position}</b><div style={{ fontSize:12, fontWeight:600, color:"#444", fontStyle:"italic" }}>{e.company}{e.location?` · ${e.location}`:""}</div></>}
            right={<span style={{ fontSize:11, color:"#666", fontStyle:"italic" }}>{e.startDate} – {e.current?"Present":e.endDate}</span>}/>
          <Bullets items={e.description} color="#333" />
        </div>
      ))}</>}
      {/* ✅ PROJECTS */}
      {safe(data.projects).length>0 && <><ExecHead>Key Projects</ExecHead><ProjectsBlock projects={data.projects} color="#1a1a1a" accentColor="#555"/></>}
      {safe(data.education).length>0 && <><ExecHead>Education</ExecHead>{safe(data.education).map((e,i)=>(
        <div key={i} style={{ marginBottom:8 }}>
          <Row left={<><b style={{ fontSize:13 }}>{e.degree}{e.field?` in ${e.field}`:""}</b><div style={{ fontSize:11.5, fontStyle:"italic", color:"#555" }}>{e.institution}{e.gpa?` — GPA: ${e.gpa}`:""}</div></>}
            right={<span style={{ fontSize:11, color:"#666", fontStyle:"italic" }}>{e.endDate}</span>}/>
        </div>
      ))}</>}
      {safe(data.skills).length>0 && <><ExecHead>Core Competencies</ExecHead><div style={{ display:"flex", flexWrap:"wrap", gap:"4px 20px" }}>{safe(data.skills).map((s,i)=><span key={i} style={{ fontSize:11, color:"#333" }}>· {s.name}</span>)}</div></>}
      {safe(data.certifications).length>0 && <><ExecHead>Certifications</ExecHead><CertsBlock certifications={data.certifications} color="#1a1a1a" subColor="#555" dateColor="#666"/></>}
    </div>
  );
}

// ─── Shared heading helpers ───────────────────────────────────────
function Row({ left, right }) {
  return <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}><div>{left}</div><div style={{ flexShrink:0, marginLeft:12 }}>{right}</div></div>;
}
function SecHead({ children }) {
  return <><h2 style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em", margin:"16px 0 5px", color:"#111" }}>{children}</h2><div style={{ height:1, background:"#e5e7eb", marginBottom:8 }}/></>;
}
function ColorHead({ children, color }) {
  return <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em", color, margin:"14px 0 7px" }}>{children}</div>;
}
function AppleHead({ children }) {
  return <h2 style={{ fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.12em", color:"#1d1d1f", margin:"16px 0 9px" }}>{children}</h2>;
}
function CenteredHead({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", textAlign:"center", margin:"14px 0 5px" }}>{children}</div>;
}
function HDivider() {
  return <div style={{ height:1, background:"#ccc", margin:"4px 0 10px" }}/>;
}
function LinedHead({ children, color }) {
  return <div style={{ display:"flex", alignItems:"center", gap:8, margin:"12px 0 8px" }}><span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", color, whiteSpace:"nowrap" }}>{children}</span><div style={{ flex:1, height:1, background:color }}/></div>;
}
function BoldHead({ children }) {
  return <div style={{ fontSize:10.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", borderBottom:"1.5px solid #000", paddingBottom:2, margin:"10px 0 7px" }}>{children}</div>;
}
function OldHead({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", borderBottom:"1px solid #888", paddingBottom:2, margin:"12px 0 7px" }}>{children}</div>;
}
function FedHead({ children }) {
  return <div style={{ fontSize:10.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#1e3a5f", borderBottom:"2px solid #1e3a5f", paddingBottom:2, margin:"12px 0 7px" }}>{children}</div>;
}
function ExecHead({ children }) {
  return <div style={{ fontSize:10.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em", borderBottom:"2px solid #1a1a1a", paddingBottom:2, margin:"14px 0 9px" }}>{children}</div>;
}

// ─── ROUTER ──────────────────────────────────────────────────────
const MAP = {
  "faang-clean":       FAANGClean,
  "faang-technical":   FAANGTechnical,
  "faang-modern":      FAANGModern,
  "faang-amazon":      FAANGAmazon,
  "finance-classic":   FinanceClassic,
  "finance-prestige":  FinancePrestige,
  "finance-banking":   FinanceBanking,
  "startup-bold":      StartupBold,
  "startup-modern":    StartupModern,
  "startup-sidebar":   StartupSidebar,
  "creative-designer": CreativeDesigner,
  "creative-agency":   CreativeAgency,
  "creative-twocol":   CreativeTwocol,
  "academic-standard": AcademicStandard,
  "medical-clean":     MedicalClean,
  "govt-federal":      GovtFederal,
  "govt-traditional":  GovtTraditional,
  "general-ats":       GeneralATS,
  "general-balanced":  GeneralBalanced,
  "general-executive": GeneralExecutive,
  // Legacy aliases
  "modern":            FAANGClean,
  "classic":           FinanceClassic,
  "modern-clean":      FAANGClean,
  "classic-midnight":  FinanceClassic,
};

export function ResumeTemplate({ data, template = "faang-clean" }) {
  if (!data) return null;
  const Component = MAP[template] || FAANGClean;
  return <Component data={data} />;
}

export function ModernTemplate({ data }) { return <FAANGClean data={data} />; }
export function ClassicTemplate({ data }) { return <FinanceClassic data={data} />; }