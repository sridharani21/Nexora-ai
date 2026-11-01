import MockInterviewSession from "../../_components/mock-interview-session";

export const metadata = { title: "Text Practice · Module 6 | Nexora AI" };

export default async function MockInterviewTextSessionPage({ params }) {
  const { sessionId } = await params;
  return <MockInterviewSession sessionId={sessionId} />;
}
