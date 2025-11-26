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
    <div className="min-h-screen bg-[#E8DCC8] dark:bg-gray-900 text-[#4A3425] dark:text-white">
      {/* Header */}
      <div className="border-b border-[#B5A58D] dark:border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-[#5A8A5E] dark:text-blue-400 hover:text-[#4A7C4E] dark:hover:text-blue-300 font-bold"
          >
            ← Back to Kayra
          </button>
          <h1 className="text-xl font-bold text-[#2D1B00] dark:text-white">Settings</h1>
        </div>
        <UserButton />
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Tier list / plan overview */}
        <section className="bg-[#F5EFE3] dark:bg-gray-800 rounded-lg p-6 border-2 border-[#B5A58D] dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-2 text-[#2D1B00] dark:text-white">
            Plan & Usage
          </h2>
          <p className="text-sm text-[#4A3425] dark:text-gray-400 mb-4">
            Choose how you want to power Kayra. Start free, bring your own OpenAI key, or upgrade
            to Pro for a large monthly token allowance.
          </p>

          {billingStatus && (
            <div className="mb-4 text-sm text-[#4A3425] dark:text-gray-300">
              <span className="font-semibold">Current plan:</span>{" "}
              <span className="font-bold">{currentTierLabel}</span>
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
                <div className="mt-1 text-xs">
                  {remainingMessages.remainingMessages}/{remainingMessages.totalDailyLimit} free
                  messages left today
                </div>
              )}
              {proRemainingM !== null && (
                <div className="mt-1 text-xs">
                  {proRemainingM}M Pro tokens remaining this period
                </div>
              )}
            </div>
          )}

          {planMessage && (
            <div className="mb-4 text-xs px-3 py-2 rounded bg-[#D4C5A9] dark:bg-gray-700 text-[#2D1B00] dark:text-gray-100">
              {planMessage}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            {/* Free tier */}
            <div className="rounded-lg border border-[#B5A58D] dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-4 flex flex-col">
              <h3 className="text-lg font-bold text-[#2D1B00] dark:text-white mb-1">Free</h3>
              <p className="text-xs text-[#6B5844] dark:text-gray-400 mb-2">
                Try Kayra with a small daily allowance using our shared OpenAI key.
              </p>
              <ul className="text-xs text-[#4A3425] dark:text-gray-300 space-y-1 mb-4">
                <li>• 5 free messages per day</li>
                <li>• Great for quick experiments</li>
              </ul>
              <div className="mt-auto text-xs font-bold text-[#5A8A5E] dark:text-green-400">
                Always available
              </div>
            </div>

            {/* BYOK */}
            <div className="rounded-lg border border-[#5A8A5E] dark:border-blue-600 bg-[#E8F5E9] dark:bg-blue-900/40 p-4 flex flex-col">
              <h3 className="text-lg font-bold text-[#2D1B00] dark:text-white mb-1">
                Bring Your Own Key
              </h3>
              <p className="text-xs text-[#3D5A3F] dark:text-blue-200 mb-2">
                Use your own OpenAI API key. You pay OpenAI directly; we don&apos;t meter usage.
              </p>
              <ul className="text-xs text-[#3D5A3F] dark:text-blue-100 space-y-1 mb-4">
                <li>• Unlimited messages (subject to your OpenAI limits)</li>
                <li>• Best for regular usage</li>
                <li>• Your key is encrypted at rest</li>
              </ul>
              <button
                onClick={() => {
                  const el = document.getElementById("byok-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-auto text-xs px-3 py-1 rounded bg-[#5A8A5E] dark:bg-blue-600 hover:bg-[#4A7C4E] dark:hover:bg-blue-700 text-white font-bold"
              >
                Configure BYOK
              </button>
            </div>

            {/* Pro */}
            <div className="rounded-lg border border-[#D4A574] dark:border-yellow-600 bg-[#FFF3E0] dark:bg-yellow-900/30 p-4 flex flex-col">
              <h3 className="text-lg font-bold text-[#5B4332] dark:text-yellow-200 mb-1">
                Pro
              </h3>
              <p className="text-xs text-[#8B6914] dark:text-yellow-300 mb-2">
                $20/month
              </p>
              <ul className="text-xs text-[#6B5844] dark:text-yellow-200 space-y-1 mb-4">
                <li>• 25M tokens per 30-day period</li>
                <li>• Renews every 30 days until you cancel</li>
                <li>• If you cancel, Pro lasts until the end of the current period</li>
              </ul>
              {!billingStatus?.isAdmin && (
                <div className="mt-auto flex flex-col gap-2">
                  {billingStatus?.pro?.isActive ? (
                    billingStatus.pro.status === "canceled" ? (
                      <button
                        onClick={handleStartPro}
                        className="text-xs px-3 py-1 rounded bg-[#5A8A5E] dark:bg-green-700 hover:bg-[#4A7C4E] dark:hover:bg-green-800 text-white font-bold"
                      >
                        Continue Pro
                      </button>
                    ) : (
                      <button
                        onClick={handleCancelPro}
                        className="text-xs px-3 py-1 rounded bg-[#A85842] dark:bg-red-700 hover:bg-[#8B4332] dark:hover:bg-red-900 text-white font-bold"
                      >
                        Cancel Pro
                      </button>
                    )
                  ) : (
                    <button
                      onClick={handleStartPro}
                      className="text-xs px-3 py-1 rounded bg-[#D4A574] dark:bg-yellow-700 hover:bg-[#C49564] dark:hover:bg-yellow-800 text-white font-bold"
                    >
                      Buy Pro ($20/mo)
                    </button>
                  )}
                  <p className="text-[10px] text-[#6B5844] dark:text-yellow-200">
                    This is a prototype: &quot;Buy&quot; and &quot;Cancel&quot; only change your
                    plan state; no real billing is performed.
                  </p>
                </div>
              )}
              {billingStatus?.isAdmin && (
                <div className="mt-auto text-xs font-bold text-[#3D5A3F] dark:text-green-300">
                  Admin accounts already have full access.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* BYOK / API key configuration */}
        <section
          id="byok-section"
          className="bg-[#F5EFE3] dark:bg-gray-800 rounded-lg p-6 border-2 border-[#B5A58D] dark:border-gray-700"
        >
          <h2 className="text-2xl font-bold mb-2 text-[#2D1B00] dark:text-white">
            OpenAI API Key (BYOK)
          </h2>
          <p className="text-[#4A3425] dark:text-gray-400 text-sm mb-4">
            {apiKeyStatus?.isAdmin 
              ? "You're an admin - using system API key."
              : "Add your own OpenAI API key to switch from the free shared tier to the BYOK tier."}
          </p>
          
          {!apiKeyStatus?.isAdmin && (
            <div className="bg-[#E8F5E9] dark:bg-blue-900/20 border border-[#5A8A5E] dark:border-blue-700 rounded p-4 mb-6">
              <h3 className="text-sm font-bold text-[#3D5A3F] dark:text-blue-300 mb-2">
                🔐 Security Notice
              </h3>
              <p className="text-xs text-[#3D5A3F] dark:text-blue-300">
                Your API key is encrypted and stored securely. We only decrypt it when making AI
                requests on your behalf. Like all BYOK services, we technically have access to your
                key to make API calls. Only use services you trust with your API keys.
              </p>
            </div>
          )}

          {apiKeyStatus?.isAdmin ? (
            <div className="bg-[#E8F5E9] dark:bg-green-900/20 border border-[#5A8A5E] dark:border-green-700 rounded p-4 text-[#3D5A3F] dark:text-green-400 font-bold">
              ✓ Admin account - No API key required
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D1B00] dark:text-white">
                    API Key Status
                  </label>
                  <div
                    className={`px-4 py-2 rounded ${
                    apiKeyStatus?.hasKey 
                      ? "bg-[#E8F5E9] dark:bg-green-900/20 text-[#3D5A3F] dark:text-green-400 border border-[#5A8A5E] dark:border-green-700" 
                      : "bg-[#FFF3E0] dark:bg-yellow-900/20 text-[#8B6914] dark:text-yellow-400 border border-[#D4A574] dark:border-yellow-700"
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
                      className="flex-1 bg-white dark:bg-gray-700 border border-[#B5A58D] dark:border-gray-600 rounded px-4 py-2 text-[#2D1B00] dark:text-white focus:outline-none focus:border-[#5A8A5E] dark:focus:border-blue-500"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="px-4 py-2 bg-[#D4C5A9] dark:bg-gray-700 hover:bg-[#C4B599] dark:hover:bg-gray-600 rounded text-[#2D1B00] dark:text-white"
                    >
                      {showKey ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  <p className="text-xs text-[#5B4332] dark:text-gray-500 mt-2">
                    Your API key is encrypted and stored securely. We never see or log it.
                  </p>
                  {byokLockedByPro && (
                    <p className="text-[10px] text-[#8B6914] dark:text-yellow-300 mt-1">
                      Pro is active with remaining tokens. BYOK configuration is locked until your
                      Pro allowance is depleted.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSave}
                  disabled={!apiKey.trim() || byokLockedByPro}
                  className="w-full bg-[#5A8A5E] dark:bg-blue-600 hover:bg-[#4A7C4E] dark:hover:bg-blue-700 disabled:bg-[#C4B599] dark:disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-bold text-white"
                >
                  {saved ? "✓ Saved!" : "Save API Key"}
                </button>
              </div>

              <div className="mt-6 p-4 bg-[#E8F5E9] dark:bg-blue-900/20 border-2 border-[#5A8A5E] dark:border-blue-700 rounded">
                <h3 className="font-bold mb-2 text-[#2D1B00] dark:text-white">
                  How to get an API key:
                </h3>
                <ol className="text-sm space-y-1 list-decimal list-inside text-[#4A3425] dark:text-gray-300">
                  <li>
                    Go to{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      className="text-[#5A8A5E] dark:text-blue-400 underline font-bold"
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

