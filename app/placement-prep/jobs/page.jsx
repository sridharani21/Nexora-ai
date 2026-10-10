import Link from "next/link";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { getJobTrackerDashboard } from "@/actions/placement-modules";
import SiteNav from "../components/site-nav";
import JobTracker from "./job-tracker";

export default async function JobsPage() {
  let data;
  try {
    data = await getJobTrackerDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!["Sign in with Nexora before continuing.", "Complete your student profile before continuing.", "Add and verify an email address in your Nexora account before continuing."].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Resume &amp; Jobs · Module 17</div><h1>Track your job search.</h1><p className="lead">{message}</p><Link className="button button-primary" href="/placement-prep/profile">Complete student profile</Link></section></main></>;
  }
  return <><SiteNav /><main className="container"><JobTracker data={data} /></main></>;
}
