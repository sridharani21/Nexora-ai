import { redirect } from "next/navigation";

export const metadata = {
  title: "Career Explorer | Nexora AI",
  description: "Explore career paths using your profile and completed assessments.",
};

export default function CareerDiscoveryPage() {
  redirect("/career-explorer");
}
