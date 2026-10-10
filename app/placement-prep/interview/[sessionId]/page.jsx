import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getAiInterviewSession } from "@/actions/prep-interview";
import SiteNav from "../../components/site-nav";
import AiInterviewSession from "../interview-session";

export default async function AiInterviewSessionPage({ params }) {
  let session;
  try {
    const { sessionId } = await params;
    session = await getAiInterviewSession(sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (![
      "Sign in with Nexora before continuing.",
      "Complete your student profile before continuing.",
      "Add and verify an email address in your Nexora account before continuing.",
      "Interview session not found.",
    ].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero">
      <div className="eyebrow">AI Interview · Module 12</div>
      <h1>Interview session unavailable.</h1>
      <p className="lead">{message}</p>
      <Link className="button button-primary" href="/placement-prep/interview">Back to AI Interview <ArrowRight size={16} /></Link>
    </section></main></>;
  }
  return <><SiteNav /><main className="container"><AiInterviewSession initialSession={session} /></main></>;
}
