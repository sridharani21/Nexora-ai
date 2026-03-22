// ==================================================================
// File: app/resume-builder/[id]/page.jsx
// FIXES:
//   1. Download button now prints ONLY the resume (not the whole page)
//   2. Live preview div gets id="resume-preview" for printResume() to target
//   3. Projects show in preview (handled in resume-template.jsx fix)
// ==================================================================
"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { ResumeTemplate, downloadResumeAsPDF } from "@/components/resume-template";
import { TemplatePicker, TEMPLATE_REGISTRY, TEMPLATE_CATEGORIES } from "@/components/resume-template-picker";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, Download, Sparkles, ArrowLeft, Check,
  LayoutGrid, Upload, Wand2, BarChart3, User, Briefcase,
  GraduationCap, Code2, Award, RefreshCw, Eye, X,
} from "lucide-react";

const SECTIONS = [
  { id:"personal",       label:"Personal",   icon:User },
  { id:"experience",     label:"Experience", icon:Briefcase },
  { id:"education",      label:"Education",  icon:GraduationCap },
  { id:"skills",         label:"Skills",     icon:Code2 },
  { id:"projects",       label:"Projects",   icon:LayoutGrid },
  { id:"certifications", label:"Certs",      icon:Award },
  { id:"templates",      label:"Templates",  icon:LayoutGrid },
  { id:"ats",            label:"ATS",        icon:BarChart3 },
];

function ScoreRing({ score, size = 90 }) {
  const r = 36, c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const col = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox="0 0 84 84">
      <circle cx="42" cy="42" r={r} fill="none" stroke="#1f2937" strokeWidth="7"/>
      <circle cx="42" cy="42" r={r} fill="none" stroke={col} strokeWidth="7"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform="rotate(-90 42 42)" style={{transition:"stroke-dashoffset 1s ease"}}/>
      <text x="42" y="42" textAnchor="middle" dominantBaseline="central"
        fill={col} fontSize="15" fontWeight="bold">{score}</text>
    </svg>
  );
}

export default function ResumeBuilderPage({ params }) {
  const { id: resumeId } = use(params);
  const router = useRouter();
  const fileRef = useRef(null);

  const [active, setActive]       = useState("personal");
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [unsaved, setUnsaved]     = useState(false);
  const [preview, setPreview]     = useState(false);
  const [ats, setAts]             = useState(null);
  const [jd, setJd]               = useState("");

  const [data, setData] = useState({
    title:"My Resume", template:"faang-clean",
    fullName:"", email:"", phone:"", location:"",
    linkedin:"", portfolio:"", github:"", summary:"",
    experiences:[], education:[], skills:[],
    projects:[], certifications:[],
  });

  useEffect(() => { if (resumeId && resumeId !== "new") load(resumeId); }, [resumeId]);
  useEffect(() => { if (resumeId && resumeId !== "new") setUnsaved(true); }, [data]);
  useEffect(() => {
    if (!unsaved || !resumeId || resumeId === "new") return;
    const t = setTimeout(() => save(true), 30000);
    return () => clearTimeout(t);
  }, [data, unsaved]);

  const load = async (id) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/resumes/${id}`);
      if (r.ok) {
        const { resume } = await r.json();
        setData(resume);
        if (resume.atsAnalysis) setAts(resume.atsAnalysis);
        setLastSaved(new Date(resume.updatedAt));
        setUnsaved(false);
      } else { toast.error("Resume not found"); router.push("/resume-builder"); }
    } catch { toast.error("Load failed"); }
    finally { setLoading(false); }
  };

  const save = async (silent = false) => {
    if (!data.fullName || !data.email || !data.phone) {
      if (!silent) toast.error("Name, Email and Phone required"); return;
    }
    setSaving(true);
    try {
      const isNew = !resumeId || resumeId === "new";
      const r = await fetch(isNew ? "/api/resumes" : `/api/resumes/${resumeId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        const { resume } = await r.json();
        if (!silent) toast.success("Saved!");
        setLastSaved(new Date()); setUnsaved(false);
        if (isNew) router.push(`/resume-builder/${resume.id}`);
      } else { const e = await r.json(); toast.error(e.error || "Save failed"); }
    } catch { toast.error("Save error"); }
    finally { setSaving(false); }
  };

  const analyze = async () => {
    if (!resumeId || resumeId === "new") { toast.error("Save first"); return; }
    setAnalyzing(true);
    try {
      const r = await fetch(`/api/resumes/${resumeId}/analyze`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ jobDescription: jd }),
      });
      if (r.ok) { const { analysis } = await r.json(); setAts(analysis); toast.success("Done!"); }
      else toast.error("Failed");
    } catch { toast.error("Error"); }
    finally { setAnalyzing(false); }
  };

  const genAI = async (field, ctx = {}) => {
    setGenerating(field);
    try {
      const r = await fetch("/api/ai/generate-content", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ field, resumeData: data, jobDescription: jd, ...ctx }),
      });
      if (r.ok) {
        const { content } = await r.json();
        if (field === "summary") setData(p => ({ ...p, summary: content }));
        else if (field.startsWith("exp-")) {
          const i = parseInt(field.split("-")[1]);
          const u = [...data.experiences];
          u[i] = { ...u[i], description: content.split("\n").filter(Boolean) };
          setData(p => ({ ...p, experiences: u }));
        }
        toast.success("Generated!");
      } else toast.error("Failed");
    } catch { toast.error("Error"); }
    finally { setGenerating(null); }
  };

  const applyFix = async (rec) => {
    const key = `fix-${rec.category}`;
    setGenerating(key);
    try {
      const r = await fetch("/api/ai/apply-ats-fix", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ recommendation: rec, resumeData: data, jobDescription: jd }),
      });
      if (r.ok) {
        const { updatedData } = await r.json();
        setData(p => ({ ...p, ...updatedData }));
        toast.success(`Fixed: ${rec.category}!`);
      } else toast.error("Fix failed");
    } catch { toast.error("Error"); }
    finally { setGenerating(null); }
  };

  const uploadResume = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("resume", file);
    if (jd) fd.append("jobDescription", jd);
    setUploading(true);
    try {
      const r = await fetch("/api/resumes/analyze-upload", { method:"POST", body: fd });
      if (r.ok) {
        const { analysis, extractedData } = await r.json();
        setAts(analysis);
        if (extractedData) setData(p => ({ ...p, ...extractedData }));
        toast.success("Uploaded & analyzed!"); setActive("ats");
      } else toast.error("Upload failed");
    } catch { toast.error("Error"); }
    finally { setUploading(false); }
  };

  // ── Download: render resume as real PDF file ───────────────────
  const handleDownload = async () => {
    const el = document.getElementById("resume-preview");
    if (!el) {
      toast.error("Resume preview not found — make sure you're in editor or preview mode.");
      return;
    }
    const toastId = toast.loading("Generating PDF… this may take a few seconds");
    try {
      const filename = `${(data.fullName || "resume").replace(/\s+/g, "_")}_resume.pdf`;
      await downloadResumeAsPDF("resume-preview", filename);
      toast.success("PDF downloaded!", { id: toastId });
    } catch (e) {
      console.error("PDF generation error:", e);
      toast.error(`PDF failed: ${e?.message || "unknown error"}`, { id: toastId });
    }
  };

  const upd      = (f, v) => setData(p => ({ ...p, [f]: v }));
  const addExp   = () => setData(p => ({ ...p, experiences:[...p.experiences, {company:"",position:"",location:"",startDate:"",endDate:"",current:false,description:[""]}] }));
  const updExp   = (i,f,v) => { const u=[...data.experiences]; u[i]={...u[i],[f]:v}; setData(p=>({...p,experiences:u})); };
  const delExp   = (i) => setData(p=>({...p,experiences:p.experiences.filter((_,x)=>x!==i)}));
  const addEdu   = () => setData(p => ({ ...p, education:[...p.education, {institution:"",degree:"",field:"",location:"",startDate:"",endDate:"",gpa:"",achievements:[]}] }));
  const updEdu   = (i,f,v) => { const u=[...data.education]; u[i]={...u[i],[f]:v}; setData(p=>({...p,education:u})); };
  const delEdu   = (i) => setData(p=>({...p,education:p.education.filter((_,x)=>x!==i)}));
  const addSkill = () => setData(p => ({ ...p, skills:[...p.skills, {category:"",name:"",level:""}] }));
  const updSkill = (i,f,v) => { const u=[...data.skills]; u[i]={...u[i],[f]:v}; setData(p=>({...p,skills:u})); };
  const delSkill = (i) => setData(p=>({...p,skills:p.skills.filter((_,x)=>x!==i)}));
  const addProj  = () => setData(p => ({ ...p, projects:[...p.projects, {name:"",description:"",technologies:[],link:"",github:"",highlights:[]}] }));
  const updProj  = (i,f,v) => { const u=[...data.projects]; u[i]={...u[i],[f]:v}; setData(p=>({...p,projects:u})); };
  const delProj  = (i) => setData(p=>({...p,projects:p.projects.filter((_,x)=>x!==i)}));
  const addCert  = () => setData(p => ({ ...p, certifications:[...p.certifications, {name:"",issuer:"",issueDate:"",expiryDate:"",credentialId:"",credentialUrl:""}] }));
  const updCert  = (i,f,v) => { const u=[...data.certifications]; u[i]={...u[i],[f]:v}; setData(p=>({...p,certifications:u})); };
  const delCert  = (i) => setData(p=>({...p,certifications:p.certifications.filter((_,x)=>x!==i)}));

  const selTpl = TEMPLATE_REGISTRY.find(t => t.id === data.template) || TEMPLATE_REGISTRY[0];

  const I = "w-full bg-[#0d0d0d] border border-[#252525] text-white placeholder:text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 h-9 rounded-lg text-sm px-3";
  const T = "w-full bg-[#0d0d0d] border border-[#252525] text-white placeholder:text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 rounded-lg text-sm px-3 py-2 resize-none";
  const L = "text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1.5 block";
  const C = "bg-[#080808] border border-[#181818] rounded-xl p-5";

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-9 h-9 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-gray-600 text-xs">Loading resume...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020202] pt-16 print:pt-0"
      style={{backgroundImage:"radial-gradient(#181818 1px,transparent 1px)",backgroundSize:"24px 24px"}}>

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className="print:hidden fixed top-16 inset-x-0 z-40 h-[52px] bg-black/96 backdrop-blur border-b border-[#181818] flex items-center px-4">
        <div className="max-w-[1600px] w-full mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/resume-builder")}
              className="flex items-center gap-1.5 text-gray-500 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0">
              <ArrowLeft className="w-3.5 h-3.5"/> Back to Dashboard
            </button>
            <div className="hidden sm:block w-px h-4 bg-[#252525]"/>
            <input value={data.title} onChange={e => upd("title", e.target.value)}
              className="bg-transparent border-none outline-none text-white text-sm font-medium w-36 placeholder:text-gray-700 min-w-0"/>
            <div className="text-[10px] flex-shrink-0">
              {saving   ? <span className="text-gray-600 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/>Saving</span>
              : unsaved ? <span className="text-amber-400/80">● Unsaved</span>
              : lastSaved ? <span className="text-emerald-400/80 flex items-center gap-1"><Check className="w-3 h-3"/>Saved</span>
              : null}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPreview(p=>!p)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Eye className="w-3.5 h-3.5"/><span className="hidden sm:inline">{preview?"Edit":"Preview"}</span>
            </button>
            {/* ✅ FIXED: Downloads only the resume, not the whole page */}
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5"/><span className="hidden sm:inline">PDF</span>
            </button>
            <button onClick={() => save(false)} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50">
              <Save className="w-3.5 h-3.5"/>Save
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="pt-[52px] print:pt-0">
        {preview ? (
          <div className="p-8 flex justify-center print:p-0">
            {/* ✅ id="resume-preview" — targeted by printResume() */}
            <div id="resume-preview" className="w-full max-w-[800px] shadow-2xl rounded-xl overflow-hidden ring-1 ring-white/5">
              <ResumeTemplate data={data} template={data.template}/>
            </div>
          </div>
        ) : (
          <div className="flex" style={{height:"calc(100vh - 7.5rem)"}}>

            {/* Sidebar nav */}
            <nav className="hidden lg:flex flex-col w-[56px] border-r border-[#181818] bg-black py-3 gap-px items-center flex-shrink-0">
              {SECTIONS.map(({id,label,icon:Icon}) => (
                <button key={id} onClick={()=>setActive(id)} title={label}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative group
                    ${active===id?"bg-blue-600 text-white shadow-lg shadow-blue-600/20":"text-[#444] hover:text-white hover:bg-white/5"}`}>
                  <Icon className="w-4 h-4"/>
                  <span className="absolute left-11 bg-[#111] border border-[#222] text-white text-[10px] px-2 py-1
                    rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl">{label}</span>
                </button>
              ))}
            </nav>

            {/* Mobile tabs */}
            <div className="lg:hidden absolute top-[104px] inset-x-0 flex gap-1 px-4 overflow-x-auto z-20 pb-1">
              {SECTIONS.map(({id,label,icon:Icon}) => (
                <button key={id} onClick={()=>setActive(id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] whitespace-nowrap flex-shrink-0 transition-colors
                    ${active===id?"bg-blue-600 text-white":"bg-[#0a0a0a] border border-[#1a1a1a] text-gray-600"}`}>
                  <Icon className="w-3 h-3"/>{label}
                </button>
              ))}
            </div>

            {/* ── Editor Panel ──────────────────────────────────── */}
            <div className="w-full lg:w-[460px] flex-shrink-0 overflow-y-auto px-5 py-5 mt-9 lg:mt-0 space-y-4"
              style={{scrollbarWidth:"thin",scrollbarColor:"#222 transparent"}}>

              {/* PERSONAL */}
              {active==="personal" && (
                <div className="space-y-4">
                  <H title="Personal Information" sub="Your contact details & summary"/>
                  <div className={C}>
                    <div className="space-y-3.5">
                      <F l="Full Name *" L={L}><input className={I} value={data.fullName} onChange={e=>upd("fullName",e.target.value)} placeholder="John Doe"/></F>
                      <div className="grid grid-cols-2 gap-3">
                        <F l="Email *" L={L}><input className={I} type="email" value={data.email} onChange={e=>upd("email",e.target.value)} placeholder="john@email.com"/></F>
                        <F l="Phone *" L={L}><input className={I} value={data.phone} onChange={e=>upd("phone",e.target.value)} placeholder="+1 234 567 8900"/></F>
                      </div>
                      <F l="Location" L={L}><input className={I} value={data.location} onChange={e=>upd("location",e.target.value)} placeholder="New York, NY"/></F>
                      <div className="grid grid-cols-3 gap-2">
                        {["linkedin","portfolio","github"].map(f=>(
                          <F key={f} l={f[0].toUpperCase()+f.slice(1)} L={L}>
                            <input className={I} value={data[f]} onChange={e=>upd(f,e.target.value)}
                              placeholder={f==="linkedin"?"linkedin.com/in/...":f==="portfolio"?"portfolio.dev":"github.com/..."}/>
                          </F>
                        ))}
                      </div>
                      <F l="Professional Summary" L={L}>
                        <div className="relative">
                          <textarea className={`${T} pr-10`} rows={4} value={data.summary}
                            onChange={e=>upd("summary",e.target.value)} placeholder="Write a compelling summary..."/>
                          <button onClick={()=>genAI("summary")} disabled={generating==="summary"}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 transition-colors" title="Generate with AI">
                            {generating==="summary"?<RefreshCw className="w-3.5 h-3.5 animate-spin"/>:<Wand2 className="w-3.5 h-3.5"/>}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-700 mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-blue-500"/>Click wand icon for AI-generated summary
                        </p>
                      </F>
                    </div>
                  </div>
                  <Sv saving={saving} onClick={()=>save(false)}/>
                </div>
              )}

              {/* EXPERIENCE */}
              {active==="experience" && (
                <div className="space-y-4">
                  <H title="Work Experience" sub="Your professional history" action={<Ab onClick={addExp} l="Add"/>}/>
                  {data.experiences.length===0&&<Em icon={Briefcase} label="No experience added yet"/>}
                  {data.experiences.map((exp,i)=>(
                    <div key={i} className={`${C} space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.15em]">Experience {i+1}</span>
                        <button onClick={()=>delExp(i)} className="p-1 text-[#333] hover:text-red-500 transition-colors rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <F l="Position" L={L}><input className={I} value={exp.position} onChange={e=>updExp(i,"position",e.target.value)} placeholder="Software Engineer"/></F>
                        <F l="Company" L={L}><input className={I} value={exp.company} onChange={e=>updExp(i,"company",e.target.value)} placeholder="Company Name"/></F>
                      </div>
                      <F l="Location" L={L}><input className={I} value={exp.location} onChange={e=>updExp(i,"location",e.target.value)} placeholder="San Francisco, CA"/></F>
                      <div className="grid grid-cols-3 gap-2">
                        <F l="Start" L={L}><input className={I} value={exp.startDate} onChange={e=>updExp(i,"startDate",e.target.value)} placeholder="Jan 2022"/></F>
                        <F l="End" L={L}><input className={I} value={exp.endDate} onChange={e=>updExp(i,"endDate",e.target.value)} placeholder="Dec 2023" disabled={exp.current}/></F>
                        <F l="Current" L={L}>
                          <div className="h-9 flex items-center">
                            <div onClick={()=>updExp(i,"current",!exp.current)}
                              className={`w-8 h-[18px] rounded-full cursor-pointer relative transition-colors ${exp.current?"bg-blue-600":"bg-[#222]"}`}>
                              <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${exp.current?"translate-x-[18px]":"translate-x-[2px]"}`}/>
                            </div>
                          </div>
                        </F>
                      </div>
                      <F l="Description (one bullet per line)" L={L}>
                        <div className="relative">
                          <textarea className={`${T} pr-10`} rows={4}
                            value={Array.isArray(exp.description)?exp.description.join("\n"):exp.description}
                            onChange={e=>updExp(i,"description",e.target.value.split("\n"))}
                            placeholder={"• Built responsive features\n• Improved performance by 40%"}/>
                          <button onClick={()=>genAI(`exp-${i}`,{position:exp.position,company:exp.company})}
                            disabled={generating===`exp-${i}`}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 transition-colors" title="Generate with AI">
                            {generating===`exp-${i}`?<RefreshCw className="w-3.5 h-3.5 animate-spin"/>:<Wand2 className="w-3.5 h-3.5"/>}
                          </button>
                        </div>
                      </F>
                    </div>
                  ))}
                  {data.experiences.length>0&&<Sv saving={saving} onClick={()=>save(false)}/>}
                </div>
              )}

              {/* EDUCATION */}
              {active==="education" && (
                <div className="space-y-4">
                  <H title="Education" sub="Degrees & qualifications" action={<Ab onClick={addEdu} l="Add"/>}/>
                  {data.education.length===0&&<Em icon={GraduationCap} label="No education added yet"/>}
                  {data.education.map((edu,i)=>(
                    <div key={i} className={`${C} space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-purple-400 uppercase tracking-[0.15em]">Education {i+1}</span>
                        <button onClick={()=>delEdu(i)} className="p-1 text-[#333] hover:text-red-500 transition-colors rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <F l="Institution" L={L}><input className={I} value={edu.institution} onChange={e=>updEdu(i,"institution",e.target.value)} placeholder="MIT"/></F>
                        <F l="Degree" L={L}><input className={I} value={edu.degree} onChange={e=>updEdu(i,"degree",e.target.value)} placeholder="B.Sc"/></F>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <F l="Field of Study" L={L}><input className={I} value={edu.field} onChange={e=>updEdu(i,"field",e.target.value)} placeholder="Computer Science"/></F>
                        <F l="GPA" L={L}><input className={I} value={edu.gpa} onChange={e=>updEdu(i,"gpa",e.target.value)} placeholder="3.9/4.0"/></F>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <F l="Start" L={L}><input className={I} value={edu.startDate} onChange={e=>updEdu(i,"startDate",e.target.value)} placeholder="2018"/></F>
                        <F l="End" L={L}><input className={I} value={edu.endDate} onChange={e=>updEdu(i,"endDate",e.target.value)} placeholder="2022"/></F>
                      </div>
                    </div>
                  ))}
                  {data.education.length>0&&<Sv saving={saving} onClick={()=>save(false)}/>}
                </div>
              )}

              {/* SKILLS */}
              {active==="skills" && (
                <div className="space-y-4">
                  <H title="Skills" sub="Technical & soft skills" action={<Ab onClick={addSkill} l="Add Skill"/>}/>
                  {data.skills.length===0&&<Em icon={Code2} label="No skills added yet"/>}
                  <div className="space-y-2">
                    {data.skills.map((sk,i)=>(
                      <div key={i} className="flex gap-2 items-center bg-[#080808] border border-[#181818] rounded-xl px-3 py-2">
                        <input className="flex-1 bg-transparent border-none text-white text-sm placeholder:text-gray-700 outline-none"
                          value={sk.category} onChange={e=>updSkill(i,"category",e.target.value)} placeholder="Category"/>
                        <div className="w-px h-4 bg-[#252525]"/>
                        <input className="flex-1 bg-transparent border-none text-white text-sm placeholder:text-gray-700 outline-none"
                          value={sk.name} onChange={e=>updSkill(i,"name",e.target.value)} placeholder="Skill name(s)"/>
                        <button onClick={()=>delSkill(i)} className="p-1 text-[#333] hover:text-red-500 transition-colors flex-shrink-0"><X className="w-3.5 h-3.5"/></button>
                      </div>
                    ))}
                  </div>
                  {data.skills.length>0&&<Sv saving={saving} onClick={()=>save(false)}/>}
                </div>
              )}

              {/* PROJECTS */}
              {active==="projects" && (
                <div className="space-y-4">
                  <H title="Projects" sub="Showcase your best work" action={<Ab onClick={addProj} l="Add"/>}/>
                  {data.projects.length===0&&<Em icon={LayoutGrid} label="No projects added yet"/>}
                  {data.projects.map((p,i)=>(
                    <div key={i} className={`${C} space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.15em]">Project {i+1}</span>
                        <button onClick={()=>delProj(i)} className="p-1 text-[#333] hover:text-red-500 transition-colors rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                      <F l="Project Name" L={L}><input className={I} value={p.name} onChange={e=>updProj(i,"name",e.target.value)} placeholder="My Awesome Project"/></F>
                      <F l="Description" L={L}><textarea className={T} rows={2} value={p.description} onChange={e=>updProj(i,"description",e.target.value)} placeholder="What does it do?"/></F>
                      <F l="Tech Stack (comma-separated)" L={L}>
                        <input className={I} value={Array.isArray(p.technologies)?p.technologies.join(", "):p.technologies}
                          onChange={e=>updProj(i,"technologies",e.target.value.split(",").map(s=>s.trim()))} placeholder="React, Node.js, Postgres"/>
                      </F>
                      <div className="grid grid-cols-2 gap-3">
                        <F l="Live URL" L={L}><input className={I} value={p.link} onChange={e=>updProj(i,"link",e.target.value)} placeholder="https://..."/></F>
                        <F l="GitHub" L={L}><input className={I} value={p.github} onChange={e=>updProj(i,"github",e.target.value)} placeholder="github.com/..."/></F>
                      </div>
                    </div>
                  ))}
                  {data.projects.length>0&&<Sv saving={saving} onClick={()=>save(false)}/>}
                </div>
              )}

              {/* CERTIFICATIONS */}
              {active==="certifications" && (
                <div className="space-y-4">
                  <H title="Certifications" sub="Licenses & achievements" action={<Ab onClick={addCert} l="Add"/>}/>
                  {data.certifications.length===0&&<Em icon={Award} label="No certifications added yet"/>}
                  {data.certifications.map((c,i)=>(
                    <div key={i} className={`${C} space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.15em]">Certification {i+1}</span>
                        <button onClick={()=>delCert(i)} className="p-1 text-[#333] hover:text-red-500 transition-colors rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                      <F l="Name" L={L}><input className={I} value={c.name} onChange={e=>updCert(i,"name",e.target.value)} placeholder="AWS Solutions Architect"/></F>
                      <div className="grid grid-cols-2 gap-3">
                        <F l="Issuing Org" L={L}><input className={I} value={c.issuer} onChange={e=>updCert(i,"issuer",e.target.value)} placeholder="Amazon Web Services"/></F>
                        <F l="Issue Date" L={L}><input className={I} value={c.issueDate} onChange={e=>updCert(i,"issueDate",e.target.value)} placeholder="Jan 2024"/></F>
                      </div>
                    </div>
                  ))}
                  {data.certifications.length>0&&<Sv saving={saving} onClick={()=>save(false)}/>}
                </div>
              )}

              {/* TEMPLATES */}
              {active==="templates" && (
                <TemplatePicker
                  selectedTemplate={data.template}
                  onSelect={(id) => setData(p => ({ ...p, template: id }))}
                />
              )}

              {/* ATS */}
              {active==="ats" && (
                <div className="space-y-4">
                  <H title="ATS Score" sub="Optimize for applicant tracking systems"/>

                  <div className={C}>
                    <p className={L}>Upload Existing Resume</p>
                    <p className="text-[11px] text-gray-700 mb-3">Upload PDF/DOCX — analyzes score and extracts your data</p>
                    <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
                      onChange={e=>uploadResume(e.target.files?.[0])}/>
                    <button onClick={()=>fileRef.current?.click()} disabled={uploading}
                      className="w-full border-2 border-dashed border-[#1e1e1e] hover:border-blue-500/30 rounded-xl p-6
                        flex flex-col items-center gap-2 transition-colors group">
                      {uploading
                        ? <RefreshCw className="w-5 h-5 text-blue-400 animate-spin"/>
                        : <Upload className="w-5 h-5 text-[#333] group-hover:text-blue-400 transition-colors"/>}
                      <span className="text-sm text-gray-600 group-hover:text-gray-400 transition-colors">
                        {uploading?"Analyzing...":"Drop PDF or DOCX here"}
                      </span>
                      <span className="text-[10px] text-[#333]">ATS analysis + data extraction</span>
                    </button>
                  </div>

                  <div className={C}>
                    <F l="Job Description (Optional)" L={L}>
                      <textarea className={T} rows={4} value={jd} onChange={e=>setJd(e.target.value)}
                        placeholder="Paste job description for targeted scoring..."/>
                    </F>
                    <button onClick={analyze} disabled={analyzing}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl
                        bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                      {analyzing
                        ? <><RefreshCw className="w-4 h-4 animate-spin"/>Analyzing...</>
                        : <><Sparkles className="w-4 h-4"/>Analyze Resume</>}
                    </button>
                  </div>

                  {ats && (
                    <div className="space-y-4">
                      <div className={C}>
                        <p className={L}>Score Breakdown</p>
                        <div className="flex items-center gap-4">
                          <ScoreRing score={ats.overallScore}/>
                          <div className="flex-1 space-y-2 min-w-0">
                            {ats.scores && Object.entries(ats.scores).map(([k,v])=>(
                              <div key={k} className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-600 w-[64px] capitalize flex-shrink-0">{k}</span>
                                <div className="flex-1 h-1 bg-[#111] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{
                                    width:`${v}%`,
                                    background:v>=80?"#22c55e":v>=60?"#eab308":v>=40?"#f97316":"#ef4444",
                                    transition:"width 0.8s ease"
                                  }}/>
                                </div>
                                <span className="text-[10px] text-gray-600 w-5 text-right">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className={C}>
                          <p className={`${L} text-emerald-600`}>Strengths</p>
                          <ul className="space-y-1.5">
                            {ats.strengths?.slice(0,4).map((s,i)=>(
                              <li key={i} className="text-[11px] text-gray-500 flex items-start gap-1">
                                <span className="text-emerald-500 mt-px flex-shrink-0">✓</span>{s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className={C}>
                          <p className={`${L} text-red-600`}>Weaknesses</p>
                          <ul className="space-y-1.5">
                            {ats.weaknesses?.slice(0,4).map((w,i)=>(
                              <li key={i} className="text-[11px] text-gray-500 flex items-start gap-1">
                                <span className="text-red-500 mt-px flex-shrink-0">✗</span>{w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {ats.keywordAnalysis && (
                        <div className={C}>
                          <p className={L}>Keyword Analysis</p>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] text-emerald-500 mb-2">Found Keywords</p>
                              <div className="flex flex-wrap gap-1">
                                {ats.keywordAnalysis.found?.map(k=>(
                                  <span key={k} className="text-[10px] px-2 py-0.5 bg-emerald-500/8 text-emerald-400 border border-emerald-500/15 rounded-full">{k}</span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-red-500 mb-2">Missing Keywords</p>
                              <div className="flex flex-wrap gap-1">
                                {ats.keywordAnalysis.missing?.map(k=>(
                                  <span key={k} className="text-[10px] px-2 py-0.5 bg-red-500/8 text-red-400 border border-red-500/15 rounded-full">{k}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {ats.recommendations && (
                        <div className={C}>
                          <p className={L}>AI Recommendations</p>
                          <div className="space-y-2.5">
                            {ats.recommendations.map((rec,i)=>{
                              const key=`fix-${rec.category}`;
                              return (
                                <div key={i} className={`p-3 rounded-xl border
                                  ${rec.priority==="high"?"border-red-500/15 bg-red-500/[0.03]":
                                    rec.priority==="medium"?"border-amber-500/15 bg-amber-500/[0.03]":
                                    "border-blue-500/15 bg-blue-500/[0.03]"}`}>
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded
                                          ${rec.priority==="high"?"bg-red-500/15 text-red-400":
                                            rec.priority==="medium"?"bg-amber-500/15 text-amber-400":
                                            "bg-blue-500/15 text-blue-400"}`}>{rec.priority}</span>
                                        <span className="text-[10px] text-gray-600">{rec.category}</span>
                                      </div>
                                      <p className="text-[11px] text-gray-400 leading-relaxed mb-1">{rec.issue}</p>
                                      <p className="text-[10px] text-gray-600 leading-relaxed">{rec.suggestion}</p>
                                    </div>
                                    <button onClick={()=>applyFix(rec)} disabled={generating===key}
                                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg
                                        bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-bold transition-colors">
                                      {generating===key?<RefreshCw className="w-3 h-3 animate-spin"/>:<Wand2 className="w-3 h-3"/>}
                                      Fix
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Live Preview ──────────────────────────────────── */}
            <div className="hidden lg:flex flex-1 flex-col border-l border-[#151515] bg-[#030303] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#151515] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                  <span className="text-[10px] text-gray-700">Live Preview</span>
                </div>
                <span className="text-[10px] text-gray-700">{selTpl.name} · {selTpl.category}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-8" style={{scrollbarWidth:"thin",scrollbarColor:"#181818 transparent"}}>
                {/* ✅ id="resume-preview" on the live preview too — download works from editor mode */}
                <div id="resume-preview" className="max-w-[680px] mx-auto shadow-[0_0_80px_-10px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden ring-1 ring-white/5">
                  <ResumeTemplate data={data} template={data.template}/>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// ─── Micro helpers ────────────────────────────────────────────────
function H({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-white font-semibold text-[14px]">{title}</h2>
        {sub && <p className="text-gray-700 text-[11px] mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function F({ l, L, children }) {
  return <div><label className={L}>{l}</label>{children}</div>;
}
function Ab({ onClick, l }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#080808] border border-[#1e1e1e]
        hover:border-blue-500/30 text-gray-600 hover:text-blue-400 text-[11px] font-medium transition-all">
      <Plus className="w-3 h-3"/>{l}
    </button>
  );
}
function Sv({ onClick, saving }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
        bg-[#080808] border border-[#1a1a1a] hover:border-[#2a2a2a] text-gray-500 hover:text-white
        text-sm transition-all disabled:opacity-40">
      {saving?<RefreshCw className="w-3.5 h-3.5 animate-spin"/>:<Save className="w-3.5 h-3.5"/>}
      {saving?"Saving...":"Save Changes"}
    </button>
  );
}
function Em({ icon:Icon, label }) {
  return (
    <div className="bg-[#050505] border border-dashed border-[#181818] rounded-xl p-10 flex flex-col items-center gap-2">
      <Icon className="w-7 h-7 text-[#1e1e1e]"/>
      <p className="text-gray-700 text-[12px]">{label}</p>
    </div>
  );
}