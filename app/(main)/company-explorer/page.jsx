import ResumeJobTool from "@/components/resume-job-tool";
export const metadata = { title: "Company Explorer | Nexora AI" };
export default function CompanyExplorerPage() {
  return <div className="px-4 sm:px-5"><ResumeJobTool tool="company" /></div>;
}
