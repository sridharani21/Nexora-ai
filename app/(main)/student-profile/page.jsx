import { redirect } from "next/navigation";
import { getAuthenticatedStudent } from "@/lib/student-profile-server";
import { studentProfileSchema } from "@/lib/student-profile";
import { StudentProfileForm } from "./student-profile-form";

export default async function StudentProfilePage() {
  const student = await getAuthenticatedStudent();
  if (!student) redirect("/sign-in?redirect_url=%2Fstudent-profile");
  const parsedProfile = studentProfileSchema.safeParse(student.profile?.profileData ?? {});

  return (
    <StudentProfileForm
      initialName={student.name || ""}
      email={student.email}
      initialProfile={parsedProfile.success ? parsedProfile.data : studentProfileSchema.parse({})}
    />
  );
}
