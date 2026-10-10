import ProfileForm from "./profile-form";
import { getCurrentProfile } from "@/actions/prep-profile";
import { getPrepClerkIdentity } from "@/lib/prep-student-profile";
import { redirect } from "next/navigation";
import SiteNav from "../components/site-nav";

export default async function ProfilePage() {
  const identity = await getPrepClerkIdentity();
  if (!identity) redirect("/sign-in?redirect_url=%2Fplacement-prep%2Fprofile");
  const profile = await getCurrentProfile();
  return <><SiteNav /><ProfileForm initialProfile={profile} defaultEmail={identity.email} defaultName={identity.fullName} /></>;
}
