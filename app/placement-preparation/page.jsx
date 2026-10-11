import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPlacementPreparation } from "@/actions/placement-preparation";
import PreparationPlan from "./preparation-plan";

export const metadata = {
  title: "Preparation Plan | Nexora AI",
  description: "Follow an adaptive daily placement preparation plan.",
};

export default async function PlacementPreparationPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let data;
  try {
    data = await getPlacementPreparation();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Complete your placement profile")) {
      redirect("/");
    }
    throw error;
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <Link href="/placement-dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Placement dashboard</Link>
        <p className="pt-2 text-sm font-medium text-primary">Module 4 · Personalized preparation engine</p>
        <h1 className="gradient-title text-4xl font-bold">Your adaptive preparation plan</h1>
        <p className="text-muted-foreground">Daily learning tasks and practice goals are prioritised from your readiness gaps.</p>
      </div>
      <PreparationPlan plan={data.plan} report={data.report} />
    </main>
  );
}
