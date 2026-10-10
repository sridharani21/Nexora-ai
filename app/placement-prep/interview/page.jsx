import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAiInterviewDashboard } from "@/actions/prep-interview";
import SiteNav from "../components/site-nav";
import AiInterviewDashboard from "./interview-dashboard";

export default async function AiInterviewPage() {
  let data;
  try {
    data = await getAiInterviewDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (![
      "Sign in with Nexora before continuing.",
      "Complete your student profile before continuing.",
      "Add and verify an email address in your Nexora account before continuing.",
    ].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero">
      <div className="eyebrow">AI Interview · Module 12</div>
      <h1>Practice a real interview conversation.</h1>
      <p className="lead">{message}</p>
      <div className="actions">
        <Link className="button button-primary" href="/placement-prep/profile">Complete profile <ArrowRight size={16} /></Link>
        <Link className="button button-secondary" href="/placement-prep/dashboard">Back to workspace</Link>
      </div>
    </section></main></>;
  }

  return <><SiteNav /><main className="container"><AiInterviewDashboard data={data} /></main></>;
}
