import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  createPlacementPracticeQuestionSet,
  getPracticeCenter,
} from "@/actions/placement-practice";
import PracticeCenter from "./practice-center";

export const metadata = {
  title: "Assessment & Practice Center | Nexora AI",
  description: "Practise placement topics with timed and company-pattern options.",
};

export default async function PlacementPracticePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let data;
  try {
    data = await getPracticeCenter();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Complete your placement profile")) {
      redirect("/");
    }
    throw error;
  }

  let initialQuestionSet = null;
  let initialQuestionError = null;
  try {
    initialQuestionSet = await createPlacementPracticeQuestionSet(data.topics[0]?.id);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    initialQuestionError = error.message;
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <Link href="/placement-dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Placement dashboard</Link>
        <p className="pt-2 text-sm font-medium text-primary">Module 5 · Assessment & practice center</p>
        <h1 className="gradient-title text-4xl font-bold">Practise what matters for your placement</h1>
        <p className="text-muted-foreground">Choose a topic, work through a focused set, and keep your mistakes ready for future intelligent analysis.</p>
      </div>
      <PracticeCenter
        topics={data.topics}
        initialQuestionSet={initialQuestionSet}
        initialQuestionError={initialQuestionError}
        attempts={data.attempts}
        profile={data.profile}
      />
    </main>
  );
}
