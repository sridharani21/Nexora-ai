export const ASSESSMENT_SECTIONS = [
  {
    id: "interest",
    title: "Career interests",
    description: "Interest is measured separately from correctness so recommendations combine motivation with demonstrated skill.",
    questions: [
      { id: "interest-work", prompt: "Which work sounds most engaging?", options: [["builder", "Building products and applications"], ["analyst", "Finding patterns in data"], ["systems", "Designing reliable infrastructure"], ["security", "Investigating and preventing risks"]] },
      { id: "interest-problem", prompt: "Which problem would you most like to solve?", options: [["builder", "Make a product easier to use"], ["analyst", "Turn information into insights"], ["systems", "Make a service faster and more reliable"], ["security", "Find weaknesses before they are abused"]] },
      { id: "interest-project", prompt: "Which project would you choose for a semester?", options: [["builder", "A web or mobile product"], ["analyst", "A dashboard that explains data"], ["systems", "A scalable deployment platform"], ["security", "A secure application audit"]] },
    ],
  },
  {
    id: "aptitude",
    title: "Aptitude and reasoning",
    description: "Numerical reasoning, probability, logic, sequences, and algorithmic pseudocode used in placement screening.",
    questions: [
      { id: "aptitude-easy-percent", difficulty: "easy", prompt: "A product priced at 800 is discounted by 15%. What is the sale price?", answer: "680", options: [["680", "680"], ["700", "700"], ["720", "720"], ["740", "740"]] },
      { id: "aptitude-easy-ratio", difficulty: "easy", prompt: "The ratio of developers to testers is 3:2. In a team of 25, how many are developers?", answer: "15", options: [["10", "10"], ["12", "12"], ["15", "15"], ["18", "18"]] },
      { id: "aptitude-medium-sequence", difficulty: "medium", prompt: "What number comes next: 2, 6, 12, 20, 30, ?", answer: "42", options: [["36", "36"], ["40", "40"], ["42", "42"], ["44", "44"]] },
      { id: "aptitude-medium-probability", difficulty: "medium", prompt: "A bag has 3 red and 2 blue tokens. What is the probability of drawing a blue token?", answer: "2/5", options: [["1/5", "1/5"], ["2/5", "2/5"], ["1/2", "1/2"], ["3/5", "3/5"]] },
      { id: "aptitude-hard-pseudocode", difficulty: "hard", prompt: "What does this return? `total = 0; FOR i = 1 TO 5: IF i MOD 2 = 1: total = total + i; RETURN total`", answer: "9", options: [["6", "6"], ["8", "8"], ["9", "9"], ["15", "15"]] },
      { id: "aptitude-hard-work", difficulty: "hard", prompt: "A can finish a task in 12 days and B in 18 days. Working together, how long do they take?", answer: "36/5", options: [["5 days", "5 days"], ["6 days", "6 days"], ["36/5 days", "36/5 days"], ["9 days", "9 days"]] },
    ],
  },
  {
    id: "programming",
    title: "Programming fundamentals",
    description: "Variables, control flow, debugging, recursion, testing, abstraction, and code-quality judgment.",
    questions: [
      { id: "programming-easy-loop", difficulty: "easy", prompt: "Which construct repeats a block while a condition remains true?", answer: "while", options: [["if", "if"], ["while", "while"], ["switch", "switch"], ["class", "class"]] },
      { id: "programming-easy-debug", difficulty: "easy", prompt: "What is the best first step when debugging a failing function?", answer: "reproduce", options: [["rewrite", "Rewrite everything"], ["reproduce", "Reproduce the failure with a small case"], ["ignore", "Ignore the error"], ["deploy", "Deploy it again"]] },
      { id: "programming-medium-complexity", difficulty: "medium", prompt: "Why should you consider time complexity?", answer: "scale", options: [["style", "To shorten variable names"], ["scale", "To understand behavior as input grows"], ["syntax", "To replace syntax checks"], ["tests", "To avoid testing"]] },
      { id: "programming-medium-recursion", difficulty: "medium", prompt: "What must a correct recursive function have to avoid infinite recursion?", answer: "base", options: [["global", "A global variable"], ["base", "A reachable base case"], ["random", "A random stopping point"], ["static", "A static class"]] },
      { id: "programming-hard-pseudocode", difficulty: "hard", prompt: "What is printed? `x = 1; FOR i = 1 TO 3: x = x * 2; PRINT x`", answer: "8", options: [["3", "3"], ["4", "4"], ["6", "6"], ["8", "8"]] },
      { id: "programming-hard-testing", difficulty: "hard", prompt: "A function accepts integers from 1 to 100. Which test set best checks boundary defects?", answer: "boundaries", options: [["random", "Only random middle values"], ["boundaries", "0, 1, 2, 99, 100, 101"], ["same", "The value 50 repeated"], ["happy", "Only typical valid values"]] },
    ],
  },
  {
    id: "dsa",
    title: "DSA and algorithmic thinking",
    description: "Data structures, searching, sorting, graphs, dynamic programming, and complexity reasoning.",
    questions: [
      { id: "dsa-easy-queue", topic: "Queue", difficulty: "easy", prompt: "Which data structure follows first-in, first-out order?", answer: "queue", options: [["stack", "Stack"], ["queue", "Queue"], ["tree", "Tree"], ["heap", "Heap"]] },
      { id: "dsa-easy-binary", topic: "Searching", difficulty: "easy", prompt: "Binary search requires the data to be:", answer: "sorted", options: [["random", "Randomly arranged"], ["sorted", "Sorted"], ["duplicated", "Duplicated"], ["linked", "Linked only"]] },
      { id: "dsa-medium-hash", topic: "Hashing", difficulty: "medium", prompt: "What is the average lookup complexity of a well-designed hash table?", answer: "constant", options: [["constant", "O(1)"], ["log", "O(log n)"], ["linear", "O(n)"], ["quadratic", "O(n²)"]] },
      { id: "dsa-medium-sort", topic: "Sorting", difficulty: "medium", prompt: "Which algorithm has O(n log n) average time and is stable in its standard merge form?", answer: "merge", options: [["bubble", "Bubble sort"], ["merge", "Merge sort"], ["linear", "Linear scan"], ["selection", "Selection sort"]] },
      { id: "dsa-hard-pseudocode", topic: "Algorithm Analysis", difficulty: "hard", prompt: "What is the time complexity? `FOR i = 1 TO n: j = 1; WHILE j < n: j = j * 2`", answer: "nlogn", options: [["constant", "O(1)"], ["logn", "O(log n)"], ["n", "O(n)"], ["nlogn", "O(n log n)"]] },
      { id: "dsa-hard-graph", topic: "Graphs", difficulty: "hard", prompt: "Which approach finds the shortest path in an unweighted graph?", answer: "bfs", options: [["dfs", "Depth-first search"], ["bfs", "Breadth-first search"], ["kruskal", "Kruskal's algorithm"], ["backtrack", "Backtracking"]] },
    ],
  },
  {
    id: "technical",
    title: "Core technical subjects",
    description: "SQL, DBMS, OOP, operating systems, networks, web protocols, and security foundations.",
    questions: [
      { id: "technical-easy-http", difficulty: "easy", prompt: "Which HTTP method normally creates a new resource?", answer: "post", options: [["get", "GET"], ["post", "POST"], ["put", "PUT"], ["head", "HEAD"]] },
      { id: "technical-easy-oop", difficulty: "easy", prompt: "Which OOP principle hides internal implementation details?", answer: "encapsulation", options: [["inheritance", "Inheritance"], ["encapsulation", "Encapsulation"], ["casting", "Casting"], ["iteration", "Iteration"]] },
      { id: "technical-medium-sql", difficulty: "medium", prompt: "Which SQL clause filters rows before grouping?", answer: "where", options: [["where", "WHERE"], ["having", "HAVING"], ["order", "ORDER BY"], ["limit", "LIMIT"]] },
      { id: "technical-medium-os", difficulty: "medium", prompt: "Which condition is necessary for deadlock?", answer: "circular", options: [["compilation", "Compilation"], ["circular", "Circular wait"], ["inheritance", "Inheritance"], ["encryption", "Encryption"]] },
      { id: "technical-hard-db", difficulty: "hard", prompt: "A transaction reads data another transaction has not committed. Which isolation problem is this?", answer: "dirty", options: [["dirty", "Dirty read"], ["phantom", "Phantom read"], ["deadlock", "Deadlock"], ["lost", "Lost update"]] },
      { id: "technical-hard-network", difficulty: "hard", prompt: "What does a TCP three-way handshake establish before application data is sent?", answer: "connection", options: [["encryption", "End-to-end encryption"], ["connection", "A reliable connection and sequence state"], ["dns", "A DNS record"], ["compression", "Data compression"]] },
    ],
  },
  {
    id: "communication",
    title: "Communication and workplace judgment",
    description: "Clarity, collaboration, stakeholder communication, ownership, and structured problem explanation.",
    questions: [
      { id: "communication-easy-blocked", difficulty: "easy", prompt: "You are blocked by a technical issue. What is best?", answer: "ask", options: [["hide", "Hide it"], ["ask", "Document what you tried and ask for focused help"], ["stop", "Stop permanently"], ["blame", "Blame a teammate"]] },
      { id: "communication-easy-feedback", difficulty: "easy", prompt: "What makes feedback most useful to a teammate?", answer: "specific", options: [["vague", "Keep it vague"], ["specific", "Use specific, respectful examples"], ["public", "Give it publicly to create pressure"], ["personal", "Focus on personality"]] },
      { id: "communication-medium-explain", difficulty: "medium", prompt: "How should you explain a technical decision to a non-technical stakeholder?", answer: "outcome", options: [["jargon", "Use technical jargon"], ["outcome", "Explain trade-offs and business outcomes clearly"], ["avoid", "Avoid explaining"], ["code", "Only share code"]] },
      { id: "communication-medium-conflict", difficulty: "medium", prompt: "Two teammates disagree about an implementation. What should you do first?", answer: "criteria", options: [["vote", "Choose the louder opinion"], ["criteria", "Agree on requirements and evaluation criteria"], ["delay", "Avoid the decision"], ["escalate", "Escalate without discussion"]] },
      { id: "communication-hard-incident", difficulty: "hard", prompt: "A production incident is ongoing. Which update is most responsible?", answer: "facts", options: [["facts", "State known impact, current action, owner, and next update time"], ["blame", "Name the person responsible first"], ["silence", "Wait until everything is fixed"], ["guess", "Share an unverified root cause"]] },
      { id: "communication-hard-ambiguity", difficulty: "hard", prompt: "A requirement is ambiguous and implementation is time-sensitive. What demonstrates senior judgment?", answer: "assumptions", options: [["assumptions", "Record assumptions, identify risks, and confirm the highest-impact decision"], ["build", "Build the largest interpretation immediately"], ["wait", "Wait without informing anyone"], ["ignore", "Ignore the ambiguity"]] },
    ],
  },
];

export const ALL_QUESTIONS = ASSESSMENT_SECTIONS.flatMap((section) =>
  section.questions.map((question) => ({ ...question, sectionId: section.id }))
);
