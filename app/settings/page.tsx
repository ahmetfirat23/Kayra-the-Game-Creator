"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

export default function Settings() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const apiKeyStatus = useQuery(api.users.getApiKey);
  const updateApiKey = useAction(api.users.updateApiKey); // Action, not mutation

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
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-[#F5EFE3] dark:bg-gray-800 rounded-lg p-6 border-2 border-[#B5A58D] dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-2 text-[#2D1B00] dark:text-white">OpenAI API Key</h2>
          <p className="text-[#4A3425] dark:text-gray-400 text-sm mb-4">
            {apiKeyStatus?.isAdmin 
              ? "You're an admin - using system API key" 
              : "Your API key is used to power Kayra's AI. Get one at openai.com"}
          </p>
          
          {!apiKeyStatus?.isAdmin && (
            <div className="bg-[#E8F5E9] dark:bg-blue-900/20 border border-[#5A8A5E] dark:border-blue-700 rounded p-4 mb-6">
              <h3 className="text-sm font-bold text-[#3D5A3F] dark:text-blue-300 mb-2">🔐 Security Notice</h3>
              <p className="text-xs text-[#3D5A3F] dark:text-blue-300">
                Your API key is encrypted and stored securely. We only decrypt it when making AI requests on your behalf. Like all BYOK (Bring Your Own Key) services, we technically have access to your key to make API calls. Only use services you trust with your API keys.
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
                  <div className={`px-4 py-2 rounded ${
                    apiKeyStatus?.hasKey 
                      ? "bg-[#E8F5E9] dark:bg-green-900/20 text-[#3D5A3F] dark:text-green-400 border border-[#5A8A5E] dark:border-green-700" 
                      : "bg-[#FFF3E0] dark:bg-yellow-900/20 text-[#8B6914] dark:text-yellow-400 border border-[#D4A574] dark:border-yellow-700"
                  }`}>
                    {apiKeyStatus?.hasKey ? "✓ API Key Configured" : "⚠ No API Key Set"}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D1B00] dark:text-white">
                    {apiKeyStatus?.hasKey ? "Update API Key" : "Add API Key"}
                  </label>
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
                </div>

                <button
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className="w-full bg-[#5A8A5E] dark:bg-blue-600 hover:bg-[#4A7C4E] dark:hover:bg-blue-700 disabled:bg-[#C4B599] dark:disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-bold text-white"
                >
                  {saved ? "✓ Saved!" : "Save API Key"}
                </button>
              </div>

              <div className="mt-6 p-4 bg-[#E8F5E9] dark:bg-blue-900/20 border-2 border-[#5A8A5E] dark:border-blue-700 rounded">
                <h3 className="font-bold mb-2 text-[#2D1B00] dark:text-white">How to get an API key:</h3>
                <ol className="text-sm space-y-1 list-decimal list-inside text-[#4A3425] dark:text-gray-300">
                  <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" className="text-[#5A8A5E] dark:text-blue-400 underline font-bold">platform.openai.com/api-keys</a></li>
                  <li>Create a new API key</li>
                  <li>Copy it and paste it above</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

