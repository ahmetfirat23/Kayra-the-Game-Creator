import { PlanCard } from "./PlanCard";

export function PlanOverview({
  billingStatus,
  remainingMessages,
  currentTierLabel,
  proRemainingM,
  planMessage,
  onStartPro,
  onCancelPro,
}: {
  billingStatus: any;
  remainingMessages: any;
  currentTierLabel: string;
  proRemainingM: number | null;
  planMessage: string | null;
  onStartPro: () => void;
  onCancelPro: () => void;
}) {
  return (
    <section className="bg-white dark:bg-[#2D3748] rounded-3xl p-6 md:p-8 shadow-[0_4px_24px_rgba(168,162,158,0.1)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] border border-[#E8F4FC] dark:border-[#4A5568]">
      <h2 className="text-2xl font-bold mb-3 text-[#4A5568] dark:text-[#E2E8F0]">
        Plan & Usage
      </h2>
      <p className="text-sm text-[#718096] dark:text-[#A0AEC0] mb-6">
        Choose how you want to power Kayra. Start free, bring your own OpenAI key, or upgrade
        to Pro for a large monthly token allowance.
      </p>

      {billingStatus && (
        <div className="mb-6 text-sm text-[#718096] dark:text-[#A0AEC0] bg-[#F8F9FA] dark:bg-[#1A202C] rounded-2xl p-4">
          <span className="font-semibold text-[#4A5568] dark:text-[#E2E8F0]">Current plan:</span>{" "}
          <span className="font-bold text-[#8B7EC8] dark:text-[#D4B8E8]">{currentTierLabel}</span>
          {billingStatus.pro?.isActive &&
            billingStatus.pro.currentPeriodEnd && (
              <>
                {" "}
                ·{" "}
                {billingStatus.pro.status === "canceled" ? "ends on " : "renews on "}
                {new Date(billingStatus.pro.currentPeriodEnd).toLocaleDateString()}
              </>
            )}
          {remainingMessages?.isFreeUser && remainingMessages.remainingMessages !== null && (
            <div className="mt-2 text-xs">
              <span className="inline-flex items-center gap-1 bg-[#E8F8F0] dark:bg-[#2D4A3A] text-[#7EC8A8] dark:text-[#88C8A8] px-2 py-1 rounded-full font-medium">
                {remainingMessages.remainingMessages}/{remainingMessages.dailyLimit} free messages left today
              </span>
            </div>
          )}
          {proRemainingM !== null && (
            <div className="mt-2 text-xs">
              <span className="inline-flex items-center gap-1 bg-[#F0E6FA] dark:bg-[#3D3058] text-[#8B7EC8] dark:text-[#D4B8E8] px-2 py-1 rounded-full font-medium">
                {proRemainingM}M Pro tokens remaining this period
              </span>
            </div>
          )}
        </div>
      )}

      {planMessage && (
        <div className="mb-6 text-sm px-4 py-3 rounded-2xl bg-[#E8F8F0] dark:bg-[#2D4A3A] text-[#7EC8A8] dark:text-[#88C8A8] border border-[#B8E8C8] dark:border-[#4A5568]">
          {planMessage}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        <PlanCard
          icon="🎁"
          title="Free"
          description="Try Kayra with a small daily allowance using our shared OpenAI key."
          features={[
            "5 free messages per day",
            "Great for quick experiments"
          ]}
          badge="Always available"
        />

        <PlanCard
          icon="🔑"
          title="Bring Your Own Key"
          description="Use your own OpenAI API key. You pay OpenAI directly; we don't meter usage."
          features={[
            "Unlimited messages",
            "Best for regular usage",
            "Your key is encrypted at rest"
          ]}
          buttonText="Configure BYOK"
          buttonAction={() => {
            const el = document.getElementById("byok-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          buttonVariant="secondary"
        />

        {billingStatus?.isAdmin ? (
          <PlanCard
            icon="✨"
            title="Pro"
            price="$20/month"
            description="7M tokens per 30-day period with automatic renewal."
            features={[
              "7M tokens per 30-day period",
              "Renews every 30 days",
              "Cancel anytime"
            ]}
            badge="Admin accounts have full access"
          />
        ) : (
          <PlanCard
            icon="✨"
            title="Pro"
            price="$20/month"
            description="7M tokens per 30-day period with automatic renewal."
            features={[
              "7M tokens per 30-day period",
              "Renews every 30 days",
              "Cancel anytime"
            ]}
            buttonText={
              billingStatus?.pro?.isActive
                ? billingStatus.pro.status === "canceled"
                  ? "Continue Pro"
                  : "Cancel Pro"
                : "Buy Pro ($20/mo)"
            }
            buttonAction={
              billingStatus?.pro?.isActive && billingStatus.pro.status !== "canceled"
                ? onCancelPro
                : onStartPro
            }
            buttonVariant={
              billingStatus?.pro?.isActive && billingStatus.pro.status !== "canceled"
                ? "danger"
                : "primary"
            }
            footnote='This is a prototype: "Buy" and "Cancel" only change your plan state; no real billing is performed.'
          />
        )}
      </div>
    </section>
  );
}
