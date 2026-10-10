import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPlacementOfficerReviewQueue } from "@/actions/placement-modules";
import SiteNav from "../../components/site-nav";
import ReviewConsole from "../review-console";

export default async function IntegrityReviewPage() {
  let queue;
  try {
    queue = await getPlacementOfficerReviewQueue();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (![
      "Sign in with an authorized placement-officer account.",
      "Placement-officer access is not configured. Set PLACEMENT_OFFICER_EMAILS to a comma-separated allowlist of verified staff emails.",
      "This account is not authorized to access placement-officer reviews.",
    ].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Restricted staff workspace · Integrity review</div><h1>Placement officer access required.</h1><p className="lead">{message}</p><p className="helper">Set PLACEMENT_OFFICER_EMAILS in the server environment to a comma-separated list of verified staff email addresses, then restart or redeploy the app.</p><Link className="button button-secondary" href="/placement-prep/integrity"><ArrowLeft size={15} /> Return to integrity report</Link></section></main></>;
  }
  return <><SiteNav /><ReviewConsole assessments={queue.assessments} interviews={queue.interviews} /></>;
}
