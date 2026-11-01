import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getModule4Dashboard } from "@/actions/module4-careers";
import CareerExplorerDashboard from "./_components/career-explorer-dashboard";

export const metadata = {
  title: "Career Explorer | Nexora AI",
  description: "Explore career paths using your profile and completed assessments.",
};

export default async function CareerExplorerPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const data = await getModule4Dashboard();
  return <CareerExplorerDashboard initialData={data} />;
}
