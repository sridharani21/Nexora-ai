// ==================================================================
// File: components/resume-template-picker.jsx
// Visual thumbnail template picker — replace the templates tab content
// ==================================================================
"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";

// ─── Template definitions with visual thumbnail data ──────────────
export const TEMPLATE_REGISTRY = [
  {
    id: "faang-clean",
    name: "Google Clean",
    category: "FAANG & Big Tech",
    desc: "Minimal single-column, ATS-perfect",
    thumb: "single-line",
  },
  {
    id: "faang-technical",
    name: "Meta Technical",
    category: "FAANG & Big Tech",
    desc: "Chip skillbar + blue accent",
    thumb: "chip-skills",
  },
  {
    id: "faang-modern",
    name: "Apple Modern",
    category: "FAANG & Big Tech",
    desc: "Ultra whitespace, large name",
    thumb: "big-name",
  },
  {
    id: "faang-amazon",
    name: "Amazon Impact",
    category: "FAANG & Big Tech",
    desc: "Orange accent bar, results-driven",
    thumb: "orange-bar",
  },
  {
    id: "finance-classic",
    name: "Wall Street",
    category: "Finance & Consulting",
    desc: "Traditional centered serif",
    thumb: "centered-serif",
  },
  {
    id: "finance-prestige",
    name: "McKinsey",
    category: "Finance & Consulting",
    desc: "Navy top bar, structured hierarchy",
    thumb: "navy-top",
  },
  {
    id: "finance-banking",
    name: "Investment Bank",
    category: "Finance & Consulting",
    desc: "Dense, compact, bold headers",
    thumb: "dense-bold",
  },
  {
    id: "startup-bold",
    name: "Startup Sidebar",
    category: "Startups & Tech",
    desc: "Indigo dark sidebar + main",
    thumb: "dark-sidebar",
  },
  {
    id: "startup-modern",
    name: "YC Modern",
    category: "Startups & Tech",
    desc: "Orange accent, pill skill tags",
    thumb: "pill-tags",
  },
  {
    id: "startup-sidebar",
    name: "Sidebar Pro",
    category: "Startups & Tech",
    desc: "Dark sidebar with dot skills",
    thumb: "dot-sidebar",
  },
  {
    id: "creative-designer",
    name: "Portfolio",
    category: "Creative & Design",
    desc: "Purple header block + project grid",
    thumb: "purple-header",
  },
  {
    id: "creative-agency",
    name: "Agency",
    category: "Creative & Design",
    desc: "Black header, orange accent panel",
    thumb: "black-header",
  },
  {
    id: "creative-twocol",
    name: "Studio",
    category: "Creative & Design",
    desc: "Pink sidebar two-tone",
    thumb: "pink-sidebar",
  },
  {
    id: "academic-standard",
    name: "Academic CV",
    category: "Healthcare & Academia",
    desc: "Centered serif, research-ready",
    thumb: "centered-serif",
  },
  {
    id: "medical-clean",
    name: "Medical",
    category: "Healthcare & Academia",
    desc: "Credentials-first, teal accent",
    thumb: "teal-accent",
  },
  {
    id: "govt-federal",
    name: "Federal",
    category: "Government & Non-profit",
    desc: "Navy header block, formal",
    thumb: "navy-block",
  },
  {
    id: "govt-traditional",
    name: "Traditional",
    category: "Government & Non-profit",
    desc: "Conservative full-caps serif",
    thumb: "caps-serif",
  },
  {
    id: "general-ats",
    name: "ATS Optimized",
    category: "General Purpose",
    desc: "Max machine readability",
    thumb: "ats-plain",
  },
  {
    id: "general-balanced",
    name: "Balanced",
    category: "General Purpose",
    desc: "Navy header + left skill panel",
    thumb: "left-panel",
  },
  {
    id: "general-executive",
    name: "Executive",
    category: "General Purpose",
    desc: "Senior leadership, italic summary",
    thumb: "exec-serif",
  },
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

// ─── SVG Thumbnail renderers ──────────────────────────────────────
function ThumbSingleLine() {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Name */}
      <rect x="16" y="16" width="80" height="7" rx="2" fill="#111"/>
      {/* Contact row */}
      <rect x="16" y="27" width="50" height="3" rx="1" fill="#aaa"/>
      {/* Divider */}
      <rect x="16" y="34" width="128" height="1.5" fill="#111"/>
      {/* Section */}
      <rect x="16" y="42" width="40" height="3" rx="1" fill="#333"/>
      <rect x="16" y="48" width="128" height="1" fill="#ddd"/>
      {/* Lines */}
      {[54,59,64,69].map(y=><rect key={y} x="16" y={y} width={y%2===0?118:96} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Section 2 */}
      <rect x="16" y="80" width="40" height="3" rx="1" fill="#333"/>
      <rect x="16" y="86" width="128" height="1" fill="#ddd"/>
      {[92,97,102,107,112,117].map(y=><rect key={y} x="16" y={y} width={y%3===0?118:y%3===1?100:88} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Section 3 */}
      <rect x="16" y="126" width="32" height="3" rx="1" fill="#333"/>
      <rect x="16" y="132" width="128" height="1" fill="#ddd"/>
      {[138,143,148].map(y=><rect key={y} x="16" y={y} width={y%2===0?100:80} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbChipSkills() {
  const acc = "#1a73e8";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      <rect x="16" y="14" width="70" height="7" rx="2" fill="#202124"/>
      <rect x="16" y="25" width="3" height="3" fill={acc}/>
      <rect x="22" y="25" width="50" height="3" rx="1" fill="#aaa"/>
      {/* Accent bar */}
      <rect x="16" y="32" width="50" height="2" rx="1" fill={acc}/>
      {/* Chip row */}
      <rect x="16" y="39" width="128" height="16" rx="3" fill="#f8f9fa"/>
      {[[18,43,28],[50,43,22],[76,43,30],[110,43,24]].map(([x,y,w],i)=>
        <rect key={i} x={x} y={y} width={w} height="8" rx="4" fill="#fff" stroke="#dadce0" strokeWidth="0.5"/>
      )}
      {/* Exp header */}
      <rect x="16" y="62" width="36" height="3" rx="1" fill={acc}/>
      {[70,75,80,85,90,95].map(y=><rect key={y} x="22" y={y} width={y%2===0?106:88} height="2.5" rx="1" fill="#ddd"/>)}
      {/* More lines */}
      <rect x="16" y="104" width="36" height="3" rx="1" fill={acc}/>
      {[112,117,122,127,132].map(y=><rect key={y} x="22" y={y} width={y%2===0?100:80} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbBigName() {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Large name */}
      <rect x="16" y="20" width="95" height="10" rx="2" fill="#1d1d1f"/>
      <rect x="16" y="34" width="60" height="3" rx="1" fill="#86868b"/>
      {/* Thin divider */}
      <rect x="16" y="43" width="128" height="0.8" fill="#d2d2d7"/>
      {/* Summary */}
      {[50,55,60].map(y=><rect key={y} x="16" y={y} width={y===60?80:118} height="2.5" rx="1" fill="#d2d2d7"/>)}
      {/* Exp header */}
      <rect x="16" y="74" width="40" height="3" rx="1" fill="#1d1d1f"/>
      {[80,85,90,95,100].map(y=><rect key={y} x="16" y={y} width={y%2===0?110:90} height="2" rx="1" fill="#e5e5ea"/>)}
      {/* Divider */}
      <rect x="16" y="104" width="128" height="0.8" fill="#f2f2f7"/>
      {/* Edu */}
      <rect x="16" y="110" width="34" height="3" rx="1" fill="#1d1d1f"/>
      {[116,121,126].map(y=><rect key={y} x="16" y={y} width={y===126?70:100} height="2" rx="1" fill="#e5e5ea"/>)}
      {/* Skills */}
      <rect x="16" y="136" width="28" height="3" rx="1" fill="#1d1d1f"/>
      {[142,147].map(y=><rect key={y} x="16" y={y} width={y===142?110:80} height="2" rx="1" fill="#e5e5ea"/>)}
    </svg>
  );
}

function ThumbOrangeBar() {
  const acc = "#ff9900";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Orange bottom border on header */}
      <rect x="16" y="14" width="75" height="7" rx="2" fill="#0f1111"/>
      <rect x="16" y="25" width="55" height="3" rx="1" fill="#888"/>
      <rect x="16" y="32" width="128" height="2.5" fill={acc}/>
      {/* Summary block */}
      <rect x="16" y="38" width="128" height="16" rx="2" fill="#fafafa"/>
      {[41,46,49].map(y=><rect key={y} x="20" y={y} width={y===49?80:118} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Exp */}
      <rect x="16" y="60" width="50" height="3" rx="1" fill={acc}/>
      {[66,71,76,81,86,91].map(y=><rect key={y} x="22" y={y} width={y%2===0?106:86} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Edu */}
      <rect x="16" y="100" width="36" height="3" rx="1" fill={acc}/>
      {[106,111,116].map(y=><rect key={y} x="22" y={y} width={y%2===0?100:80} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbCenteredSerif() {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Centered name */}
      <rect x="45" y="14" width="70" height="7" rx="1" fill="#1a1a1a"/>
      <rect x="30" y="24" width="100" height="3" rx="1" fill="#aaa"/>
      {/* Double rule */}
      <rect x="16" y="31" width="128" height="2" fill="#1a1a1a"/>
      <rect x="16" y="34" width="128" height="0.8" fill="#1a1a1a"/>
      {/* Centered section head */}
      <rect x="55" y="40" width="50" height="3" rx="1" fill="#444"/>
      <rect x="16" y="46" width="128" height="0.8" fill="#ccc"/>
      {[50,55,60,65].map(y=><rect key={y} x="16" y={y} width={y%2===0?120:100} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="55" y="72" width="50" height="3" rx="1" fill="#444"/>
      <rect x="16" y="78" width="128" height="0.8" fill="#ccc"/>
      {[82,87,92,97,102,107,112].map(y=><rect key={y} x="16" y={y} width={y%2===0?118:96} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="55" y="120" width="50" height="3" rx="1" fill="#444"/>
      <rect x="16" y="126" width="128" height="0.8" fill="#ccc"/>
      {[130,135,140].map(y=><rect key={y} x="16" y={y} width={y%2===0?110:90} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbNavyTop() {
  const acc = "#003366";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Navy top stripe */}
      <rect x="16" y="12" width="128" height="4" rx="1" fill={acc}/>
      <rect x="16" y="20" width="70" height="7" rx="1" fill="#1a1a2e"/>
      <rect x="16" y="31" width="55" height="3" rx="1" fill="#888"/>
      {/* Summary block */}
      <rect x="16" y="38" width="128" height="14" rx="2" fill="#f7f9fc"/>
      <rect x="20" y="42" width="3" height="8" rx="1" fill={acc}/>
      {[42,47].map(y=><rect key={y} x="26" y={y} width={y===42?110:90} height="2.5" rx="1" fill="#ccc"/>)}
      {/* Lined section head */}
      {[58, 88, 118].map((y, si) => (
        <g key={si}>
          <rect x="16" y={y} width={si===0?36:si===1?30:24} height="3" rx="1" fill={acc}/>
          <rect x={si===0?58:si===1?52:46} y={y+1} width={si===0?86:si===1?92:98} height="1" fill={acc}/>
          {[y+7,y+12,y+17,y+22].map((ly,li)=><rect key={li} x="22" y={ly} width={li%2===0?106:86} height="2.5" rx="1" fill="#ddd"/>)}
        </g>
      ))}
    </svg>
  );
}

function ThumbDenseBold() {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      <rect x="35" y="12" width="90" height="6" rx="1" fill="#0d0d0d"/>
      <rect x="25" y="21" width="110" height="3" rx="1" fill="#aaa"/>
      <rect x="16" y="28" width="128" height="1.5" fill="#0d0d0d"/>
      {/* Dense sections */}
      {[
        [34, 4, 40], [40, 3, 128], [44, 3, 118], [48, 3, 100], [52, 3, 110], [56, 3, 88],
        [63, 4, 40], [69, 3, 128], [73, 3, 108], [77, 3, 96], [81, 3, 118],
        [88, 4, 38], [94, 3, 118], [98, 3, 100], [102, 3, 88],
        [109, 4, 36], [115, 3, 120], [119, 3, 90],
      ].map(([y, h, w], i) => (
        <rect key={i} x="16" y={y} width={w} height={h} rx={h===4?1:0.8} fill={h===4?"#333":"#ccc"}/>
      ))}
    </svg>
  );
}

function ThumbDarkSidebar({ sideColor = "#1e1b4b", accentColor = "#6366f1" }) {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Sidebar */}
      <rect x="0" y="0" width="52" height="200" fill={sideColor}/>
      {/* Avatar circle */}
      <circle cx="26" cy="22" r="10" fill={accentColor}/>
      <rect x="8" y="36" width="36" height="4" rx="1" fill="#e0e7ff"/>
      {[44,50,56,62,68].map(y=><rect key={y} x="8" y={y} width={y%2===0?36:28} height="2.5" rx="1" fill="#a5b4fc" opacity="0.7"/>)}
      {/* Sidebar skill groups */}
      <rect x="8" y="80" width="20" height="2" rx="1" fill={accentColor}/>
      {[85,90,95,100,105].map(y=><rect key={y} x="8" y={y} width={y%2===0?32:26} height="2" rx="1" fill="#c7d2fe" opacity="0.6"/>)}
      <rect x="8" y="115" width="22" height="2" rx="1" fill={accentColor}/>
      {[120,125,130,135].map(y=><rect key={y} x="8" y={y} width="30" height="2" rx="1" fill="#c7d2fe" opacity="0.6"/>)}
      {/* Main content */}
      <rect x="60" y="14" width="22" height="3" rx="1" fill={accentColor}/>
      {[20,25,30,35].map(y=><rect key={y} x="60" y={y} width={y%2===0?88:70} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="60" y="44" width="28" height="3" rx="1" fill={accentColor}/>
      {[50,55,60,65,70,75,80].map(y=><rect key={y} x="60" y={y} width={y%2===0?86:68} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="60" y="89" width="22" height="3" rx="1" fill={accentColor}/>
      {[95,100,105,110].map(y=><rect key={y} x="60" y={y} width={y%2===0?82:66} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbPillTags() {
  const acc = "#e15c25";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Header with name left contact right */}
      <rect x="16" y="14" width="65" height="8" rx="1" fill="#1a1a1a"/>
      <rect x="96" y="17" width="48" height="3" rx="1" fill="#888"/>
      <rect x="16" y="26" width="128" height="2" fill={acc}/>
      {/* Exp section */}
      <rect x="16" y="32" width="28" height="3" rx="1" fill={acc}/>
      {[38,43,48,53,58].map(y=><rect key={y} x="16" y={y} width={y%2===0?116:96} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Skills header */}
      <rect x="16" y="68" width="24" height="3" rx="1" fill={acc}/>
      {/* Pill tags */}
      {[
        [16,74,28],[48,74,22],[74,74,32],[110,74,20],
        [16,84,20],[40,84,26],[70,84,22],[96,84,28],
      ].map(([x,y,w],i)=>
        <rect key={i} x={x} y={y} width={w} height="7" rx="3.5" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="0.5"/>
      )}
      {/* Edu */}
      <rect x="16" y="98" width="30" height="3" rx="1" fill={acc}/>
      {[104,109,114].map(y=><rect key={y} x="16" y={y} width={y%2===0?100:80} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbDotSidebar() {
  const acc = "#10b981";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      <rect x="0" y="0" width="50" height="200" fill="#111827"/>
      {/* Sidebar content */}
      <rect x="8" y="14" width="32" height="4" rx="1" fill="#fff"/>
      {[22,28,34,40].map(y=><rect key={y} x="8" y={y} width="34" height="2" rx="1" fill="#9ca3af"/>)}
      <rect x="8" y="52" width="18" height="2" rx="1" fill={acc}/>
      {[58,63,68,73,78,83].map(y=>(
        <g key={y}>
          <circle cx="11" cy={y+1} r="1.5" fill={acc}/>
          <rect x="16" y={y} width="26" height="2" rx="1" fill="#d1d5db" opacity="0.7"/>
        </g>
      ))}
      <rect x="8" y="96" width="20" height="2" rx="1" fill={acc}/>
      {[102,107,112].map(y=><rect key={y} x="8" y={y} width="34" height="2.5" rx="1" fill="#6b7280" opacity="0.6"/>)}
      {/* Main */}
      <rect x="58" y="14" width="90" height="3" rx="1" fill="#374151" opacity="0.5"/>
      <rect x="58" y="22" width="26" height="3" rx="1" fill={acc}/>
      {[28,33,38,43,48,53].map(y=><rect key={y} x="58" y={y} width={y%2===0?86:68} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="58" y="62" width="22" height="3" rx="1" fill={acc}/>
      {[68,73,78,83,88].map(y=><rect key={y} x="58" y={y} width={y%2===0?82:64} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbPurpleHeader() {
  const acc = "#8b5cf6";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fafafa"/>
      {/* Purple header block */}
      <rect x="0" y="0" width="160" height="52" fill={acc}/>
      <rect x="16" y="12" width="80" height="9" rx="1" fill="#fff"/>
      <rect x="16" y="25" width="100" height="3" rx="1" fill="#e0d4ff" opacity="0.8"/>
      <rect x="16" y="32" width="80" height="2.5" rx="1" fill="#e0d4ff" opacity="0.6"/>
      {/* Content */}
      <rect x="16" y="60" width="3" height="50" rx="1" fill={acc}/>
      {[62,68,74,80,86,92,98].map(y=><rect key={y} x="23" y={y} width={y%2===0?118:96} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Two-col grid */}
      <rect x="16" y="110" width="26" height="3" rx="1" fill={acc}/>
      {[[16,116,28],[16,122,22],[16,128,26],[16,134,20]].map(([x,y,w],i)=>
        <rect key={i} x={x} y={y} width={w} height="5" rx="2.5" fill={`${acc}30`} stroke={`${acc}50`} strokeWidth="0.5"/>
      )}
      <rect x="84" y="110" width="26" height="3" rx="1" fill={acc}/>
      {[[84,116,30],[84,122,24],[84,128,20]].map(([x,y,w],i)=>(
        <rect key={i} x={x} y={y} width={w} height="2.5" rx="1" fill="#ddd"/>
      ))}
    </svg>
  );
}

function ThumbBlackHeader() {
  const acc = "#f97316";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Black header */}
      <rect x="0" y="0" width="160" height="46" fill="#111"/>
      {/* Orange accent strip */}
      <rect x="140" y="0" width="20" height="46" fill={acc} opacity="0.85"/>
      <rect x="12" y="12" width="80" height="8" rx="1" fill="#fff"/>
      <rect x="12" y="24" width="70" height="3" rx="1" fill="#aaa"/>
      {/* Two-col layout */}
      <rect x="0" y="46" width="105" height="154" fill="#fff"/>
      <rect x="105" y="46" width="55" height="154" fill="#fff"/>
      <rect x="105" y="46" width="0.5" height="154" fill="#eee"/>
      {/* Left col */}
      <rect x="12" y="54" width="30" height="3" rx="1" fill={acc}/>
      {[60,65,70,75,80,85,90].map(y=><rect key={y} x="12" y={y} width={y%2===0?86:70} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="12" y="98" width="26" height="3" rx="1" fill={acc}/>
      {[104,109,114,119,124,129].map(y=><rect key={y} x="12" y={y} width={y%2===0?84:68} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Right col */}
      <rect x="110" y="54" width="25" height="3" rx="1" fill={acc}/>
      {[60,65,70,75,80,85,90,95,100,105,110].map(y=>(
        <g key={y}><circle cx="113" cy={y+1} r="1.5" fill={acc}/><rect x="118" y={y} width="36" height="2.5" rx="1" fill="#ddd"/></g>
      ))}
      <rect x="110" y="120" width="25" height="3" rx="1" fill={acc}/>
      {[126,132,138].map(y=><rect key={y} x="110" y={y} width="40" height="3" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbPinkSidebar() {
  const acc = "#ec4899";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      <rect x="0" y="0" width="55" height="200" fill="#fdf2f8"/>
      <rect x="0" y="0" width="3" height="200" fill={acc}/>
      {/* Avatar */}
      <circle cx="27" cy="20" r="10" fill={acc}/>
      <rect x="8" y="34" width="38" height="4" rx="1" fill="#831843"/>
      {[42,48,54,60,66].map(y=><rect key={y} x="8" y={y} width="38" height="2" rx="1" fill="#9d174d" opacity="0.6"/>)}
      {/* Skills chips */}
      {[[8,76,20],[30,76,16],[8,84,24],[34,84,14],[8,92,18],[28,92,20]].map(([x,y,w],i)=>
        <rect key={i} x={x} y={y} width={w} height="6" rx="3" fill={`${acc}20`} stroke={`${acc}40`} strokeWidth="0.5"/>
      )}
      {/* Edu */}
      <rect x="8" y="108" width="16" height="2" rx="1" fill={acc}/>
      {[113,118,123].map(y=><rect key={y} x="8" y={y} width="38" height="2" rx="1" fill="#be185d" opacity="0.5"/>)}
      {/* Main */}
      <rect x="62" y="14" width="86" height="16" rx="2" fill="#fdf2f8"/>
      {[17,22].map(y=><rect key={y} x="66" y={y} width={y===17?76:56} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="62" y="36" width="30" height="3" rx="1" fill={acc}/>
      {[42,47,52,57,62,67,72].map(y=><rect key={y} x="62" y={y} width={y%2===0?84:66} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="62" y="80" width="26" height="3" rx="1" fill={acc}/>
      {[86,91,96].map(y=><rect key={y} x="62" y={y} width={y%2===0?80:64} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbTealAccent() {
  const acc = "#0891b2";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      <rect x="16" y="14" width="70" height="7" rx="1" fill="#0c1b33"/>
      <rect x="16" y="25" width="55" height="3" rx="1" fill="#888"/>
      <rect x="16" y="31" width="128" height="2" fill={acc}/>
      {/* Edu section first */}
      <rect x="16" y="38" width="50" height="3" rx="1" fill={acc}/>
      <rect x="16" y="43" width="128" height="0.8" fill={`${acc}60`}/>
      {[46,51,56,61].map(y=><rect key={y} x="16" y={y} width={y%2===0?110:88} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Summary */}
      <rect x="16" y="70" width="60" height="3" rx="1" fill={acc}/>
      <rect x="16" y="75" width="128" height="0.8" fill={`${acc}60`}/>
      {[78,83,88].map(y=><rect key={y} x="16" y={y} width={y%2===0?116:94} height="2.5" rx="1" fill="#ddd"/>)}
      {/* Experience */}
      <rect x="16" y="98" width="55" height="3" rx="1" fill={acc}/>
      <rect x="16" y="103" width="128" height="0.8" fill={`${acc}60`}/>
      {[106,111,116,121,126,131,136].map(y=><rect key={y} x="16" y={y} width={y%2===0?110:88} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbNavyBlock() {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Navy header block */}
      <rect x="0" y="0" width="160" height="38" fill="#1e3a5f"/>
      <rect x="12" y="10" width="70" height="6" rx="1" fill="#fff"/>
      <rect x="12" y="20" width="90" height="3" rx="1" fill="#b3c5d9"/>
      {/* Federal sections */}
      {[44, 80, 120].map((sy, si) => (
        <g key={si}>
          <rect x="12" y={sy} width={si===0?56:si===1?40:34} height="3" rx="1" fill="#1e3a5f"/>
          <rect x="12" y={sy+5} width="136" height="1.5" fill="#1e3a5f"/>
          {[sy+10, sy+15, sy+20, sy+25, sy+30].map((y,li)=>(
            <rect key={li} x="12" y={y} width={li%2===0?128:108} height="2.5" rx="1" fill="#ddd"/>
          ))}
        </g>
      ))}
    </svg>
  );
}

function ThumbCapsSerif() {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      <rect x="30" y="12" width="100" height="7" rx="1" fill="#111"/>
      <rect x="25" y="22" width="110" height="3" rx="1" fill="#888"/>
      <rect x="12" y="29" width="136" height="2" fill="#111"/>
      {[40, 76, 112, 148].map((sy, si) => (
        <g key={si}>
          <rect x="12" y={sy-4} width={si===0?60:si===1?52:si===2?44:32} height="3" rx="1" fill="#333"/>
          <rect x="12" y={sy} width="136" height="0.8" fill="#888"/>
          {[sy+4,sy+9,sy+14,sy+19,sy+24,sy+29].filter(y=>y<195).map(y=>(
            <rect key={y} x="12" y={y} width={y%3===0?128:y%3===1?108:88} height="2.5" rx="1" fill="#ddd"/>
          ))}
        </g>
      ))}
    </svg>
  );
}

function ThumbATSPlain() {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      <rect x="35" y="12" width="90" height="7" rx="1" fill="#000"/>
      <rect x="20" y="22" width="120" height="3" rx="1" fill="#555"/>
      <rect x="12" y="28" width="136" height="1" fill="#000"/>
      {[36, 70, 104, 140].map((sy, si) => (
        <g key={si}>
          <rect x="12" y={sy} width={[36,28,24,22][si]} height="3.5" rx="0" fill="#000"/>
          <rect x="12" y={sy+5} width="136" height="1" fill="#000"/>
          {[sy+9, sy+14, sy+19, sy+24].map(y=>(
            <rect key={y} x="12" y={y} width={y%2===0?128:110} height="2.5" rx="0" fill="#bbb"/>
          ))}
        </g>
      ))}
    </svg>
  );
}

function ThumbLeftPanel() {
  const acc = "#0f4c81";
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Navy header */}
      <rect x="0" y="0" width="160" height="34" fill={acc}/>
      <rect x="12" y="8" width="70" height="7" rx="1" fill="#fff"/>
      <rect x="12" y="19" width="90" height="3" rx="1" fill="#a8c4e0"/>
      {/* Left panel */}
      <rect x="0" y="34" width="58" height="166" fill="#f0f4f8"/>
      {/* Panel content */}
      <rect x="8" y="40" width="14" height="2" rx="1" fill={acc}/>
      {[45,50,55,60,65,70].map(y=>(
        <g key={y}>
          <rect x="8" y={y} width="2" height={4} rx="1" fill={acc}/>
          <rect x="12" y={y} width="38" height="2.5" rx="1" fill={`${acc}50`}/>
        </g>
      ))}
      <rect x="8" y="82" width="20" height="2" rx="1" fill={acc}/>
      {[88,94,100,106,112].map(y=><rect key={y} x="8" y={y} width="42" height="2.5" rx="1" fill="#bbb"/>)}
      {/* Main */}
      <rect x="64" y="40" width="30" height="3" rx="1" fill={acc}/>
      <rect x="64" y="45" width="84" height="1" fill={acc}/>
      {[49,54,59,64,69,74,79].map(y=><rect key={y} x="64" y={y} width={y%2===0?82:66} height="2.5" rx="1" fill="#ddd"/>)}
      <rect x="64" y="88" width="26" height="3" rx="1" fill={acc}/>
      <rect x="64" y="93" width="84" height="1" fill={acc}/>
      {[97,102,107,112,117].map(y=><rect key={y} x="64" y={y} width={y%2===0?80:64} height="2.5" rx="1" fill="#ddd"/>)}
    </svg>
  );
}

function ThumbExecSerif() {
  return (
    <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="160" height="200" fill="#fff"/>
      {/* Top double rule */}
      <rect x="12" y="10" width="136" height="3" fill="#1a1a1a"/>
      <rect x="12" y="15" width="136" height="0.8" fill="#ccc"/>
      <rect x="12" y="20" width="85" height="8" rx="1" fill="#1a1a1a"/>
      <rect x="12" y="31" width="70" height="3" rx="1" fill="#888"/>
      {/* Summary block */}
      <rect x="12" y="38" width="136" height="18" rx="1" fill="#f9f9f9"/>
      <rect x="14" y="38" width="3" height="18" fill="#1a1a1a"/>
      {[42,47,52].map(y=><rect key={y} x="20" y={y} width={y===52?80:118} height="2.5" rx="1" fill="#ccc" opacity="0.8"/>)}
      {/* Exec sections */}
      {[62, 100, 138].map((sy, si) => (
        <g key={si}>
          <rect x="12" y={sy} width={[60,34,55][si]} height="3.5" rx="1" fill="#1a1a1a"/>
          <rect x="12" y={sy+5} width="136" height="1.5" fill="#1a1a1a"/>
          {[sy+10,sy+16,sy+22,sy+28].filter(y=>y<196).map(y=>(
            <rect key={y} x="12" y={y} width={y%2===0?128:106} height="2.5" rx="1" fill="#ddd"/>
          ))}
        </g>
      ))}
    </svg>
  );
}

// ─── Thumbnail router ─────────────────────────────────────────────
function TemplateThumbnail({ thumb }) {
  const map = {
    "single-line":    ThumbSingleLine,
    "chip-skills":    ThumbChipSkills,
    "big-name":       ThumbBigName,
    "orange-bar":     ThumbOrangeBar,
    "centered-serif": ThumbCenteredSerif,
    "navy-top":       ThumbNavyTop,
    "dense-bold":     ThumbDenseBold,
    "dark-sidebar":   ThumbDarkSidebar,
    "pill-tags":      ThumbPillTags,
    "dot-sidebar":    ThumbDotSidebar,
    "purple-header":  ThumbPurpleHeader,
    "black-header":   ThumbBlackHeader,
    "pink-sidebar":   ThumbPinkSidebar,
    "teal-accent":    ThumbTealAccent,
    "navy-block":     ThumbNavyBlock,
    "caps-serif":     ThumbCapsSerif,
    "ats-plain":      ThumbATSPlain,
    "left-panel":     ThumbLeftPanel,
    "exec-serif":     ThumbExecSerif,
  };
  const Comp = map[thumb] || ThumbSingleLine;
  return <Comp />;
}

// ─── Template Picker UI ───────────────────────────────────────────
export function TemplatePicker({ selectedTemplate, onSelect }) {
  const [category, setCategory] = useState("All");
  const [hovered, setHovered] = useState(null);

  const filtered = category === "All"
    ? TEMPLATE_REGISTRY
    : TEMPLATE_REGISTRY.filter(t => t.category === category);

  const L = "text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1.5 block";
  const C = "bg-[#080808] border border-[#181818] rounded-xl p-4";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-white font-semibold text-[14px]">Choose Template</h2>
        <p className="text-gray-700 text-[11px] mt-0.5">20 professional layouts · categorized by industry</p>
      </div>

      {/* Active template */}
      {selectedTemplate && (() => {
        const sel = TEMPLATE_REGISTRY.find(t => t.id === selectedTemplate);
        return sel ? (
          <div className={C}>
            <label className={L}>Active Template</label>
            <div className="flex items-center gap-3">
              <div className="w-12 h-16 rounded-md overflow-hidden border border-[#2a2a2a] flex-shrink-0 bg-white">
                <TemplateThumbnail thumb={sel.thumb} />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{sel.name}</p>
                <p className="text-gray-600 text-[11px]">{sel.category}</p>
                <p className="text-gray-700 text-[10px] mt-0.5">{sel.desc}</p>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
              ${category === cat
                ? "bg-blue-600 text-white"
                : "bg-[#080808] border border-[#181818] text-gray-600 hover:text-white hover:border-[#2a2a2a]"
              }`}>
            {cat === "All" ? `All (${TEMPLATE_REGISTRY.length})` : cat.split(" & ")[0]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(t => (
          <button key={t.id}
            onClick={() => onSelect(t.id)}
            onMouseEnter={() => setHovered(t.id)}
            onMouseLeave={() => setHovered(null)}
            className={`relative rounded-xl overflow-hidden border text-left transition-all group
              ${selectedTemplate === t.id
                ? "border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10"
                : "border-[#1a1a1a] hover:border-[#2a2a2a]"
              }`}>

            {/* Thumbnail */}
            <div className="relative overflow-hidden bg-white" style={{ aspectRatio: "0.77" }}>
              <TemplateThumbnail thumb={t.thumb} />

              {/* Hover overlay */}
              <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-200
                ${hovered === t.id ? "opacity-100" : "opacity-0"}`}>
                <div className="text-white text-[11px] font-bold px-3 py-2 bg-blue-600 rounded-lg">
                  {selectedTemplate === t.id ? "✓ Selected" : "Use Template"}
                </div>
              </div>

              {/* Selected badge */}
              {selectedTemplate === t.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="px-2.5 py-2 bg-[#080808]">
              <p className="text-white text-[11px] font-semibold truncate">{t.name}</p>
              <p className="text-gray-600 text-[9px] truncate">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}