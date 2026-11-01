import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import AssessmentExam from "../_components/assessment-exam";
import { getDatabaseServerTime, getOwnedAttempt } from "@/lib/module2/assessment-engine";
import { toStudentQuestion } from "@/lib/module2/assessment-presentation";

export default async function ActiveAssessmentPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { attemptId } = await params;
  const attempt = await getOwnedAttempt(attemptId, userId);
  if (!attempt) redirect("/assessment");
  if (attempt.status === "GENERATING") redirect("/assessment");
  if (attempt.status !== "ACTIVE") redirect(`/assessment/${attemptId}/results`);
  const serverNow = await getDatabaseServerTime();

  return (
    <AssessmentExam
      attempt={{
        id: attempt.id,
        branch: attempt.branch,
        blueprint: attempt.blueprint,
        deadlineAt: attempt.deadlineAt.toISOString(),
        serverNow: serverNow.toISOString(),
        cameraConsent: attempt.cameraConsent,
      }}
      questions={attempt.questions.map(toStudentQuestion)}
      initialAnswers={attempt.answers || {}}
    />
  );
}
