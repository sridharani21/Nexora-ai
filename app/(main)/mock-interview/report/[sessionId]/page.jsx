import MockInterviewReport from "../../_components/mock-interview-report";

export const metadata = { title: "Interview Report · Module 6 | Nexora AI" };

export default async function MockInterviewReportPage({ params }) {
  const { sessionId } = await params;
  return <MockInterviewReport sessionId={sessionId} />;
}
