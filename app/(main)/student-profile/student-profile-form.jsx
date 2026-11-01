"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { calculateProfileCompleteness, studentProfileSchema } from "@/lib/student-profile";
import { saveStudentProfile } from "@/actions/student-profile";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const sectionClass = "space-y-5 rounded-xl border bg-card p-5 shadow-sm md:p-7";

function Field({ label, value, onChange, type = "text", placeholder, options, multiline = false, readOnly = false, idPrefix = "profile" }) {
  const id = `${idPrefix}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {options ? (
        <select
          id={id}
          className={inputClass}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={readOnly}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : multiline ? (
        <textarea
          id={id}
          className={`${inputClass} min-h-24 resize-y`}
          value={value || ""}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
        />
      ) : (
        <input
          id={id}
          className={`${inputClass} ${readOnly ? "opacity-70" : ""}`}
          type={type}
          value={value || ""}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

function CollectionSection({ title, items, fields, makeItem, onChange }) {
  const updateItem = (index, field, value) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  return (
    <section className={sectionClass}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, makeItem()])}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
      <div className="space-y-5">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-lg border p-4">
            <div className="mb-4 flex justify-end">
              {item.source === "resume" && (
                <span className="mr-auto self-center text-xs text-muted-foreground">Suggested from resume — verify before saving</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${title.toLowerCase()} entry ${index + 1}`}
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className={field.fullWidth ? "sm:col-span-2" : ""}>
                  <Field
                    label={field.label}
                    idPrefix={`${title}-${index}`}
                    value={item[field.key]}
                    type={field.type}
                    options={field.options}
                    multiline={field.multiline}
                    placeholder={field.placeholder}
                    onChange={(value) => updateItem(index, field.key, value)}
                  />
                </div>
              ))}
              {title === "Experience" && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(item.current)}
                    onChange={(event) => updateItem(index, "current", event.target.checked)}
                  />
                  I currently work here
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function splitValues(value) {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function mergeExtractedProfile(current, extracted) {
  const mergeObject = (existing, incoming) => {
    if (Array.isArray(existing)) return existing.length ? existing : (incoming || existing);
    if (existing && typeof existing === "object") {
      return Object.fromEntries(Object.keys(existing).map((key) => [
        key,
        mergeObject(existing[key], incoming?.[key]),
      ]));
    }
    return existing !== "" && existing !== null && existing !== undefined
      ? existing
      : incoming ?? existing;
  };
  const appendUnique = (existing, incoming, keyOf) => {
    const result = [...existing];
    const seen = new Set(existing.map(keyOf).filter(Boolean));
    for (const item of incoming || []) {
      const key = keyOf(item);
      if (!key || seen.has(key)) continue;
      result.push(item);
      seen.add(key);
    }
    return result;
  };

  return {
    ...mergeObject(current, extracted),
    skills: appendUnique(current.skills, extracted.skills, (item) => item.name?.trim().toLowerCase()),
    projects: appendUnique(current.projects, extracted.projects, (item) => item.title?.trim().toLowerCase()),
    experience: appendUnique(current.experience, extracted.experience, (item) =>
      `${item.organization}|${item.title}`.trim().toLowerCase()
    ),
    certifications: appendUnique(current.certifications, extracted.certifications, (item) =>
      `${item.name}|${item.issuer}`.trim().toLowerCase()
    ),
  };
}

function removeEmptyEntries(profile) {
  return {
    ...profile,
    skills: profile.skills.filter((item) => item.name.trim()),
    projects: profile.projects.filter((item) => item.title.trim()),
    experience: profile.experience.filter((item) => item.organization.trim() || item.title.trim()),
    certifications: profile.certifications.filter((item) => item.name.trim()),
  };
}

const skillFields = [
  { key: "name", label: "Skill name" },
  { key: "category", label: "Category" },
  {
    key: "proficiency",
    label: "Self-reported proficiency",
    options: [
      { value: "", label: "Not specified" },
      { value: "Beginner", label: "Beginner" },
      { value: "Intermediate", label: "Intermediate" },
      { value: "Advanced", label: "Advanced" },
      { value: "Expert", label: "Expert" },
    ],
  },
  { key: "experience", label: "Time used" },
  { key: "evidence", label: "Project or context", multiline: true, fullWidth: true },
];

const projectFields = [
  { key: "title", label: "Project title" },
  { key: "type", label: "Project type", placeholder: "Academic, personal, internship, hackathon..." },
  { key: "role", label: "Your role" },
  { key: "technologies", label: "Technologies", placeholder: "Separate with commas" },
  { key: "startDate", label: "Start date", type: "month" },
  { key: "endDate", label: "End date", type: "month" },
  { key: "url", label: "Project URL", type: "url" },
  { key: "repositoryUrl", label: "Repository URL", type: "url" },
  { key: "description", label: "Description", multiline: true, fullWidth: true },
  { key: "outcomes", label: "Outcomes or achievements", multiline: true, fullWidth: true },
];

const experienceFields = [
  { key: "organization", label: "Organization" },
  { key: "title", label: "Role or title" },
  { key: "employmentType", label: "Employment type" },
  { key: "location", label: "Location" },
  { key: "startDate", label: "Start date", type: "month" },
  { key: "endDate", label: "End date", type: "month" },
  { key: "technologies", label: "Technologies", placeholder: "Separate with commas" },
  { key: "url", label: "Organization or certificate URL", type: "url" },
  { key: "responsibilities", label: "Responsibilities", multiline: true, fullWidth: true },
  { key: "achievements", label: "Achievements", multiline: true, fullWidth: true },
];

const certificationFields = [
  { key: "name", label: "Certification name" },
  { key: "issuer", label: "Issuing organization" },
  { key: "issueDate", label: "Issue date", type: "month" },
  { key: "expiryDate", label: "Expiry date", type: "month" },
  { key: "credentialId", label: "Credential ID" },
  { key: "credentialUrl", label: "Credential URL", type: "url" },
];

export function StudentProfileForm({ initialName, email, initialProfile }) {
  const router = useRouter();
  const fileInput = useRef(null);
  const [name, setName] = useState(initialName);
  const [profile, setProfile] = useState(initialProfile);
  const [resumeFile, setResumeFile] = useState(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  const updateProfile = (section, key, value) => {
    setProfile((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  };

  const handleResumeExtraction = async (event) => {
    event.preventDefault();
    setError("");
    if (!resumeFile) {
      setError("Choose a PDF or DOCX resume first.");
      return;
    }
    if (!aiConsent) {
      setError("Confirm the resume-processing notice to continue.");
      return;
    }

    setExtracting(true);
    const formData = new FormData();
    formData.append("resume", resumeFile);
    formData.append("aiConsent", "true");
    try {
      const response = await fetch("/api/student-profile/extract", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Resume extraction failed.");

      setProfile((current) => mergeExtractedProfile(current, result.profile));
      setReviewMessage("Extracted details are ready. Review and correct them before saving.");
      setResumeFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (extractError) {
      setError(extractError.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    const nextProfile = removeEmptyEntries(profile);
    const validated = studentProfileSchema.safeParse(nextProfile);
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!validated.success) {
      setError(validated.error.issues[0]?.message || "Review the profile details and try again.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveStudentProfile({ name: name.trim(), profile: validated.data });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setProfile(validated.data);
      setReviewMessage("");
      toast.success("Profile saved.");
      router.replace("/dashboard");
    } catch {
      setError("We couldn't save your profile right now. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const completeness = calculateProfileCompleteness(profile);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Your profile</h1>
        <div className="text-sm text-muted-foreground" aria-label={`Profile ${completeness}% complete`}>
          Profile completeness <span className="font-semibold text-foreground">{completeness}%</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <section className={sectionClass}>
          <h2 className="text-xl font-semibold">Personal details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={name} onChange={setName} />
            <Field label="Account email" value={email} readOnly onChange={() => {}} />
            <Field label="Phone" value={profile.phone} onChange={(value) => setProfile((current) => ({ ...current, phone: value }))} />
            <Field label="Location" value={profile.location} onChange={(value) => setProfile((current) => ({ ...current, location: value }))} />
            <div className="sm:col-span-2">
              <Field label="Professional summary" value={profile.summary} multiline onChange={(value) => setProfile((current) => ({ ...current, summary: value }))} />
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-xl font-semibold">Education</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="College or institution" value={profile.academic.institution} onChange={(value) => updateProfile("academic", "institution", value)} />
            <Field label="Degree" value={profile.academic.degree} placeholder="B.Tech, B.Sc, MCA..." onChange={(value) => updateProfile("academic", "degree", value)} />
            <Field label="Department or branch" value={profile.academic.branch} onChange={(value) => updateProfile("academic", "branch", value)} />
            <Field label="Specialization" value={profile.academic.specialization} onChange={(value) => updateProfile("academic", "specialization", value)} />
            <Field label="Study status" value={profile.academic.studyStatus} placeholder="Currently studying, graduated..." onChange={(value) => updateProfile("academic", "studyStatus", value)} />
            <Field label="Academic year" value={profile.academic.academicYear} placeholder="First year, final year..." onChange={(value) => updateProfile("academic", "academicYear", value)} />
            <Field label="Semester" value={profile.academic.semester} onChange={(value) => updateProfile("academic", "semester", value)} />
            <Field label="CGPA or percentage" value={profile.academic.gpa} onChange={(value) => updateProfile("academic", "gpa", value)} />
            <Field
              label="Grading scale"
              value={profile.academic.gradingScale}
              options={[
                { value: "", label: "Select grading scale" },
                { value: "10", label: "CGPA out of 10" },
                { value: "4", label: "GPA out of 4" },
                { value: "100", label: "Percentage out of 100" },
                { value: "other", label: "Other (enter as provided)" },
              ]}
              onChange={(value) => updateProfile("academic", "gradingScale", value)}
            />
            {profile.academic.gradingScale === "other" && (
              <Field
                label="Maximum for this grading scale"
                value={profile.academic.gpaMaximum}
                type="number"
                onChange={(value) => updateProfile("academic", "gpaMaximum", value)}
              />
            )}
            <Field label="Expected graduation year" value={profile.academic.expectedGraduationYear} type="number" onChange={(value) => updateProfile("academic", "expectedGraduationYear", value)} />
            <Field label="Backlogs or active arrears (optional)" value={profile.academic.backlogs} onChange={(value) => updateProfile("academic", "backlogs", value)} />
            <div className="sm:col-span-2">
              <Field label="Academic achievements" value={profile.academic.achievements} multiline onChange={(value) => updateProfile("academic", "achievements", value)} />
            </div>
          </div>
        </section>

        <CollectionSection
          title="Skills"
          items={profile.skills}
          fields={skillFields}
          makeItem={() => ({ name: "", category: "", proficiency: "", experience: "", evidence: "", source: "manual" })}
          onChange={(skills) => setProfile((current) => ({ ...current, skills }))}
        />

        <CollectionSection
          title="Projects"
          items={profile.projects}
          fields={projectFields}
          makeItem={() => ({ title: "", description: "", technologies: "", role: "", startDate: "", endDate: "", url: "", repositoryUrl: "", type: "", outcomes: "", source: "manual" })}
          onChange={(projects) => setProfile((current) => ({ ...current, projects }))}
        />

        <CollectionSection
          title="Experience"
          items={profile.experience}
          fields={experienceFields}
          makeItem={() => ({ organization: "", title: "", employmentType: "", location: "", startDate: "", endDate: "", current: false, responsibilities: "", achievements: "", technologies: "", url: "", source: "manual" })}
          onChange={(experience) => setProfile((current) => ({ ...current, experience }))}
        />

        <CollectionSection
          title="Certifications"
          items={profile.certifications}
          fields={certificationFields}
          makeItem={() => ({ name: "", issuer: "", issueDate: "", expiryDate: "", credentialId: "", credentialUrl: "", source: "manual" })}
          onChange={(certifications) => setProfile((current) => ({ ...current, certifications }))}
        />

        <section className={sectionClass}>
          <h2 className="text-xl font-semibold">Career preferences</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred roles" value={profile.preferences.roles.join(", ")} placeholder="Separate with commas" onChange={(value) => updateProfile("preferences", "roles", splitValues(value))} />
            <Field label="Technical domains" value={profile.preferences.domains.join(", ")} placeholder="Separate with commas" onChange={(value) => updateProfile("preferences", "domains", splitValues(value))} />
            <Field label="Industries" value={profile.preferences.industries.join(", ")} placeholder="Separate with commas" onChange={(value) => updateProfile("preferences", "industries", splitValues(value))} />
            <Field label="Preferred locations" value={profile.preferences.locations.join(", ")} placeholder="Separate with commas" onChange={(value) => updateProfile("preferences", "locations", splitValues(value))} />
            <Field label="Work arrangement" value={profile.preferences.workArrangement} placeholder="Onsite, hybrid, remote, flexible..." onChange={(value) => updateProfile("preferences", "workArrangement", value)} />
            <Field label="Employment type" value={profile.preferences.employmentType} placeholder="Full-time, internship..." onChange={(value) => updateProfile("preferences", "employmentType", value)} />
            <Field
              label="Willing to relocate"
              value={profile.preferences.willingToRelocate}
              options={[
                { value: "", label: "Select an option" },
                { value: "undecided", label: "Undecided" },
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              onChange={(value) => updateProfile("preferences", "willingToRelocate", value)}
            />
            <Field label="Target companies" value={profile.preferences.targetCompanies.join(", ")} placeholder="Separate with commas" onChange={(value) => updateProfile("preferences", "targetCompanies", splitValues(value))} />
            <div className="sm:col-span-2">
              <Field label="Preparation goals" value={profile.preferences.goals} multiline onChange={(value) => updateProfile("preferences", "goals", value)} />
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-xl font-semibold">Professional links</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="LinkedIn" value={profile.links.linkedin} type="url" onChange={(value) => updateProfile("links", "linkedin", value)} />
            <Field label="GitHub" value={profile.links.github} type="url" onChange={(value) => updateProfile("links", "github", value)} />
            <Field label="Portfolio" value={profile.links.portfolio} type="url" onChange={(value) => updateProfile("links", "portfolio", value)} />
            <Field label="Website" value={profile.links.website} type="url" onChange={(value) => updateProfile("links", "website", value)} />
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-xl font-semibold">Use a resume to fill in details</h2>
          <div className="space-y-3">
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:font-medium file:text-primary-foreground"
              aria-label="Choose a PDF or DOCX resume"
            />
            <p className="text-sm text-muted-foreground">
              PDF or DOCX, up to 5 MB. Scanned PDFs are not supported. Your file is processed temporarily and is not stored.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={(event) => setAiConsent(event.target.checked)}
                className="mt-1"
              />
              <span>I agree to send the extracted resume text to the configured AI provider to suggest profile details. I will review all suggestions before saving.</span>
            </label>
            <Button type="button" variant="outline" onClick={handleResumeExtraction} disabled={extracting || !resumeFile}>
              {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {extracting ? "Extracting..." : "Extract details"}
            </Button>
          </div>
        </section>

        {reviewMessage && (
          <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {reviewMessage}
          </p>
        )}
        {error && <p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive" role="alert">{error}</p>}

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
