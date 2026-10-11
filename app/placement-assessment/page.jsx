import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  createPlacementAssessmentQuestionSet,
  getPlacementAssessment,
} from "@/actions/placement-assessment";
import PlacementAssessmentFlow from "./placement-assessment-flow";

export const metadata = {
  title: "Career & Interest Assessment | Nexora AI",
  description: "Discover your career direction and placement foundation.",
};

export default async function PlacementAssessmentPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let data;
  try {
    data = await getPlacementAssessment();
  } catch (error) {
    if (error.message.includes("Complete your placement profile")) {
      redirect("/");
    }
    throw error;
  }

  const questionSet = await createPlacementAssessmentQuestionSet();
  return (
    <PlacementAssessmentFlow
      latest={data.latest}
      careerTwin={data.careerTwin}
      questionSet={questionSet}
    />
  );
}
