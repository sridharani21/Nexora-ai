import Link from "next/link";
import { ArrowRight, BrainCircuit, BriefcaseBusiness, MessageSquareText, Target, UserRound } from "lucide-react";
import { getCurrentProfile } from "@/actions/prep-profile";
import SiteNav from "../components/site-nav";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const hasProfile = Boolean(profile?.fullName);
  const hasAssessment = Boolean(profile?.assessments?.length);
  const latestPlan = profile?.preparationPlans?.[0];
  const sequencePlans = latestPlan?.sequenceId
    ? profile.preparationPlans.filter((plan) => plan.sequenceId === latestPlan.sequenceId)
    : latestPlan ? [latestPlan] : [];
  const allWeeksComplete = Boolean(
    latestPlan &&
    sequencePlans.length >= latestPlan.totalWeeks &&
    sequencePlans.every((plan) => plan.tasks.length > 0 && plan.tasks.every((task) => task.status === "COMPLETED"))
  );
  const modulesComplete = Boolean(hasProfile && profile.email && hasAssessment && profile.readiness && allWeeksComplete);
  return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Your placement workspace</div><h1>{hasProfile ? `Welcome, ${profile.fullName}.` : "Your placement workspace starts here."}</h1><p className="lead">{hasProfile ? "Your Nexora account is linked. Continue through assessment and readiness analysis." : "Start by creating your profile using the email from your Nexora sign-in."}</p><div className="actions"><Link className="button button-primary" href={hasProfile ? "/placement-prep/assessment" : "/placement-prep/profile"}>{hasProfile ? "Start assessment" : "Complete profile"} <ArrowRight size={17} /></Link>{hasAssessment && <Link className="button button-secondary" href="/placement-prep/readiness">{profile.readiness ? "View readiness analysis" : "Generate readiness analysis"} <Target size={17} /></Link>}{profile?.readiness && <Link className="button button-secondary" href="/placement-prep/preparation">Start preparation <ArrowRight size={17} /></Link>}{modulesComplete && <Link className="button button-secondary" href="/placement-prep/practice">Open Practice Center <BrainCircuit size={17} /></Link>}{hasProfile && <Link className="button button-secondary" href="/placement-prep/levels">Open Adaptive Learning <Target size={17} /></Link>}{hasProfile && <Link className="button button-secondary" href="/placement-prep/dsa">DSA &amp; Coding <ArrowRight size={17} /></Link>}{hasProfile && <Link className="button button-secondary" href="/placement-prep/company-prep">Company preparation <ArrowRight size={17} /></Link>}{hasProfile && <Link className="button button-secondary" href="/placement-prep/interview">AI Interview <MessageSquareText size={17} /></Link>}{hasProfile && <Link className="button button-secondary" href="/placement-prep/simulation">Placement Simulation <ArrowRight size={17} /></Link>}{hasProfile && <Link className="button button-secondary" href="/placement-prep/journey">My placement journey <ArrowRight size={17} /></Link>}{hasProfile && <Link className="button button-secondary" href="/placement-prep/jobs">Resume &amp; jobs <BriefcaseBusiness size={17} /></Link>}</div>{!modulesComplete && <p className="helper">Practice Center access opens after your profile, assessment, readiness analysis, and preparation tasks are complete.</p>}</section><section className="section"><div className="grid grid-3"><Stat icon={UserRound} value={hasProfile ? "Saved" : "Pending"} label="Student profile" /><Stat icon={BrainCircuit} value={hasAssessment ? "Updated" : "Not started"} label="Assessment evidence" /><Stat icon={Target} value={profile?.assessments?.[0] ? `${profile.assessments[0].overallScore} / 100` : "0 / 100"} label="Latest placement score" /></div></section></main></>;
}

function Stat({ icon: Icon, value, label }) { return <article className="card"><Icon className="icon" size={22} /><div className="stat-value">{value}</div><p>{label}</p></article>; }
