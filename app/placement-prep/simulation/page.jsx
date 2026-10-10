import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { getPlacementSimulationDashboard } from "@/actions/placement-simulation";
import SiteNav from "../components/site-nav";
import SimulationDashboard from "./simulation-dashboard";

export default async function SimulationPage() {
  let data;
  try {
    data = await getPlacementSimulationDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (![
      "Sign in with Nexora before continuing.",
      "Complete your student profile before continuing.",
      "Add and verify an email address in your Nexora account before continuing.",
    ].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero">
      <div className="eyebrow">Placement Simulation · Module 14</div>
      <h1>Experience a complete placement process.</h1>
      <p className="lead">{message}</p>
      <div className="actions">
        <Link className="button button-primary" href="/placement-prep/profile">Complete profile <ArrowRight size={16} /></Link>
        <Link className="button button-secondary" href="/placement-prep/dashboard">Back to workspace</Link>
      </div>
    </section></main></>;
  }

  return <><SiteNav /><main className="container"><SimulationDashboard data={data} /></main></>;
}
