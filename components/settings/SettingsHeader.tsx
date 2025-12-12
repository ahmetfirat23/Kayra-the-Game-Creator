import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "../ui/ThemeToggle";

export function SettingsHeader({ 
  onBack,
  theme,
  toggleTheme,
  mounted
}: { 
  onBack: () => void;
  theme: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
  mounted: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-[#E8F4FC] dark:border-[#4A5568] bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm px-4 md:px-6 py-3 md:py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-[#7EB8D8] dark:text-[#6BA8C8] hover:text-[#6EA8C8] dark:hover:text-[#5B98B8] font-bold transition-colors"
        >
          ← Back to Kayra
        </button>
        <h1 className="text-xl font-bold text-[#4A5568] dark:text-[#E2E8F0]">Settings</h1>
      </div>
      <div className="flex items-center gap-2">
        {mounted && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
        <UserButton />
      </div>
    </div>
  );
}
