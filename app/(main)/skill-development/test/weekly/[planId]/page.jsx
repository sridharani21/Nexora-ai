import AssessmentSession from "../../assessment-session";

export default async function WeeklyAssessmentPage({ params, searchParams }) {
  const [{ planId }, query] = await Promise.all([params, searchParams]);
  return <AssessmentSession planId={planId} weekNumber={query.week || null} />;
}
