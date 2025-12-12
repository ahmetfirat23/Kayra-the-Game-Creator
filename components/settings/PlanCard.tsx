export function PlanCard({ 
  icon, 
  title, 
  price, 
  description, 
  features, 
  buttonText, 
  buttonAction, 
  buttonVariant = 'primary',
  badge,
  footnote 
}: {
  icon: string;
  title: string;
  price?: string;
  description: string;
  features: string[];
  buttonText?: string;
  buttonAction?: () => void;
  buttonVariant?: 'primary' | 'secondary' | 'danger';
  badge?: string;
  footnote?: string;
}) {
  const getButtonClasses = () => {
    switch (buttonVariant) {
      case 'primary':
        return 'bg-gradient-to-r from-[#D4B8E8] to-[#C4A8D8] dark:from-[#A888C8] dark:to-[#9878B8] hover:from-[#C4A8D8] hover:to-[#B498C8]';
      case 'secondary':
        return 'bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6]';
      case 'danger':
        return 'bg-[#F0B8C4] hover:bg-[#E8A8B4] dark:bg-[#C86B7A] dark:hover:bg-[#B85A6A]';
      default:
        return 'bg-gradient-to-r from-[#B8E8C8] to-[#98D8B8] dark:from-[#88C8A8] dark:to-[#68B888] hover:from-[#A8D8B8] hover:to-[#88C8A8]';
    }
  };

  return (
    <div className="rounded-3xl border-2 border-[#E8F4FC] dark:border-[#4A5568] bg-gradient-to-br from-[#FAFBFC] to-white dark:from-[#1A202C] dark:to-[#2D3748] p-5 flex flex-col hover:shadow-md transition-all">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E8F4FC] to-[#D8E4EC] dark:from-[#2D3748] dark:to-[#4A5568] flex items-center justify-center text-xl mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-1">
        {title}
      </h3>
      {price && (
        <p className="text-sm text-[#8B7EC8] dark:text-[#D4B8E8] font-bold mb-3">
          {price}
        </p>
      )}
      <p className="text-xs text-[#718096] dark:text-[#A0AEC0] mb-3">
        {description}
      </p>
      <ul className="text-xs text-[#718096] dark:text-[#A0AEC0] space-y-2 mb-4">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="text-[#7EC8A8] dark:text-[#88C8A8]">✓</span> {feature}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2">
        {badge ? (
          <div className="text-xs font-bold text-[#7EC8A8] dark:text-[#88C8A8] bg-[#E8F8F0] dark:bg-[#2D4A3A] px-3 py-2 rounded-full text-center">
            {badge}
          </div>
        ) : buttonText && buttonAction ? (
          <button
            onClick={buttonAction}
            className={`text-xs px-4 py-2 rounded-full text-white font-bold transition-all hover:shadow-md ${getButtonClasses()}`}
          >
            {buttonText}
          </button>
        ) : null}
        {footnote && (
          <p className="text-[10px] text-[#A0AEC0] dark:text-[#718096] text-center">
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}
