import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { growthTools } from "@/data/growth-tools";

export const metadata = {
  title: "Growth Tools | Nexora AI",
  description: "Explore resume, interview, roadmap, courses, and other career growth tools.",
};

export default function GrowthToolsPage() {
  return (
    <div className="px-4 sm:px-5">
      <div className="mb-8 sm:mb-10">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold gradient-title">
          Growth Tools
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mt-1">
          Everything you need to grow your career — pick a tool and get started.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {growthTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.href}
              className="border hover:border-primary transition-colors duration-300 flex flex-col h-full py-0 gap-0"
            >
              <CardContent className="pt-6 pb-4 flex-1 flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">{tool.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {tool.description}
                </p>
              </CardContent>
              <CardFooter className="pb-6 pt-0">
                <Button asChild className="w-full">
                  <Link href={tool.href}>
                    {tool.action}
                    <ArrowRight className="w-4 h-4" />
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
