import AssessmentSession from "../assessment-session";

export default async function DailyAssessmentPage({ params, searchParams }) {
  const [{ taskId }, query] = await Promise.all([params, searchParams]);
  return <AssessmentSession taskId={taskId} planId={query.planId || null} />;
}
