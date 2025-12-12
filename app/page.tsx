"use client";

import { useUser } from "@clerk/nextjs";
import { useTheme } from "../hooks/useTheme";
import { LandingPage } from "../components/landing/LandingPage";
import { ChatInterface } from "../components/chat/ChatInterface";

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const { theme, toggleTheme, mounted } = useTheme();

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#F0E6FA] via-[#FAFBFC] to-[#E8F4FC]">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-float">🌳</div>
          <p className="text-[#718096]">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page if not signed in
  if (!isSignedIn) {
    return <LandingPage theme={theme} toggleTheme={toggleTheme} mounted={mounted} />;
  }

  // Show main chat interface for signed-in users
  return <ChatInterface theme={theme} toggleTheme={toggleTheme} mounted={mounted} />;
}
