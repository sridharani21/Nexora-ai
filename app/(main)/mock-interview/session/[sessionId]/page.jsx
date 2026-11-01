import { redirect } from "next/navigation";
import MockInterviewLiveSession from "../../_components/mock-interview-live-session";
import MockInterviewTavusSession from "../../_components/mock-interview-tavus-session";

export const metadata = { title: "Live Interview · Module 6 | Nexora AI" };

export default async function MockInterviewLiveSessionPage({ params, searchParams }) {
  const { sessionId } = await params;
  const query = await searchParams;
  const audioOnly = query?.mode === "audio";
  if (!audioOnly && process.env.TAVUS_API_KEY?.trim() && process.env.TAVUS_PAL_ID?.trim()) {
    return <MockInterviewTavusSession sessionId={sessionId} />;
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    redirect(`/mock-interview/text-session/${encodeURIComponent(sessionId)}`);
  }
  return <MockInterviewLiveSession sessionId={sessionId} />;
}
