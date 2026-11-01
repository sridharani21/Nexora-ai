import { redirect } from "next/navigation";
import { getAuthenticatedStudent } from "@/lib/student-profile-server";
import { studentProfileSchema } from "@/lib/student-profile";

export default async function StartPrepPage() {
  const student = await getAuthenticatedStudent();
  if (!student) redirect("/student-profile");

  const savedProfile = studentProfileSchema.safeParse(student.profile?.profileData ?? {});
  const hasCompletedProfile = savedProfile.success && student.profile?.profileData != null;

  redirect(hasCompletedProfile ? "/dashboard" : "/student-profile");
}
