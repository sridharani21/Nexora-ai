import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getAuthenticatedStudent } from "@/lib/student-profile-server";
import { studentProfileSchema } from "@/lib/student-profile";
import { defaultCareerRoleForBranch, getBlueprintForBranch, validateBlueprint } from "@/lib/module2/blueprints";
import {
  expireStaleGeneratingAttempt,
  getIntegrityCooldown,
  getStudentAttemptList,
} from "@/lib/module2/assessment-engine";
import AssessmentInstructions from "./_components/assessment-instructions";

export const metadata = {
  title: "Technical Assessment | Nexora AI",
  description: "Start your branch-specific, timed Nexora technical assessment.",
};

export default async function AssessmentPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const student = await getAuthenticatedStudent();
  if (!student) redirect("/sign-in");

  const profile = studentProfileSchema.safeParse(student.profile?.profileData);
  if (!profile.success || !profile.data.academic.branch) {
    return (
      <main className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-7">
        <h1 className="text-2xl font-bold text-slate-950">Complete your student profile</h1>
        <p className="mt-2 leading-7 text-slate-700">
          Add and confirm your engineering branch before we prepare a branch-specific assessment.
        </p>
        <Link href="/student-profile" className="mt-5 inline-flex rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white">
          Complete profile
        </Link>
      </main>
    );
  }

  const branchBlueprint = getBlueprintForBranch(profile.data.academic.branch);
  if (!branchBlueprint) {
    return <p role="alert">Your profile branch does not have an assessment blueprint yet.</p>;
  }

  await expireStaleGeneratingAttempt(student.id);
  const [configuredRows, activeRows, attempts, cooldownUntil] = await Promise.all([
    db.$queryRaw`
      SELECT "branch", "version", "durationMinutes", "maxMarks", "sections", "scoringPolicy"
      FROM "Module2Blueprint" WHERE "branch" = ${branchBlueprint.branch} AND "isActive" = true
      ORDER BY "version" DESC LIMIT 1
    `,
    db.$queryRaw`
      SELECT "id", "status" FROM "Module2Attempt"
      WHERE "userId" = ${student.id} AND "status" IN ('GENERATING', 'ACTIVE')
      ORDER BY "createdAt" DESC LIMIT 1
    `,
    getStudentAttemptList(userId),
    getIntegrityCooldown(student.id),
  ]);

  if (activeRows[0]?.status === "ACTIVE") redirect(`/assessment/${activeRows[0].id}`);
  if (activeRows[0]?.status === "GENERATING") {
    return (
      <main className="mx-auto max-w-3xl rounded-2xl border border-indigo-100 bg-indigo-50 p-7">
        <h1 className="text-2xl font-bold text-slate-950">Preparing your assessment</h1>
        <p className="mt-2 text-slate-700">Your questions are being generated and validated. The timer has not started.</p>
        <p className="mt-2 text-sm text-slate-600">Refresh this page in a moment to continue.</p>
      </main>
    );
  }

  if (!configuredRows[0]) {
    return <p role="alert">The assessment blueprint is not configured. Please contact support.</p>;
  }
  const configured = validateBlueprint(configuredRows[0]);
  if (!configured.success) {
    return <p role="alert">The configured assessment blueprint is invalid. Please contact support.</p>;
  }

  return (
    <AssessmentInstructions
      studentName={student.name || ""}
      branch={configured.blueprint.branch}
      careerRole={profile.data.preferences.roles[0] || defaultCareerRoleForBranch(configured.blueprint.branch)}
      blueprint={configured.blueprint}
      cooldownSeconds={cooldownUntil
        ? Math.max(0, Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 1000))
        : 0}
      priorAttempts={attempts.filter((attempt) => (
        attempt.branch === configured.blueprint.branch
        && attempt.blueprintVersion === configured.blueprint.version
        && attempt.score !== null
      ))}
    />
  );
}
