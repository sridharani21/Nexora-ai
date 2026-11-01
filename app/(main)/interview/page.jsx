import { getAssessments } from "@/actions/interview";
import StatsCards from "./_components/stats-cards";

import QuizList from "./_components/quiz-list";
import PerformanceChart from "./_components/performance-chart";

export default async function InterviewPrepPage() {
  const assessments = await getAssessments();

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold gradient-title sm:text-4xl lg:text-6xl">
          Interview Preparation
        </h1>
      </div>
      <div className="space-y-6">
        <StatsCards assessments={assessments} />
        <PerformanceChart assessments={assessments} />
        <QuizList assessments={assessments} />
      </div>
    </div>
  );
}