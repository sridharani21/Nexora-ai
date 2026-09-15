import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { resumeJobModules } from "@/data/resume-job-modules";

export const metadata = {
  title: "Resume & Job Modules | Nexora AI",
  description:
    "Build, analyze, optimize, and use your resume to discover better job opportunities.",
};

export default function ResumeJobModulesPage() {
  return (
    <div className="px-4 sm:px-5">
      <div className="mb-8 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Career workspace
        </p>
        <h1 className="gradient-title text-4xl font-bold sm:text-5xl">
          Resume & Job Modules
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Everything you need to turn your experience into a stronger application
          and find roles that fit your goals.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {resumeJobModules.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.href}
              className="flex h-full flex-col gap-0 border transition-colors duration-300 hover:border-primary"
            >
              <CardContent className="flex flex-1 flex-col pb-4 pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mb-2 text-xl font-bold">{module.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {module.description}
                </p>
              </CardContent>
              <CardFooter className="pb-6 pt-0">
                <Button asChild className="w-full">
                  <Link href={module.href}>
                    {module.action}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
