import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Clock, BarChart, Search } from "lucide-react";

const platformColors = {
  Coursera: "bg-blue-100 text-blue-700",
  Udemy: "bg-purple-100 text-purple-700",
  "Great Learning": "bg-green-100 text-green-700",
  YouTube: "bg-red-100 text-red-700",
  "LinkedIn Learning": "bg-sky-100 text-sky-700",
  Pluralsight: "bg-pink-100 text-pink-700",
  freeCodeCamp: "bg-yellow-100 text-yellow-700",
  "MIT OpenCourseWare": "bg-orange-100 text-orange-700",
  default: "bg-gray-100 text-gray-700",
};

const platformSearchUrls = {
  Coursera: (title) => `https://www.coursera.org/search?query=${encodeURIComponent(title)}`,
  Udemy: (title) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(title)}`,
  YouTube: (title) => `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`,
  "Great Learning": (title) => `https://www.mygreatlearning.com/academy/search?q=${encodeURIComponent(title)}`,
  "LinkedIn Learning": (title) => `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(title)}`,
  Pluralsight: (title) => `https://www.pluralsight.com/search?q=${encodeURIComponent(title)}`,
  freeCodeCamp: () => `https://www.freecodecamp.org/learn`,
  "MIT OpenCourseWare": (title) => `https://ocw.mit.edu/search/?q=${encodeURIComponent(title)}`,
};

export default function CourseCard({ course, type }) {
  const colorClass = platformColors[course.platform] || platformColors.default;

  const handleCourseClick = () => {
    // Open direct URL first
    window.open(course.url, "_blank");
  };

  const handleSearchClick = () => {
    // Fallback: search on platform
    const searchFn = platformSearchUrls[course.platform];
    const searchUrl = searchFn
      ? searchFn(course.title)
      : `https://www.google.com/search?q=${encodeURIComponent(course.title + " " + course.platform)}`;
    window.open(searchUrl, "_blank");
  };

  return (
    <Card className="hover:shadow-md transition-shadow border border-gray-200 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">
            {course.title}
          </CardTitle>
          <Badge className={`text-xs shrink-0 ${colorClass}`}>
            {course.platform}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex flex-col flex-1">
        <p className="text-xs text-muted-foreground flex-1">{course.topic}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BarChart className="w-3 h-3" />
            {course.level}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {course.duration}
          </span>
          {type === "paid" && course.price && (
            <span className="font-semibold text-green-600">{course.price}</span>
          )}
          {type === "free" && (
            <span className="font-semibold text-green-600">Free</span>
          )}
        </div>
        {/* Two buttons: direct link + search fallback */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleCourseClick}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open Course
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs px-2"
            onClick={handleSearchClick}
            title="Search on platform if link doesn't work"
          >
            <Search className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}