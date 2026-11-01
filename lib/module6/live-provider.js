export const GEMINI_LIVE_MODEL = "gemini-3.8-live";

export function buildLiveTokenConfig(session, now = Date.now()) {
  const questionList = Array.isArray(session.questions)
    ? session.questions.filter((question) => typeof question?.question === "string")
    : [];
  const questions = questionList.length
    ? questionList.map((question, index) => `${index + 1}. ${question.question}`).join("\n")
    : "";
  const answered = new Set((Array.isArray(session.answers) ? session.answers : []).map((answer) => answer.questionId));
  const nextQuestion = questionList.findIndex((question) => !answered.has(question.id));
  const systemInstruction = [
    "You are a supportive, professional mock interviewer. Conduct a spoken interview in English.",
    `Career: ${session.careerTitle}. Interview type: ${session.interviewType}. Difficulty: ${session.difficulty}. Focus: ${session.profileSnapshot?.interviewFocus || "job readiness"}.`,
    "Ask one question at a time, listen to the entire spoken response, and give a brief natural acknowledgement.",
    "Ask at most one relevant follow-up when the response is unclear or invites useful detail. Start its spoken wording with 'To follow up,'. Do not invent candidate experience.",
    "Use the provided question list as the interview outline, adapt follow-ups to answers, and do not reveal scores during the interview.",
    "Keep the interview within its configured duration. Do not make hiring predictions or claim that practice feedback certifies skill.",
    nextQuestion >= 0
      ? `Previously answered question IDs: ${[...answered].join(", ") || "none"}. Resume with question ${nextQuestion + 1}; do not repeat earlier questions.`
      : "All outline questions have already been answered. Thank the candidate and close the interview.",
    "After the last outline question, briefly close the interview instead of asking more practice questions.",
    "Question outline:\n" + questions,
  ].join("\n\n");

  return {
    uses: 1,
    expireTime: new Date(now + 60 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
    liveConnectConstraints: {
      model: GEMINI_LIVE_MODEL,
      config: {
        responseModalities: ["AUDIO"],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: {},
        systemInstruction: { parts: [{ text: systemInstruction }] },
      },
    },
  };
}
