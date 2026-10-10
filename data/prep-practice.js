export const PRACTICE_SUBJECTS = [
  { id: "aptitude", label: "Aptitude", topics: ["Percentages", "Ratios", "Probability"] },
  { id: "reasoning", label: "Logical reasoning", topics: ["Sequences", "Syllogisms", "Patterns"] },
  { id: "verbal", label: "Verbal ability", topics: ["Grammar", "Reading comprehension", "Vocabulary"] },
  { id: "dsa", label: "DSA", topics: ["Arrays", "Trees", "Graphs"] },
  { id: "coding", label: "Coding practice", topics: ["Algorithms", "Debugging", "Complexity"] },
  { id: "sql", label: "SQL", topics: ["Queries", "Joins", "Aggregation"] },
  { id: "oop", label: "OOP", topics: ["Encapsulation", "Inheritance", "Polymorphism"] },
  { id: "dbms", label: "DBMS", topics: ["Normalization", "Transactions", "Indexing"] },
  { id: "os", label: "Operating systems", topics: ["Processes", "Memory", "Deadlocks"] },
  { id: "networks", label: "Computer networks", topics: ["HTTP", "TCP/IP", "DNS"] },
  { id: "core", label: "Core technical", topics: ["Web fundamentals", "Security basics", "System design"] },
  { id: "role", label: "Role-specific", topics: ["Frontend", "Backend", "Data", "Cloud", "Security"] },
];

export const PRACTICE_QUESTIONS = [
  { id: "p1", subject: "aptitude", topic: "Percentages", difficulty: "easy", prompt: "What is 20% of 250?", answer: "50", options: [["50", "50"], ["25", "25"], ["75", "75"], ["100", "100"]] },
  { id: "p2", subject: "aptitude", topic: "Ratios", difficulty: "medium", prompt: "If 3:5 is equivalent to x:20, what is x?", answer: "12", options: [["8", "8"], ["10", "10"], ["12", "12"], ["15", "15"]] },
  { id: "p3", subject: "reasoning", topic: "Sequences", difficulty: "easy", prompt: "What comes next: 3, 6, 12, 24, ?", answer: "48", options: [["36", "36"], ["42", "42"], ["48", "48"], ["54", "54"]] },
  { id: "p4", subject: "reasoning", topic: "Syllogisms", difficulty: "hard", prompt: "All databases store data. Some systems use databases. What follows?", answer: "some", options: [["all", "All systems store data"], ["some", "Some systems store data"], ["none", "No systems store data"], ["cannot", "No conclusion"]] },
  { id: "p5", subject: "verbal", topic: "Grammar", difficulty: "easy", prompt: "Choose the grammatically correct sentence.", answer: "b", options: [["a", "She go to work."], ["b", "She goes to work."], ["c", "She going work."], ["d", "She gone work."]] },
  { id: "p6", subject: "verbal", topic: "Vocabulary", difficulty: "medium", prompt: "Which word is closest to 'concise'?", answer: "brief", options: [["brief", "Brief"], ["slow", "Slow"], ["complex", "Complex"], ["loud", "Loud"]] },
  { id: "p7", subject: "dsa", topic: "Arrays", difficulty: "easy", prompt: "What is the zero-based index of the first element in an array?", answer: "0", options: [["0", "0"], ["1", "1"], ["-1", "-1"], ["n", "n"]] },
  { id: "p8", subject: "dsa", topic: "Trees", difficulty: "medium", prompt: "Which traversal visits a binary search tree in sorted order?", answer: "inorder", options: [["preorder", "Preorder"], ["inorder", "Inorder"], ["postorder", "Postorder"], ["level", "Level order"]] },
  { id: "p9", subject: "dsa", topic: "Graphs", difficulty: "hard", prompt: "Which algorithm handles negative edge weights without negative cycles?", answer: "bellman", options: [["dijkstra", "Dijkstra"], ["bellman", "Bellman-Ford"], ["bfs", "BFS"], ["prim", "Prim"]] },
  { id: "p10", subject: "coding", topic: "Debugging", difficulty: "easy", prompt: "What should you do first when a test fails?", answer: "reproduce", options: [["rewrite", "Rewrite all code"], ["reproduce", "Reproduce and isolate the failure"], ["ignore", "Ignore it"], ["deploy", "Deploy immediately"]] },
  { id: "p11", subject: "coding", topic: "Complexity", difficulty: "medium", prompt: "A binary search on sorted data has which time complexity?", answer: "log", options: [["constant", "O(1)"], ["log", "O(log n)"], ["linear", "O(n)"], ["quadratic", "O(n²)"]] },
  { id: "p12", subject: "coding", topic: "Algorithms", difficulty: "hard", prompt: "Which technique stores results of overlapping subproblems?", answer: "dp", options: [["greedy", "Greedy"], ["dp", "Dynamic programming"], ["random", "Randomization"], ["hash", "Hashing"]] },
  { id: "p13", subject: "sql", topic: "Queries", difficulty: "easy", prompt: "Which clause filters rows?", answer: "where", options: [["where", "WHERE"], ["group", "GROUP BY"], ["order", "ORDER BY"], ["join", "JOIN"]] },
  { id: "p14", subject: "sql", topic: "Joins", difficulty: "medium", prompt: "Which join returns matching rows from both tables?", answer: "inner", options: [["inner", "INNER JOIN"], ["left", "LEFT JOIN"], ["cross", "CROSS JOIN"], ["self", "SELF JOIN"]] },
  { id: "p15", subject: "sql", topic: "Aggregation", difficulty: "hard", prompt: "Which clause filters grouped results?", answer: "having", options: [["where", "WHERE"], ["having", "HAVING"], ["select", "SELECT"], ["from", "FROM"]] },
  { id: "p16", subject: "oop", topic: "Encapsulation", difficulty: "easy", prompt: "Bundling data and methods while restricting direct access is:", answer: "encapsulation", options: [["inheritance", "Inheritance"], ["encapsulation", "Encapsulation"], ["overload", "Overloading"], ["iteration", "Iteration"]] },
  { id: "p17", subject: "oop", topic: "Polymorphism", difficulty: "medium", prompt: "Polymorphism allows:", answer: "many", options: [["one", "One class only"], ["many", "One interface with multiple implementations"], ["none", "No method reuse"], ["static", "Only static data"]] },
  { id: "p18", subject: "dbms", topic: "Normalization", difficulty: "medium", prompt: "Normalization primarily reduces:", answer: "redundancy", options: [["security", "Security"], ["redundancy", "Data redundancy"], ["availability", "Availability"], ["latency", "Network latency"]] },
  { id: "p19", subject: "dbms", topic: "Transactions", difficulty: "hard", prompt: "The 'A' in ACID stands for:", answer: "atomicity", options: [["availability", "Availability"], ["atomicity", "Atomicity"], ["accuracy", "Accuracy"], ["authorization", "Authorization"]] },
  { id: "p20", subject: "os", topic: "Processes", difficulty: "easy", prompt: "A process is:", answer: "program", options: [["program", "A program in execution"], ["file", "Only a file"], ["thread", "Always a thread"], ["device", "A hardware device"]] },
  { id: "p21", subject: "os", topic: "Deadlocks", difficulty: "hard", prompt: "Which is a deadlock condition?", answer: "circular", options: [["circular", "Circular wait"], ["sorting", "Sorting"], ["paging", "Paging"], ["compiling", "Compiling"]] },
  { id: "p22", subject: "networks", topic: "HTTP", difficulty: "easy", prompt: "Which protocol securely transports HTTP?", answer: "https", options: [["ftp", "FTP"], ["https", "HTTPS"], ["smtp", "SMTP"], ["arp", "ARP"]] },
  { id: "p23", subject: "networks", topic: "TCP/IP", difficulty: "medium", prompt: "TCP provides:", answer: "reliable", options: [["reliable", "Reliable ordered delivery"], ["random", "Random delivery"], ["visual", "Visual rendering"], ["local", "Only local storage"]] },
  { id: "p24", subject: "networks", topic: "DNS", difficulty: "hard", prompt: "DNS primarily maps:", answer: "names", options: [["names", "Domain names to IP addresses"], ["files", "Files to folders"], ["ports", "Ports to users"], ["keys", "Keys to passwords"]] },
  { id: "p25", subject: "core", topic: "Security basics", difficulty: "medium", prompt: "Which practice protects passwords best?", answer: "hash", options: [["plain", "Store plain text"], ["hash", "Use salted password hashing"], ["share", "Share with administrators"], ["repeat", "Reuse one password"]] },
  { id: "p26", subject: "role", topic: "Frontend", difficulty: "medium", prompt: "Which concern is most important for accessible UI?", answer: "keyboard", options: [["keyboard", "Keyboard navigation"], ["gradient", "Only visual gradients"], ["animation", "Maximum animation"], ["hidden", "Hidden labels"]] },
  { id: "p27", subject: "os", topic: "Memory", difficulty: "medium", prompt: "Virtual memory allows a system to:", answer: "disk", options: [["disk", "Use disk space as an extension of RAM"], ["delete", "Delete inactive processes"], ["compile", "Compile without a CPU"], ["encrypt", "Encrypt every file automatically"]] },
  { id: "p28", subject: "core", topic: "Web fundamentals", difficulty: "easy", prompt: "Which HTTP status means a resource was not found?", answer: "404", options: [["200", "200"], ["301", "301"], ["404", "404"], ["500", "500"]] },
  { id: "p29", subject: "role", topic: "Backend", difficulty: "hard", prompt: "Which property is most important for an idempotent retry of an API request?", answer: "same", options: [["same", "Repeating it produces the same intended result"], ["random", "Each retry creates a new result"], ["slow", "The server delays every retry"], ["public", "The endpoint needs no authentication"]] },
  { id: "p30", subject: "sql", topic: "Queries", difficulty: "hard", prompt: "Which SQL construct removes duplicate rows from a result?", answer: "distinct", options: [["distinct", "DISTINCT"], ["unique", "UNIQUE in SELECT"], ["dedupe", "DEDUPE"], ["single", "SINGLE"]] },
];

export function questionsFor(subject, difficulty = "all", count = 5) {
  const pool = PRACTICE_QUESTIONS.filter((question) => question.subject === subject && (difficulty === "all" || question.difficulty === difficulty));
  return pool.slice(0, count);
}
