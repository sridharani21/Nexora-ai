import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function PlacementDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  redirect("/placement-workspace");
}
