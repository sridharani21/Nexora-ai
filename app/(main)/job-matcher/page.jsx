import ResumeJobTool from "@/components/resume-job-tool";
export const metadata = { title: "Job Matcher | Nexora AI" };
export default function JobMatcherPage() {
  return <div className="px-4 sm:px-5"><ResumeJobTool tool="matcher" /></div>;
}
