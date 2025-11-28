"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

export default function Settings() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  const apiKeyStatus = useQuery(api.users.getApiKey);
  const billingStatus = useQuery(api.users.getBillingStatus);
  const remainingMessages = useQuery(api.users.getRemainingMessages);
  const updateApiKey = useAction(api.users.updateApiKey); // Action, not mutation
  const startProSubscription = useMutation(api.users.startProSubscription);
  const cancelProSubscription = useMutation(api.users.cancelProSubscription);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    try {
      await updateApiKey({ apiKey });
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save API key:", error);
      // Extract the actual error message from Convex error format
      let errorMessage = "Failed to save API key";
      if (error instanceof Error) {
        const uncaughtMatch = error.message.match(/Uncaught Error: (.+?)(?:\n|$)/);
        if (uncaughtMatch) {
          errorMessage = uncaughtMatch[1];
        } else {
          const convexMatch = error.message.match(/\[CONVEX A\([^)]+\)\](?:\s*\[Request ID: [^\]]+\])?\s*(.+?)(?:\n|$)/);
          errorMessage = convexMatch ? convexMatch[1] : error.message;
        }
      }
      alert(`❌ ${errorMessage}`);
    }
  };

  const handleStartPro = async () => {
    try {
      const res = await startProSubscription({});
      const endDate = res.currentPeriodEnd
        ? new Date(res.currentPeriodEnd).toLocaleDateString()
        : "";
      setPlanMessage(
        endDate
          ? `Pro subscription activated. Current period ends on ${endDate}.`
          : "Pro subscription activated.",
      );
    } catch (error) {
      console.error("Failed to start Pro subscription:", error);
      setPlanMessage("Failed to start Pro subscription");
    }
  };

  const handleCancelPro = async () => {
    try {
      const res = await cancelProSubscription({});
      const endDate = res.currentPeriodEnd
        ? new Date(res.currentPeriodEnd).toLocaleDateString()
        : "";
      setPlanMessage(
        endDate
          ? `Your Pro subscription will be canceled on ${endDate}.`
          : "Your Pro subscription has been scheduled for cancellation.",
      );
    } catch (error) {
      console.error("Failed to cancel Pro subscription:", error);
      setPlanMessage("Failed to cancel Pro subscription");
    }
  };

  const currentTierLabel =
    billingStatus?.tier === "pro"
      ? "Pro tier"
      : billingStatus?.tier === "byok"
      ? "BYOK tier"
      : billingStatus?.tier === "admin"
      ? "Admin"
      : "Free tier";

  const proRemainingM =
    billingStatus?.pro?.isActive && typeof billingStatus.pro.remainingTokens === "number"
      ? Math.floor(billingStatus.pro.remainingTokens / 1_000_000)
      : null;

  const byokLockedByPro =
    billingStatus?.pro?.isActive && proRemainingM !== null && proRemainingM > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-white to-[#F8F9FA] dark:from-[#1A202C] dark:via-[#1A202C] dark:to-[#2D3748] text-[#4A5568] dark:text-[#E2E8F0]">
      {/* Header */}
      <div className="border-b border-[#E8F4FC] dark:border-[#4A5568] bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-[#7EB8D8] dark:text-[#6BA8C8] hover:text-[#6EA8C8] dark:hover:text-[#5B98B8] font-bold transition-colors"
          >
            ← Back to Kayra
          </button>
          <h1 className="text-xl font-bold text-[#4A5568] dark:text-[#E2E8F0]">Settings</h1>
        </div>
        <UserButton />
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        {/* Tier list / plan overview */}
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
                    {remainingMessages.remainingMessages}/{remainingMessages.totalDailyLimit} free messages left today
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
            {/* Free tier */}
            <div className="rounded-3xl border border-[#E8F4FC] dark:border-[#4A5568] bg-[#FAFBFC] dark:bg-[#1A202C] p-5 flex flex-col hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E8F4FC] to-[#D8E4EC] dark:from-[#2D3748] dark:to-[#4A5568] flex items-center justify-center text-xl mb-4">
                🎁
              </div>
              <h3 className="text-lg font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-2">Free</h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] mb-3">
                Try Kayra with a small daily allowance using our shared OpenAI key.
              </p>
              <ul className="text-xs text-[#718096] dark:text-[#A0AEC0] space-y-2 mb-4">
                <li className="flex items-center gap-2">
                  <span className="text-[#7EC8A8] dark:text-[#88C8A8]">✓</span> 5 free messages per day
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#7EC8A8] dark:text-[#88C8A8]">✓</span> Great for quick experiments
                </li>
              </ul>
              <div className="mt-auto text-xs font-bold text-[#7EC8A8] dark:text-[#88C8A8] bg-[#E8F8F0] dark:bg-[#2D4A3A] px-3 py-2 rounded-full text-center">
                Always available
              </div>
            </div>

            {/* BYOK */}
            <div className="rounded-3xl border-2 border-[#A8D4E6] dark:border-[#6BA8C8] bg-gradient-to-br from-[#E8F4FC] to-white dark:from-[#2A3A4A] dark:to-[#2D3748] p-5 flex flex-col hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] flex items-center justify-center text-xl mb-4 text-white">
                🔑
              </div>
              <h3 className="text-lg font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-2">
                Bring Your Own Key
              </h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] mb-3">
                Use your own OpenAI API key. You pay OpenAI directly; we don&apos;t meter usage.
              </p>
              <ul className="text-xs text-[#718096] dark:text-[#A0AEC0] space-y-2 mb-4">
                <li className="flex items-center gap-2">
                  <span className="text-[#7EB8D8] dark:text-[#6BA8C8]">✓</span> Unlimited messages
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#7EB8D8] dark:text-[#6BA8C8]">✓</span> Best for regular usage
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#7EB8D8] dark:text-[#6BA8C8]">✓</span> Your key is encrypted at rest
                </li>
              </ul>
              <button
                onClick={() => {
                  const el = document.getElementById("byok-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-auto text-xs px-4 py-2 rounded-full bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6] text-white font-bold transition-all hover:shadow-md"
              >
                Configure BYOK
              </button>
            </div>

            {/* Pro */}
            <div className="rounded-3xl border-2 border-[#D4B8E8] dark:border-[#A888C8] bg-gradient-to-br from-[#F0E6FA] to-white dark:from-[#3D3058] dark:to-[#2D3748] p-5 flex flex-col hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4B8E8] to-[#C4A8D8] dark:from-[#A888C8] dark:to-[#9878B8] flex items-center justify-center text-xl mb-4 text-white">
                ✨
              </div>
              <h3 className="text-lg font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-1">
                Pro
              </h3>
              <p className="text-sm text-[#8B7EC8] dark:text-[#D4B8E8] font-bold mb-3">
                $20/month
              </p>
              <ul className="text-xs text-[#718096] dark:text-[#A0AEC0] space-y-2 mb-4">
                <li className="flex items-center gap-2">
                  <span className="text-[#8B7EC8] dark:text-[#D4B8E8]">✓</span> 25M tokens per 30-day period
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#8B7EC8] dark:text-[#D4B8E8]">✓</span> Renews every 30 days
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#8B7EC8] dark:text-[#D4B8E8]">✓</span> Cancel anytime
                </li>
              </ul>
              {!billingStatus?.isAdmin && (
                <div className="mt-auto flex flex-col gap-2">
                  {billingStatus?.pro?.isActive ? (
                    billingStatus.pro.status === "canceled" ? (
                      <button
                        onClick={handleStartPro}
                        className="text-xs px-4 py-2 rounded-full bg-gradient-to-r from-[#B8E8C8] to-[#98D8B8] dark:from-[#88C8A8] dark:to-[#68B888] hover:from-[#A8D8B8] hover:to-[#88C8A8] text-white font-bold transition-all"
                      >
                        Continue Pro
                      </button>
                    ) : (
                      <button
                        onClick={handleCancelPro}
                        className="text-xs px-4 py-2 rounded-full bg-[#F0B8C4] hover:bg-[#E8A8B4] dark:bg-[#C86B7A] dark:hover:bg-[#B85A6A] text-white font-bold transition-all"
                      >
                        Cancel Pro
                      </button>
                    )
                  ) : (
                    <button
                      onClick={handleStartPro}
                      className="text-xs px-4 py-2 rounded-full bg-gradient-to-r from-[#D4B8E8] to-[#C4A8D8] dark:from-[#A888C8] dark:to-[#9878B8] hover:from-[#C4A8D8] hover:to-[#B498C8] text-white font-bold transition-all hover:shadow-md"
                    >
                      Buy Pro ($20/mo)
                    </button>
                  )}
                  <p className="text-[10px] text-[#A0AEC0] dark:text-[#718096] text-center">
                    This is a prototype: &quot;Buy&quot; and &quot;Cancel&quot; only change your
                    plan state; no real billing is performed.
                  </p>
                </div>
              )}
              {billingStatus?.isAdmin && (
                <div className="mt-auto text-xs font-bold text-[#7EC8A8] dark:text-[#88C8A8] bg-[#E8F8F0] dark:bg-[#2D4A3A] px-3 py-2 rounded-full text-center">
                  Admin accounts have full access
                </div>
              )}
            </div>
          </div>
        </section>

        {/* BYOK / API key configuration */}
        <section
          id="byok-section"
          className="bg-white dark:bg-[#2D3748] rounded-3xl p-6 md:p-8 shadow-[0_4px_24px_rgba(168,162,158,0.1)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] border border-[#E8F4FC] dark:border-[#4A5568]"
        >
          <h2 className="text-2xl font-bold mb-3 text-[#4A5568] dark:text-[#E2E8F0]">
            OpenAI API Key (BYOK)
          </h2>
          <p className="text-[#718096] dark:text-[#A0AEC0] text-sm mb-6">
            {apiKeyStatus?.isAdmin 
              ? "You're an admin - using system API key."
              : "Add your own OpenAI API key to switch from the free shared tier to the BYOK tier."}
          </p>
          
          {!apiKeyStatus?.isAdmin && (
            <div className="bg-gradient-to-r from-[#E8F8F0] to-[#E8F4FC] dark:from-[#2D4A3A] dark:to-[#2A3A4A] border border-[#B8E8C8] dark:border-[#4A5568] rounded-2xl p-5 mb-6">
              <h3 className="text-sm font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-2 flex items-center gap-2">
                🔐 Security Notice
              </h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] leading-relaxed">
                Your API key is encrypted and stored securely. We only decrypt it when making AI
                requests on your behalf. Like all BYOK services, we technically have access to your
                key to make API calls. Only use services you trust with your API keys.
              </p>
            </div>
          )}

          {apiKeyStatus?.isAdmin ? (
            <div className="bg-[#E8F8F0] dark:bg-[#2D4A3A] border border-[#B8E8C8] dark:border-[#4A5568] rounded-2xl p-4 text-[#7EC8A8] dark:text-[#88C8A8] font-bold flex items-center gap-2">
              <span className="text-xl">✓</span> Admin account - No API key required
            </div>
          ) : (
            <>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#4A5568] dark:text-[#E2E8F0]">
                    API Key Status
                  </label>
                  <div
                    className={`px-4 py-3 rounded-2xl font-medium ${
                    apiKeyStatus?.hasKey 
                      ? "bg-[#E8F8F0] dark:bg-[#2D4A3A] text-[#7EC8A8] dark:text-[#88C8A8] border border-[#B8E8C8] dark:border-[#4A5568]" 
                      : "bg-[#FEF8E8] dark:bg-[#4A3A2A] text-[#C49564] dark:text-[#D8A674] border border-[#F8D4B8] dark:border-[#4A5568]"
                    }`}
                  >
                    {apiKeyStatus?.hasKey ? "✓ API Key Configured (BYOK tier)" : "⚠ No API Key Set"}
                  </div>
                </div>

                <div>
                  <div className="flex gap-2">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="flex-1 bg-[#F8F9FA] dark:bg-[#1A202C] border border-[#E8F4FC] dark:border-[#4A5568] rounded-xl px-4 py-3 text-[#4A5568] dark:text-[#E2E8F0] focus:outline-none focus:border-[#A8D4E6] dark:focus:border-[#6BA8C8] focus:ring-2 focus:ring-[#A8D4E6]/20 dark:focus:ring-[#6BA8C8]/20 transition-all"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="px-4 py-3 bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] rounded-xl text-[#718096] dark:text-[#A0AEC0] transition-all"
                    >
                      {showKey ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  <p className="text-xs text-[#A0AEC0] dark:text-[#718096] mt-2">
                    Your API key is encrypted and stored securely. We never see or log it.
                  </p>
                  {byokLockedByPro && (
                    <p className="text-xs text-[#C49564] dark:text-[#D8A674] mt-2 bg-[#FEF8E8] dark:bg-[#4A3A2A] px-3 py-2 rounded-xl">
                      Pro is active with remaining tokens. BYOK configuration is locked until your
                      Pro allowance is depleted.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSave}
                  disabled={!apiKey.trim() || byokLockedByPro}
                  className="w-full bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6] disabled:from-[#E2E8F0] disabled:to-[#E2E8F0] dark:disabled:from-[#4A5568] dark:disabled:to-[#4A5568] disabled:cursor-not-allowed px-4 py-3 rounded-xl font-bold text-white transition-all"
                >
                  {saved ? "✓ Saved!" : "Save API Key"}
                </button>
              </div>

              <div className="mt-8 p-5 bg-gradient-to-r from-[#E8F4FC] to-[#F0E6FA] dark:from-[#2A3A4A] dark:to-[#3D3058] border border-[#A8D4E6] dark:border-[#4A5568] rounded-2xl">
                <h3 className="font-bold mb-3 text-[#4A5568] dark:text-[#E2E8F0]">
                  How to get an API key:
                </h3>
                <ol className="text-sm space-y-2 list-decimal list-inside text-[#718096] dark:text-[#A0AEC0]">
                  <li>
                    Go to{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      className="text-[#7EB8D8] dark:text-[#6BA8C8] font-bold hover:text-[#6EA8C8] dark:hover:text-[#5B98B8] transition-colors"
                    >
                      platform.openai.com/api-keys
                    </a>
                  </li>
                  <li>Create a new API key</li>
                  <li>Copy it and paste it above</li>
                </ol>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

