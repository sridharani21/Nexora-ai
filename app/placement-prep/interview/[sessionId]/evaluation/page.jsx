import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getAiInterviewEvaluation } from "@/actions/prep-interview-evaluation";
import SiteNav from "../../../components/site-nav";
import InterviewEvaluationReport from "./report";

export default async function InterviewEvaluationPage({ params }) {
  let data;
  try {
    const { sessionId } = await params;
    data = await getAiInterviewEvaluation(sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (![
      "Sign in with Nexora before continuing.",
      "Complete your student profile before continuing.",
      "Add and verify an email address in your Nexora account before continuing.",
      "Interview evaluation not found.",
    ].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero">
      <div className="eyebrow">Interview evaluation · Module 13</div>
      <h1>Evaluation report unavailable.</h1>
      <p className="lead">{message}</p>
      <Link className="button button-primary" href="/placement-prep/interview">Return to AI Interview <ArrowRight size={16} /></Link>
    </section></main></>;
  }

  return <><SiteNav /><main className="container">
    <Link className="module-link interview-report-back" href={`/placement-prep/interview/${data.session.id}`}><ArrowLeft size={14} /> Back to interview transcript</Link>
    <InterviewEvaluationReport data={data} />
  </main></>;
}
