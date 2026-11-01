import InterviewCheck from "../_components/interview-check";

export const metadata = { title: "Pre-interview Check · Module 6 | Nexora AI" };

export default async function InterviewCheckPage({ searchParams }) {
  const params = await searchParams;
  return <InterviewCheck sessionId={typeof params?.sessionId === "string" ? params.sessionId : ""} />;
}
