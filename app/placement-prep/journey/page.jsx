import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, Clock3, Target } from "lucide-react";
import { getPlacementJourneyDashboard } from "@/actions/placement-modules";
import { formatPrepDate } from "@/lib/prep-date";
import SiteNav from "../components/site-nav";
import EngagementPreferences from "./engagement-preferences";

export default async function JourneyPage() {
  let data;
  try {
    data = await getPlacementJourneyDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!["Sign in with Nexora before continuing.", "Complete your student profile before continuing.", "Add and verify an email address in your Nexora account before continuing."].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Placement Tracking &amp; Engagement · Module 18</div><h1>Your placement journey, in one view.</h1><p className="lead">{message}</p><Link className="button button-primary" href="/placement-prep/profile">Complete student profile</Link></section></main></>;
  }
  return <><SiteNav /><main className="container">
    <section className="hero">
      <div className="eyebrow">Placement Tracking &amp; Engagement · Module 18</div>
      <h1>{data.name ? `${data.name}'s placement journey.` : "Your placement journey."}</h1>
      <p className="lead">A summary of saved records from your assessments, learning, practice, interviews, simulations, and job applications.</p>
      <div className="actions"><Link className="button button-primary" href="/placement-prep/modules">Choose your next module <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/placement-prep/dashboard">Workspace</Link></div>
    </section>
    <section className="section">
      <div className="grid grid-4 journey-stat-grid">
        <Metric label="Placement readiness" value={data.readiness === null ? "Not assessed" : `${data.readiness}%`} detail={data.readinessUpdatedAt ? `Updated ${formatPrepDate(data.readinessUpdatedAt)}` : "Complete an assessment analysis"} />
        <Metric label="Simulations" value={`${data.simulationsCompleted}/${data.simulationCount}`} detail="Completed / started" />
        <Metric label="Applications" value={data.openApplications} detail={`Open · ${data.applicationCount} total saved`} />
        <Metric label="Learning milestones" value={data.completedRoadmapSteps} detail="Completed in long-term roadmaps" />
        <Metric label="Activity streak" value={`${data.engagementStreak} days`} detail="Consecutive recent days with recorded activity" />
        <Metric label="Assessments" value={data.assessmentCount} detail="Saved assessment attempts" />
        <Metric label="Practice sets" value={data.practiceCount} detail="Saved practice attempts" />
        <Metric label="Completed interviews" value={data.interviewCount} detail="Saved AI interview sessions" />
        <Metric label="Preparation tasks" value={data.completedPreparationTasks} detail="Completed daily/weekly tasks" />
      </div>
    </section>
    <section className="section journey-columns">
      <article className="card">
        <div className="section-heading"><div><h2>In-app reminders &amp; next actions</h2><p>{data.preferences.inAppReminders ? `${data.preferences.reminderFrequency.toLowerCase()} view of open saved tasks and upcoming deadlines. Items without a due date remain visible.` : "In-app reminders are turned off in your preferences."}</p></div><CalendarClock className="icon" size={21} /></div>
        {data.nextActions.length ? <div className="journey-action-list">{data.nextActions.map((action, index) => <div className="journey-action-item" key={`${action.href}-${action.title}-${index}`}>
          <div><strong>{action.title}</strong><p>{action.detail}</p>{action.dueDate && <span className="helper">Due {formatPrepDate(action.dueDate)}</span>}</div>
          <Link className="module-link" href={action.href}>Open <ArrowRight size={14} /></Link>
        </div>)}</div> : <p className="helper">{data.preferences.inAppReminders ? "No open preparation tasks or upcoming application deadlines are recorded. Check your roadmap or add a job deadline." : "No reminders are shown. You can turn them back on in Reminder preferences."}</p>}
      </article>
      <article className="card">
        <div className="section-heading"><div><h2>Journey milestones</h2><p>Milestones are derived from completed records across your modules.</p></div><CheckCircle2 className="icon" size={21} /></div>
        {data.milestones.length ? <div className="journey-milestone-list">{data.milestones.map((milestone, index) => <div className="journey-milestone" key={`${milestone.type}-${milestone.title}-${index}`}><span className="journey-milestone-dot" /><div><strong>{milestone.title}</strong><p>{formatPrepDate(milestone.at)}</p></div></div>)}</div> : <p className="helper">Your saved milestones will appear here after you complete an assessment, learning milestone, simulation, or application stage.</p>}
      </article>
    </section>
    <section className="section">
      <div className="section-heading"><div><h2>Achievements</h2><p>Milestone badges are derived from saved activity and do not imply placement readiness.</p></div><CheckCircle2 className="icon" size={21} /></div>
      {data.achievements.length ? <div className="grid grid-3">{data.achievements.map((achievement) => <article className="card journey-achievement" key={achievement.title}><span className="badge">Earned</span><h3>{achievement.title}</h3><p>{achievement.detail}</p></article>)}</div> : <article className="card"><p>Complete a measurable activity to earn your first journey achievement.</p></article>}
    </section>
    <EngagementPreferences
      preferences={data.preferences}
      vapidPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY && process.env.WEB_PUSH_CONTACT && process.env.WEB_PUSH_ENCRYPTION_KEY ? process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY : ""}
    />
    <section className="section">
      <div className="section-heading"><div><h2>Assessment progress history</h2><p>Scores below are the historical assessment results; they are not the current Module 04 readiness score.</p></div><Target className="icon" size={21} /></div>
      {data.recentAssessments.length ? <article className="card journey-score-history">{data.recentAssessments.map((attempt) => <div className="journey-score-row" key={attempt.id}>
        <time>{formatPrepDate(attempt.completedAt)}</time><div className="progress"><span style={{ width: `${attempt.overallScore}%` }} /></div><strong>{attempt.overallScore}%</strong>
      </div>)}</article> : <article className="card"><p>No assessment history is saved yet.</p><Link className="module-link" href="/placement-prep/assessment">Take an assessment <ArrowRight size={14} /></Link></article>}
    </section>
    <section className="section">
      <div className="section-heading"><div><h2>Recent activity</h2><p>Read-only summaries linked to their source modules.</p></div><Clock3 className="icon" size={21} /></div>
      {data.activities.length ? <article className="card journey-activity-list">{data.activities.map((activity, index) => <div className="journey-activity-row" key={`${activity.type}-${activity.title}-${index}`}>
        <span className="badge">{activity.type}</span><strong>{activity.title}</strong><time>{formatPrepDate(activity.at)}</time><Link className="module-link" href={activity.href}>Open <ArrowRight size={14} /></Link>
      </div>)}</article> : <article className="card"><p>No activity has been recorded yet.</p></article>}
    </section>
    <section className="section">
      <div className="section-heading"><div><h2>Continue your journey</h2><p>Each module remains the source of truth for its detailed records.</p></div><BriefcaseBusiness className="icon" size={21} /></div>
      <div className="grid grid-4">
        <QuickLink href="/placement-prep/simulation" title="Placement simulation" text="Review attempt-based stage scores." />
        <QuickLink href="/placement-prep/learning" title="Learning roadmap" text="Continue sequenced career milestones." />
        <QuickLink href="/placement-prep/jobs" title="Resume & jobs" text="Review job matches and application statuses." />
        <QuickLink href="/placement-prep/integrity" title="Integrity report" text="Review saved monitoring events separately." />
      </div>
    </section>
  </main></>;
}

function Metric({ label, value, detail }) { return <article className="card"><p>{label}</p><div className="stat-value journey-stat-value">{value}</div><p className="helper">{detail}</p></article>; }
function QuickLink({ href, title, text }) { return <article className="card journey-quick-link"><h3>{title}</h3><p>{text}</p><Link className="module-link" href={href}>Open module <ArrowRight size={14} /></Link></article>; }
