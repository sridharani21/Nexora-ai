import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CareerChatbot from "@/components/CareerChatbot";

export const metadata = {
  title: "Career Guidance | Nexora AI",
  description: "AI-powered career guidance — paths, skills, resume review & more.",
};

// This tells Next.js NOT to use the root layout (removes your Nexora navbar)
// so the chatbot takes the full screen
export default async function CareerChatPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  const userInfo = {
    clerkUserId: userId,
    name: user?.firstName || user?.username || "there",
    initials: ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "ME",
    imageUrl: user?.imageUrl || null,
  };

  return <CareerChatbot userInfo={userInfo} />;
}