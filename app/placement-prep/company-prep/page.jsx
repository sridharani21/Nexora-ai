import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCompanyPreparationDashboard } from "@/actions/prep-company";
import SiteNav from "../components/site-nav";
import CompanyPrepClient from "./company-prep-client";

export default async function CompanyPreparationPage() {
  let data;
  try {
    data = await getCompanyPreparationDashboard();
  } catch (error) {
    return <><SiteNav /><main className="container"><section className="hero">
      <div className="eyebrow">Company preparation</div>
      <h1>Build a company-specific preparation strategy.</h1>
      <p className="lead">{error instanceof Error ? error.message : "Complete your student profile before continuing."}</p>
      <div className="actions">
        <Link className="button button-primary" href="/placement-prep/profile">Complete profile <ArrowRight size={16} /></Link>
        <Link className="button button-secondary" href="/placement-prep/dashboard">Back to workspace</Link>
      </div>
    </section></main></>;
  }

  return <><SiteNav /><main className="container"><CompanyPrepClient data={data} /></main></>;
}
