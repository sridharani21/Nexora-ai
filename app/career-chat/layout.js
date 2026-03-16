// This file overrides the root layout for /career-chat
// It removes the Nexora navbar so the chatbot takes the full screen

export default function CareerChatLayout({ children }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-white dark:bg-zinc-900">
      {children}
    </div>
  );
}