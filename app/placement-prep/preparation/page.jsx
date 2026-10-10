import Link from "next/link";
import { generatePreparationPlan, getPreparationPlans } from "@/actions/prep-preparation";
import { getPracticeAccess } from "@/actions/prep-practice";
import SiteNav from "../components/site-nav";
import PreparationActions from "./preparation-actions";
import PreparationPlan from "./preparation-plan";

export default async function PreparationPage() {
  const plans = await getPreparationPlans();
  const practiceAccess = await getPracticeAccess();
  return <><SiteNav /><main className="container">{plans?.length ? <PreparationPlan plans={plans} practiceAllowed={practiceAccess.allowed} /> : <section className="hero"><div className="eyebrow">Personalized preparation</div><h1>Your readiness gaps become a plan.</h1><p className="lead">Generate a practical weekly sequence of learning, practice, revision, and remedial tasks based on your current skill analysis.</p><PreparationActions action={generatePreparationPlan} label="Create my preparation plan" planning /><Link className="button button-secondary" href="/placement-prep/readiness">Back to readiness</Link></section>}</main></>;
}
