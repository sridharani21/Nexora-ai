"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { savePlacementProfile } from "@/actions/placement-journey";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const listValue = (value) =>
  value.split(",").map((item) => item.trim()).filter(Boolean);

export default function PlacementProfileForm({ journey, defaults }) {
  const router = useRouter();
  const existing = journey?.profile;
  const [form, setForm] = useState({
    fullName: existing?.fullName ?? defaults.fullName,
    email: existing?.email ?? defaults.email,
    phone: existing?.phone ?? "",
    educationLevel: existing?.educationLevel ?? "",
    institution: existing?.institution ?? "",
    degree: existing?.degree ?? "",
    graduationYear: existing?.graduationYear?.toString() ?? "",
    cgpa: existing?.cgpa ?? "",
    academicDetails: existing?.academicDetails ?? "",
    skills: existing?.skills?.join(", ") ?? "",
    programmingLanguages: existing?.programmingLanguages?.join(", ") ?? "",
    projectSummary: existing?.projects?.map((project) => `${project.name}: ${project.description ?? ""}`).join("\n") ?? "",
    certificationsSummary: existing?.certifications?.map((certification) => `${certification.name} - ${certification.issuer ?? ""}`).join("\n") ?? "",
    projects: existing?.projects ?? [],
    certifications: existing?.certifications ?? [],
    resumeUrl: existing?.resumeUrl ?? "",
    resumeText: existing?.resumeText ?? "",
    careerInterests: existing?.careerInterests?.join(", ") ?? "",
    preferredRole: existing?.preferredRole ?? "",
    targetCompany: existing?.targetCompany ?? "",
    companyType: existing?.companyType ?? "",
    preferredLocations: existing?.preferredLocations?.join(", ") ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const completion = useMemo(() => {
    const required = [
      form.fullName,
      form.email,
      form.educationLevel,
      form.institution,
      form.skills,
      form.preferredRole,
    ];
    return Math.round((required.filter(Boolean).length / required.length) * 100);
  }, [form]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await savePlacementProfile({
        ...form,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
        skills: listValue(form.skills),
        programmingLanguages: listValue(form.programmingLanguages),
        careerInterests: listValue(form.careerInterests),
        preferredLocations: listValue(form.preferredLocations),
        projects: form.projectSummary
          ? [{ name: "Project portfolio", description: form.projectSummary, technologies: [], link: "" }]
          : [],
        certifications: form.certificationsSummary
          ? [{ name: form.certificationsSummary, issuer: "", issueDate: "", credentialUrl: "" }]
          : [],
      });
      toast.success("Placement profile saved.");
      router.push("/placement-workspace");
      router.refresh();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save your profile.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-primary">Module 1 of 21</p>
        <h1 className="gradient-title text-4xl font-bold">Build your placement profile</h1>
        <p className="max-w-2xl text-muted-foreground">
          This information is stored securely and used to personalize every future assessment,
          recommendation, and progress report in your placement journey.
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">{completion}% of the essential profile completed</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>How we should identify and contact you.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" value={form.fullName} onChange={(value) => update("fullName", value)} required />
            <Field label="Login email" type="email" value={form.email} onChange={(value) => update("email", value)} required readOnly />
            <p className="text-sm text-muted-foreground md:col-span-2">This email comes from your Nexora login and is used to recognize your placement profile.</p>
            <Field label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Academic details</CardTitle>
            <CardDescription>These details help us measure eligibility and skill gaps.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Education level" placeholder="e.g. Undergraduate" value={form.educationLevel} onChange={(value) => update("educationLevel", value)} required />
            <Field label="Institution" value={form.institution} onChange={(value) => update("institution", value)} required />
            <Field label="Degree / branch" value={form.degree} onChange={(value) => update("degree", value)} />
            <Field label="Graduation year" type="number" min="1950" max="2100" value={form.graduationYear} onChange={(value) => update("graduationYear", value)} />
            <Field label="CGPA / percentage" value={form.cgpa} onChange={(value) => update("cgpa", value)} />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Additional academic details</label>
              <Textarea value={form.academicDetails} onChange={(event) => update("academicDetails", event.target.value)} placeholder="Relevant coursework, achievements, academic context..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills and career preferences</CardTitle>
            <CardDescription>Separate multiple values with commas. You can update these later.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Skills" value={form.skills} onChange={(value) => update("skills", value)} placeholder="JavaScript, communication, problem solving" required />
            <Field label="Programming languages" value={form.programmingLanguages} onChange={(value) => update("programmingLanguages", value)} placeholder="Java, Python, C++" />
            <Field label="Career interests" value={form.careerInterests} onChange={(value) => update("careerInterests", value)} placeholder="Web development, data, cloud" />
            <Field label="Preferred role" value={form.preferredRole} onChange={(value) => update("preferredRole", value)} placeholder="e.g. Frontend Developer" required />
            <Field label="Target company" value={form.targetCompany} onChange={(value) => update("targetCompany", value)} />
            <Field label="Company type" value={form.companyType} onChange={(value) => update("companyType", value)} placeholder="Startup, product, service..." />
            <Field label="Preferred locations" value={form.preferredLocations} onChange={(value) => update("preferredLocations", value)} placeholder="Bengaluru, Remote" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects, certifications, and resume</CardTitle>
            <CardDescription>These details are saved now and will be used by later resume and interview modules.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Projects</label>
                <Textarea value={form.projectSummary} onChange={(event) => update("projectSummary", event.target.value)} placeholder="Project name: what you built and your contribution" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Certifications</label>
                <Textarea value={form.certificationsSummary} onChange={(event) => update("certificationsSummary", event.target.value)} placeholder="Certification name - issuing organization" />
              </div>
            </div>
            <Field label="Resume link" type="url" value={form.resumeUrl} onChange={(value) => update("resumeUrl", value)} placeholder="https://..." />
            <div className="space-y-2">
              <label className="block text-sm font-medium">Resume text (optional)</label>
              <Textarea value={form.resumeText} onChange={(event) => update("resumeText", event.target.value)} placeholder="Paste your current resume text. File upload will be added in Resume Intelligence." />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving profile..." : "Save and open my dashboard"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, value, onChange, required, ...props }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} required={required} {...props} />
    </div>
  );
}
