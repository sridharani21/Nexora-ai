"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Save } from "lucide-react";
import { saveProfile } from "@/actions/prep-profile";

const emptyProfile = { fullName: "", email: "", education: "", skills: "", languages: "", projects: "", certifications: "", interests: "", preferredRole: "", targetCompany: "", location: "" };

export default function ProfileForm({ initialProfile, defaultEmail, defaultName }) {
  const [profile, setProfile] = useState(initialProfile ? { ...initialProfile, education: initialProfile.education || "", skills: initialProfile.skills || "", languages: initialProfile.languages || "", projects: initialProfile.projects || "", certifications: initialProfile.certifications || "", interests: initialProfile.interests || "", preferredRole: initialProfile.preferredRole || "", targetCompany: initialProfile.targetCompany || "", location: initialProfile.location || "" } : { ...emptyProfile, email: defaultEmail || "", fullName: defaultName || "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await saveProfile(profile);
      setMessage("Profile saved in the placement database and linked to your login email.");
      window.location.href = "/placement-prep/dashboard";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };
  return <main className="container"><section className="form-card card"><div className="eyebrow">Student profile</div><h1 style={{ fontSize: 40 }}>{initialProfile ? "Update your placement profile." : "Create your placement profile."}</h1><p className="helper">{initialProfile ? "Your existing profile is linked to your login email. Update your details below; you do not need to fill this form again." : "Your profile is saved in the placement database and linked to your login email."}</p><form onSubmit={submit}><div className="form-grid">
    <Field label="Full name" value={profile.fullName} onChange={(value) => update("fullName", value)} required /><Field label="Nexora login email" type="email" value={profile.email} onChange={(value) => update("email", value)} required readOnly /><Field label="Education / degree" value={profile.education} onChange={(value) => update("education", value)} /><Field label="Preferred role" value={profile.preferredRole} onChange={(value) => update("preferredRole", value)} placeholder="Full Stack Developer" /><Field label="Skills" value={profile.skills} onChange={(value) => update("skills", value)} placeholder="React, SQL, DSA" /><Field label="Programming languages" value={profile.languages} onChange={(value) => update("languages", value)} placeholder="JavaScript, Python" /><TextAreaField label="Projects" value={profile.projects} onChange={(value) => update("projects", value)} placeholder="One project per line: name, description, technologies" /><TextAreaField label="Certifications" value={profile.certifications} onChange={(value) => update("certifications", value)} placeholder="One certification per line" /><Field label="Career interests" value={profile.interests} onChange={(value) => update("interests", value)} placeholder="Product development, data" /><Field label="Target company" value={profile.targetCompany} onChange={(value) => update("targetCompany", value)} /><Field label="Preferred location" value={profile.location} onChange={(value) => update("location", value)} />
  </div><div className="actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving..." : <><Save size={16} /> {initialProfile ? "Update profile" : "Save profile"}</>}</button><Link className="button button-secondary" href="/placement-prep/jobs">Manage resume &amp; jobs <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/placement-prep/dashboard">Open workspace <ArrowRight size={16} /></Link></div>{message && <p role="status" style={{ color: message.includes("saved") ? "var(--success)" : "#b91c1c", fontWeight: 700 }}>{message}</p>}</form></section></main>;
}

function Field({ label, value, onChange, ...props }) {
  return <div className="field"><label>{label}</label><input value={value} onChange={(event) => onChange(event.target.value)} {...props} /></div>;
}

function TextAreaField({ label, value, onChange, ...props }) {
  return <div className="field"><label>{label}</label><textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} {...props} /></div>;
}
