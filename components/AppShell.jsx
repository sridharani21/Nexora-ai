"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import CareerChatWidget from "@/components/CareerChatWidget";

export default function AppShell({ header, children }) {
  const pathname = usePathname();
  const isCareerChat = pathname?.startsWith("/career-chat");

  useEffect(() => {
    if (!isCareerChat) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [isCareerChat]);

  return (
    <>
      {header}
      <main className={isCareerChat ? undefined : "min-h-screen"}>{children}</main>
      {!isCareerChat && (
        <footer className="bg-muted/50 py-12">
          <div className="container mx-auto px-4 text-center text-gray-200">
            <p>Nexora AI — Your trusted AI career companion.</p>
            <CareerChatWidget />
          </div>
        </footer>
      )}
    </>
  );
}
