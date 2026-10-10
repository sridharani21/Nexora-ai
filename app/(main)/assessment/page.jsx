import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AssessmentFlow from "./_components/assessment-flow";

export const metadata = {
  title: "Placement Readiness Assessment | Nexora AI",
  description:
    "Measure your placement readiness and discover a personalized career preparation path.",
};

export default async function AssessmentPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <AssessmentFlow />;
}
