export function toStudentQuestion(question) {
  const {
    correctOption,
    explanation,
    evaluationCriteria,
    solution,
    privateTestCases,
    ...publicQuestion
  } = question;
  return {
    ...publicQuestion,
    publicTestCases: publicQuestion.publicTestCases?.map(({ input, expectedOutput }) => ({
      input,
      expectedOutput,
    })),
  };
}
