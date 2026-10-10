import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getLearningRoadmapDashboard } from "@/actions/placement-modules";
import SiteNav from "../components/site-nav";
import LearningRoadmaps from "./learning-roadmaps";

export default async function LearningPage() {
  let data;
  try {
    data = await getLearningRoadmapDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!["Sign in with Nexora before continuing.", "Complete your student profile before continuing.", "Add and verify an email address in your Nexora account before continuing."].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Career &amp; Learning Recommendations · Module 16</div><h1>Build your long-term learning roadmap.</h1><p className="lead">{message}</p><Link className="button button-primary" href="/placement-prep/profile">Complete student profile</Link></section></main></>;
  }
  return <><SiteNav /><main className="container"><LearningRoadmaps data={data} /></main></>;
}
