import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPlacementSimulation } from "@/actions/placement-simulation";
import SiteNav from "../../components/site-nav";
import SimulationSession from "./simulation-session";

export default async function SimulationSessionPage({ params }) {
  const { simulationId } = await params;
  let simulation;
  try {
    simulation = await getPlacementSimulation(simulationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!["Simulation not found.", "Sign in with Nexora before continuing.", "Complete your student profile before continuing.", "Add and verify an email address in your Nexora account before continuing."].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Placement Simulation · Module 14</div><h1>Simulation unavailable.</h1><p className="lead">{message}</p><Link className="button button-secondary" href="/placement-prep/simulation"><ArrowLeft size={16} /> Back to simulations</Link></section></main></>;
  }
  return <><SiteNav /><main className="container"><SimulationSession simulation={simulation} /></main></>;
}
