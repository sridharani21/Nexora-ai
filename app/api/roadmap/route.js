import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const { career, months } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
    });

    const prompt = `
Create a learning roadmap for becoming a ${career}.

Duration: ${months} months.

Return ONLY JSON in this format:

{
 "months":[
  {
   "month":1,
   "weeks":[
    {"week":1,"topics":["topic1","topic2"]},
    {"week":2,"topics":["topic1","topic2"]}
   ]
  }
 ]
}

Rules:
- 4 weeks per month
- 2-3 topics per week
- Return JSON only
`;

    const result = await model.generateContent(prompt);

    let text = await result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const roadmap = JSON.parse(text);

    return Response.json({ roadmap });
  } catch (err) {
    console.error("Gemini roadmap generation error:", err);

    // Graceful fallback if quota exceeded or API fails
    return Response.json({
      roadmap: null,
      error:
        err.message.includes("429") 
          ? "Gemini API quota exceeded. Try again later." 
          : "Failed to generate roadmap."
    });
  }
}