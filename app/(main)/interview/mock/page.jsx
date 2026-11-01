import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Quiz from "../_components/quiz";

export default async function MockInterviewPage({ searchParams }) {
  const params = await searchParams;
  const role = typeof params?.role === "string" ? params.role.slice(0, 120) : "";
  return (
    <div className="container mx-auto min-w-0 space-y-4 px-4 py-6 sm:px-6">
      <div className="flex min-w-0 flex-col space-y-2">
        <Link href="/interview">
          <Button variant="link" className="gap-2 pl-0">
            <ArrowLeft className="h-4 w-4" />
            Back to Interview Preparation
          </Button>
        </Link>

        <div>
          <h1 className="break-words text-3xl font-bold gradient-title sm:text-4xl lg:text-6xl">Mock Interview</h1>
          <p className="break-words text-muted-foreground">
            {role ? `Practice interview questions for ${role}` : "Test your knowledge with industry-specific questions"}
          </p>
        </div>
      </div>

      <Quiz targetRole={role} />
    </div>
  );
}