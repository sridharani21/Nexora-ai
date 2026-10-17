export const PLACEMENT_ASSESSMENT_SECTIONS = [
  {
    id: "interest",
    title: "Career interests",
    description: "Choose the direction that best matches what you enjoy.",
    type: "single",
    questions: [
      {
        id: "interest-work",
        prompt: "Which kind of work sounds most engaging?",
        options: [
          { value: "builder", label: "Building applications and user experiences" },
          { value: "analyst", label: "Analysing data and finding patterns" },
          { value: "systems", label: "Designing reliable systems and infrastructure" },
          { value: "security", label: "Protecting systems and investigating risks" },
        ],
      },
      {
        id: "interest-problem",
        prompt: "Which problem would you most like to solve?",
        options: [
          { value: "builder", label: "Make a product easier and more useful" },
          { value: "analyst", label: "Turn confusing information into insights" },
          { value: "systems", label: "Make a service faster and more dependable" },
          { value: "security", label: "Find and prevent weaknesses before they are abused" },
        ],
      },
    ],
  },
  {
    id: "aptitude",
    title: "Aptitude",
    description: "Check your numerical and logical reasoning foundation.",
    type: "single",
    questions: [
      {
        id: "aptitude-percentage",
        prompt: "A product priced at ₹800 is discounted by 15%. What is the sale price?",
        options: [
          { value: "₹680", label: "₹680" },
          { value: "₹700", label: "₹700" },
          { value: "₹720", label: "₹720" },
          { value: "₹740", label: "₹740" },
        ],
        answer: "₹680",
      },
      {
        id: "aptitude-sequence",
        prompt: "What number comes next: 2, 6, 12, 20, 30, ?",
        options: [
          { value: "36", label: "36" },
          { value: "40", label: "40" },
          { value: "42", label: "42" },
          { value: "44", label: "44" },
        ],
        answer: "42",
      },
    ],
  },
  {
    id: "technical",
    title: "Technical foundation",
    description: "Measure your core computer science understanding.",
    type: "single",
    questions: [
      {
        id: "technical-http",
        prompt: "Which HTTP method is normally used to create a new resource?",
        options: [
          { value: "get", label: "GET" },
          { value: "post", label: "POST" },
          { value: "put", label: "PUT" },
          { value: "head", label: "HEAD" },
        ],
        answer: "post",
      },
      {
        id: "technical-index",
        prompt: "What is the primary purpose of a database index?",
        options: [
          { value: "retrieve", label: "Speed up data retrieval" },
          { value: "encrypt", label: "Encrypt every database value" },
          { value: "backup", label: "Replace database backups" },
          { value: "delete", label: "Delete duplicate tables" },
        ],
        answer: "retrieve",
      },
    ],
  },
  {
    id: "dsa",
    title: "DSA foundation",
    description: "Measure your current problem-solving and data-structure foundation.",
    type: "single",
    questions: [
      {
        id: "dsa-queue",
        prompt: "Which data structure follows first-in, first-out order?",
        options: [
          { value: "stack", label: "Stack" },
          { value: "queue", label: "Queue" },
          { value: "tree", label: "Tree" },
          { value: "heap", label: "Heap" },
        ],
        answer: "queue",
        difficulty: "foundation",
      },
      {
        id: "dsa-complexity",
        prompt: "What is the average lookup complexity of a hash table?",
        options: [
          { value: "constant", label: "O(1)" },
          { value: "log", label: "O(log n)" },
          { value: "linear", label: "O(n)" },
          { value: "quadratic", label: "O(n²)" },
        ],
        answer: "constant",
        difficulty: "intermediate",
      },
    ],
  },
  {
    id: "coding",
    title: "Coding approach",
    description: "Understand how you approach programming problems.",
    type: "single",
    questions: [
      {
        id: "coding-breakdown",
        prompt: "What is the strongest first step when solving an unfamiliar coding problem?",
        options: [
          { value: "breakdown", label: "Clarify requirements, break it down, and test assumptions" },
          { value: "guess", label: "Write the first solution that comes to mind" },
          { value: "copy", label: "Copy a solution without understanding it" },
          { value: "avoid", label: "Skip edge cases until after submission" },
        ],
        answer: "breakdown",
      },
      {
        id: "coding-complexity",
        prompt: "Why should you consider time complexity?",
        options: [
          { value: "scale", label: "To understand how the solution behaves as input grows" },
          { value: "style", label: "To make variable names shorter" },
          { value: "design", label: "To avoid writing any tests" },
          { value: "syntax", label: "To replace syntax validation" },
        ],
        answer: "scale",
        difficulty: "foundation",
      },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    description: "Evaluate workplace communication and collaboration habits.",
    type: "single",
    questions: [
      {
        id: "communication-blocked",
        prompt: "You are blocked by a technical issue. What is the best response?",
        options: [
          { value: "hide", label: "Hide the problem until someone notices" },
          { value: "ask", label: "Document what you tried and ask for focused help" },
          { value: "stop", label: "Stop working on the task permanently" },
          { value: "blame", label: "Blame another teammate" },
        ],
        answer: "ask",
      },
      {
        id: "communication-explain",
        prompt: "How should you explain a technical decision to a non-technical stakeholder?",
        options: [
          { value: "jargon", label: "Use as much technical jargon as possible" },
          { value: "outcome", label: "Explain the trade-off and expected business outcome clearly" },
          { value: "avoid", label: "Avoid explaining the decision" },
          { value: "code", label: "Only share the source code" },
        ],
        answer: "outcome",
        difficulty: "foundation",
      },
    ],
  },
];

export const ASSESSMENT_QUESTION_COUNT = PLACEMENT_ASSESSMENT_SECTIONS.reduce(
  (total, section) => total + section.questions.length,
  0
);
