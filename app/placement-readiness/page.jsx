import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPlacementReadiness } from "@/actions/placement-readiness";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Placement Readiness | Nexora AI",
  description: "Understand your skill readiness and target-role gaps.",
};

export default async function PlacementReadinessPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let data;
  try {
    data = await getPlacementReadiness();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Complete your placement profile")) {
      redirect("/");
    }
    throw error;
  }

  const report = data.report;
  const skillScores = report.skillScores && typeof report.skillScores === "object" ? report.skillScores : {};
  const gaps = Array.isArray(report.skillGaps) ? report.skillGaps : [];
  const profileSnapshot = report.profileSnapshot && typeof report.profileSnapshot === "object" ? report.profileSnapshot : {};
  const dynamicProfile = profileSnapshot.dynamicProfile ?? {};

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          <Link href="/placement-dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Placement dashboard</Link>
          <p className="pt-2 text-sm font-medium text-primary">Module 3 · Placement readiness & skill analysis</p>
          <h1 className="gradient-title text-4xl font-bold">{dynamicProfile.label || "Your readiness profile"}</h1>
          <p className="text-muted-foreground">A persistent report combining your profile, interests, and latest assessment.</p>
        </div>
        <Button asChild><Link href="/placement-preparation">Build my preparation plan</Link></Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Overall readiness" value={`${report.overallScore}%`} detail={`Target role: ${report.targetRole || "Not set"}`} />
        <SummaryCard label="Strengths" value={String(Array.isArray(report.strengths) ? report.strengths.length : 0)} detail="Skills currently at or above target" />
        <SummaryCard label="Priority gaps" value={String(gaps.filter((gap) => gap.gap > 0).length)} detail={report.targetCompany ? `Compared with ${report.targetCompany}` : "Compared with your target role"} />
      </section>
      <Card className="mt-6">
        <CardHeader><CardTitle>Dynamic readiness profile</CardTitle><CardDescription>{dynamicProfile.field || "Technology"} · recalculated from your latest evidence</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">{(dynamicProfile.evidence ?? []).map((item) => <span key={item} className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">{item}</span>)}</CardContent>
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Skill-wise scores</CardTitle><CardDescription>Scores adapt when you update your profile or retake the assessment.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(skillScores).map(([skill, score]) => (
              <div key={skill}>
                <div className="mb-1 flex justify-between text-sm"><span>{skill}</span><span className="font-medium">{score}%</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Strengths & weaknesses</CardTitle><CardDescription>Use the focus areas to prioritise your next practice sessions.</CardDescription></CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <List title="Strengths" values={report.strengths} />
            <List title="Focus next" values={report.weaknesses} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Target-role skill gaps</CardTitle><CardDescription>{report.targetRole || "Target role"} · target score is 75%</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gaps.map((gap) => (
            <div key={gap.skill} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2"><p className="font-medium">{gap.skill}</p><span className="text-sm text-muted-foreground">{gap.currentScore}%</span></div>
              <p className="mt-2 text-sm text-muted-foreground">{gap.gap > 0 ? `${gap.gap} points to target` : "Target met — maintain"}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-primary">{gap.priority}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

function SummaryCard({ label, value, detail }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-3xl">{value}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{detail}</p></CardContent></Card>;
}

function List({ title, values }) {
  return <div><h3 className="font-semibold">{title}</h3><ul className="mt-2 space-y-2 text-sm text-muted-foreground">{(Array.isArray(values) ? values : []).map((value) => <li key={value}>• {value}</li>)}</ul></div>;
}
