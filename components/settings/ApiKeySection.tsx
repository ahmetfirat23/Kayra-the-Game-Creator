import { useState } from "react";

export function ApiKeySection({
  apiKeyStatus,
  byokLockedByPro,
  onSave,
}: {
  apiKeyStatus: any;
  byokLockedByPro: boolean;
  onSave: (apiKey: string) => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    try {
      await onSave(apiKey);
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save API key:", error);
    }
  };

  return (
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
                  rel="noopener noreferrer"
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
  );
}
