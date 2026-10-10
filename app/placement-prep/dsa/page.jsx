import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDsaDashboard } from "@/actions/prep-dsa";
import SiteNav from "../components/site-nav";
import DsaClient from "./dsa-client";

export default async function DsaPage() {
  let data;
  try {
    data = await getDsaDashboard();
  } catch (error) {
    return <><SiteNav /><main className="container"><section className="hero">
      <div className="eyebrow">DSA &amp; Coding</div>
      <h1>Build your coding progress from real evidence.</h1>
      <p className="lead">{error instanceof Error ? error.message : "Complete your student profile before continuing."}</p>
      <div className="actions">
        <Link className="button button-primary" href="/placement-prep/profile">Complete profile <ArrowRight size={16} /></Link>
        <Link className="button button-secondary" href="/placement-prep/dashboard">Back to workspace</Link>
      </div>
    </section></main></>;
  }

  return <><SiteNav /><main className="container"><DsaClient data={data} /></main></>;
}
