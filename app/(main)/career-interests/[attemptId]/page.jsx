import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getRiasecAttempt } from "@/actions/module3-riasec";
import RiasecQuestionnaire from "../_components/riasec-questionnaire";

export const metadata = {
  title: "RIASEC Assessment | Nexora AI",
  description: "Explore six areas of career interest at your own pace.",
};

export default async function RiasecAttemptPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { attemptId } = await params;
  const attempt = await getRiasecAttempt(attemptId);
  if (!attempt) notFound();
  if (attempt.status === "COMPLETE") redirect(`/career-interests/${attemptId}/results`);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <RiasecQuestionnaire attempt={attempt} />
    </main>
  );
}
