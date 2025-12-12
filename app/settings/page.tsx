"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { CONFIG } from "../../convex/config";
import { useTheme } from "../../hooks/useTheme";
import { SettingsHeader } from "../../components/settings/SettingsHeader";
import { PlanOverview } from "../../components/settings/PlanOverview";
import { ApiKeySection } from "../../components/settings/ApiKeySection";

export default function Settings() {
  const router = useRouter();
  const { theme, toggleTheme, mounted } = useTheme();
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);

  const apiKeyStatus = useQuery(api.users.getApiKeyStatus);
  const billingStatus = useQuery(api.users.getBillingStatus);
  const remainingMessages = useQuery(api.users.getRemainingMessages);
  const updateApiKey = useAction(api.users.updateApiKey); 
  const startProSubscription = useMutation(api.users.startProSubscription);
  const cancelProSubscription = useMutation(api.users.cancelProSubscription);

  const showToast = (message: string, type: "error" | "success" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSaveApiKey = async (apiKey: string) => {
    try {
      await updateApiKey({ apiKey });
      showToast("API key saved successfully", "success");
    } catch (error) {
      console.error("Failed to save API key:", error);
      showToast("Failed to save API key", "error");
      throw error;
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
      showToast("Pro subscription activated", "success");
    } catch (error) {
      console.error("Failed to start Pro subscription:", error);
      setPlanMessage("Failed to start Pro subscription");
      showToast("Failed to start Pro subscription", "error");
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
      showToast("Pro subscription canceled", "info");
    } catch (error) {
      console.error("Failed to cancel Pro subscription:", error);
      setPlanMessage("Failed to cancel Pro subscription");
      showToast("Failed to cancel Pro subscription", "error");
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

  const remainingMessagesWithLimit = remainingMessages ? {
    ...remainingMessages,
    dailyLimit: CONFIG.FREE_TIER_DAILY_LIMIT
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-white to-[#F8F9FA] dark:from-[#1A202C] dark:via-[#1A202C] dark:to-[#2D3748] text-[#4A5568] dark:text-[#E2E8F0]">
      <SettingsHeader 
        onBack={() => router.push("/")} 
        theme={theme}
        toggleTheme={toggleTheme}
        mounted={mounted}
      />

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        <PlanOverview
          billingStatus={billingStatus}
          remainingMessages={remainingMessagesWithLimit}
          currentTierLabel={currentTierLabel}
          proRemainingM={proRemainingM}
          planMessage={planMessage}
          onStartPro={handleStartPro}
          onCancelPro={handleCancelPro}
        />

        <ApiKeySection
          apiKeyStatus={apiKeyStatus}
          byokLockedByPro={byokLockedByPro ?? false}
          onSave={handleSaveApiKey}
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className={`px-6 py-3 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] font-medium flex items-center gap-3 ${
            toast.type === "error" 
              ? "bg-[#F0B8C4] dark:bg-[#C86B7A] text-white" 
              : toast.type === "success"
              ? "bg-[#B8E8C8] dark:bg-[#4A8C6B] text-white"
              : "bg-[#A8D4E6] dark:bg-[#4A6B8C] text-white"
          }`}>
            <span className="text-xl">
              {toast.type === "error" ? "❌" : toast.type === "success" ? "✓" : "ℹ️"}
            </span>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

