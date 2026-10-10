import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPlacementProfile } from "@/actions/placement-journey";
import PlacementProfileForm from "./placement-profile-form";

export const metadata = {
  title: "Start Your Placement Journey | Nexora AI",
  description: "Create your persistent placement preparation profile.",
};

export default async function PlacementJourneyPage({ searchParams }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getPlacementProfile();
  const params = await searchParams;
  const isEditing = params?.edit === "true";

  if (data.journey?.profile?.profileCompleted && !isEditing) {
    redirect("/placement-dashboard");
  }

  return <PlacementProfileForm {...data} />;
}
