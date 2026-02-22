"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import { format } from "date-fns";

export default function PerformanceChart({ assessments }) {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (assessments) {
      const formattedData = assessments.map((assessment, idx) => ({
        idx,
        date: format(new Date(assessment.createdAt), "MMM dd"),
        score: assessment.quizScore,
        fullDate: format(new Date(assessment.createdAt), "MMM dd, HH:mm"),
      }));
      setChartData(formattedData);
    }
  }, [assessments]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="gradient-title text-3xl md:text-4xl">
          Performance Trend
        </CardTitle>
        <CardDescription>Your quiz scores over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="idx"
                interval={0}
                height={40}
                padding={{ right: 30 }}
                tickFormatter={i => chartData[i]?.date || ''}
              />
              <YAxis domain={[0, 100]} />
              <Tooltip
                formatter={value => [`${value}%`, "Score"]}
                labelFormatter={(_, payload) =>
                  `Date: ${payload && payload[0] ? payload[0].payload.fullDate : ''}`
                }
                contentStyle={{
                  background: "#18181b",
                  borderRadius: 8,
                  border: "1px solid #333",
                }}
                itemStyle={{ color: "#fff" }}
              />
             <Line
  type="monotone"
  dataKey="score"
  stroke="#ffffff" // Change this to a visible color like #3b82f6 or #ffffff
  strokeWidth={2}
  connectNulls={true}
  dot={{ r: 5, fill: "#ffffff", strokeWidth: 0 }}
  activeDot={{ r: 8 }}
  isAnimationActive={true}
/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}