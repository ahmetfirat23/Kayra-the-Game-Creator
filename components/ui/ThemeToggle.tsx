export function ThemeToggle({ theme, onToggle }: { theme: 'light' | 'dark' | 'system'; onToggle: () => void }) {
  const getLabel = () => {
    if (theme === 'light') return 'Switch to dark mode';
    if (theme === 'dark') return 'Switch to system mode';
    return 'Switch to light mode';
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative text-[10px] md:text-xs w-8 h-8 md:w-10 md:h-8 rounded-full font-bold bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] text-[#718096] dark:text-[#A0AEC0] transition-all flex items-center justify-center overflow-hidden"
      aria-label={getLabel()}
    >
      <span className={`absolute transition-all duration-300 ${theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}>
        ☀️
      </span>
      <span className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`}>
        🌙
      </span>
      <span className={`absolute transition-all duration-300 ${theme === 'system' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-180 scale-50'}`}>
        💻
      </span>
    </button>
  );
}
