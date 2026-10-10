import { getAssessmentAccess } from "@/actions/prep-integrity";
import AssessmentClient from "./assessment-client";

export default async function AssessmentPage() {
  const access = await getAssessmentAccess().catch(() => ({ allowed: false, lockedUntil: null }));
  return <AssessmentClient access={access} />;
}
