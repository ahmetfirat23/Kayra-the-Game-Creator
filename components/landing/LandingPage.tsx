import { SignInButton } from "@clerk/nextjs";
import { ThemeToggle } from "../ui/ThemeToggle";

interface LandingPageProps {
  theme: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
  mounted: boolean;
}

export function LandingPage({ theme, toggleTheme, mounted }: LandingPageProps) {
  return (
    <main className="min-h-screen md:h-screen flex flex-col bg-gradient-to-br from-[#F0E6FA] via-[#FAFBFC] to-[#E8F4FC] dark:from-[#1A202C] dark:via-[#2D3748] dark:to-[#1A202C] overflow-y-auto md:overflow-hidden relative transition-colors duration-300">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        {mounted && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
      </div>
      
      {/* Decorative blobs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-[#D4B8E8] dark:bg-[#6B4A8C] rounded-full blur-3xl opacity-30 dark:opacity-20 pointer-events-none" />
      <div className="absolute bottom-40 right-20 w-80 h-80 bg-[#A8D4E6] dark:bg-[#4A6B8C] rounded-full blur-3xl opacity-30 dark:opacity-20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-[#B8E8C8] dark:bg-[#4A8C6B] rounded-full blur-3xl opacity-20 dark:opacity-15 pointer-events-none" />
      
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 relative z-10 min-h-0">
        <div className="max-w-5xl mx-auto text-center w-full">
          {/* Logo and Title */}
          <div className="mb-5 animate-fade-in">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="text-5xl animate-float">🌳</div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-1 leading-tight bg-gradient-to-r from-[#8B7EC8] via-[#7EB8D8] to-[#7EC8A8] bg-clip-text text-transparent">
              Kayra
            </h1>
            <p className="text-lg text-[#718096] dark:text-[#A0AEC0] font-medium mb-2">
              the Game Creator
            </p>
            <p className="text-sm text-[#A0AEC0] dark:text-[#718096] max-w-xl mx-auto leading-relaxed">
              Transform your game ideas into reality with AI-powered 3D game creation
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-5">
            <div className="bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_4px_24px_rgba(168,212,230,0.2)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-[#E8F4FC] dark:border-[#4A5568] hover:shadow-[0_8px_32px_rgba(168,212,230,0.3)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] flex items-center justify-center text-xl mb-3 mx-auto shadow-md">
                🎮
              </div>
              <h3 className="text-base font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-1">
                Create 3D Games
              </h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] leading-relaxed">
                Tell Kayra your game idea and watch it come to life
              </p>
            </div>

            <div className="bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_4px_24px_rgba(212,184,232,0.2)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-[#F0E6FA] dark:border-[#4A5568] hover:shadow-[0_8px_32px_rgba(212,184,232,0.3)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D4B8E8] to-[#C4A8D8] dark:from-[#A888C8] dark:to-[#9878B8] flex items-center justify-center text-xl mb-3 mx-auto shadow-md">
                ⚡
              </div>
              <h3 className="text-base font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-1">
                Instant Preview
              </h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] leading-relaxed">
                See your game running live as Kayra builds it
              </p>
            </div>

            <div className="bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_4px_24px_rgba(184,232,200,0.2)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-[#E8F8F0] dark:border-[#4A5568] hover:shadow-[0_8px_32px_rgba(184,232,200,0.3)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#B8E8C8] to-[#98D8B8] dark:from-[#88C8A8] dark:to-[#78B898] flex items-center justify-center text-xl mb-3 mx-auto shadow-md">
                🤖
              </div>
              <h3 className="text-base font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-1">
                AI-Powered
              </h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] leading-relaxed">
                Advanced AI understands your vision and creates code
              </p>
            </div>
          </div>

          {/* Pricing Info */}
          <div className="bg-gradient-to-r from-[#E8F8F0] via-white to-[#E8F4FC] dark:from-[#1a3a2a] dark:via-[#2D3748] dark:to-[#1a2a3a] backdrop-blur-sm rounded-2xl p-5 mb-5 border-2 border-[#B8E8C8] dark:border-[#88C8A8] shadow-[0_8px_32px_rgba(184,232,200,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B8E8C8] to-[#98D8B8] dark:from-[#88C8A8] dark:to-[#78B898] flex items-center justify-center text-xl shadow-md">
                🎁
              </div>
              <h3 className="text-xl font-bold text-[#4A5568] dark:text-[#E2E8F0]">
                Start Creating for Free
              </h3>
            </div>
            <p className="text-base text-[#718096] dark:text-[#A0AEC0]">
              Get <span className="font-bold text-[#7EC8A8] dark:text-[#88C8A8]">5 free messages per day</span> to bring your game ideas to life
            </p>
            <p className="text-xs text-[#A0AEC0] mt-1">
              No credit card required • Start building immediately
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <SignInButton mode="modal">
              <button className="bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6] dark:hover:from-[#5B98B8] dark:hover:to-[#4B88A8] text-white font-bold text-base px-8 py-3 rounded-full shadow-[0_4px_16px_rgba(168,212,230,0.4)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] transform transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_24px_rgba(168,212,230,0.5)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                Get Started Free ✨
              </button>
            </SignInButton>
            <p className="text-sm text-[#A0AEC0] dark:text-[#718096]">
              Already have an account? 
              <SignInButton mode="modal">
                <button className="ml-2 text-[#7EB8D8] dark:text-[#6BA8C8] font-bold hover:text-[#6EA8C8] dark:hover:text-[#8BC8E8] transition-colors">
                  Sign in
                </button>
              </SignInButton>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3 border-t border-[#E8F4FC] dark:border-[#2D3748] flex-shrink-0 relative z-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs text-[#A0AEC0] dark:text-[#718096]">
            © 2025 Kayra • Powered by OpenAI • Built for Creators
          </p>
        </div>
      </footer>
    </main>
  );
}
