"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

export default function Settings() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const apiKeyStatus = useQuery(api.users.getApiKey);
  const updateApiKey = useMutation(api.users.updateApiKey);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    try {
      await updateApiKey({ apiKey });
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save API key:", error);
      alert("Failed to save API key");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Kayra
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
        <UserButton />
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-2">OpenAI API Key</h2>
          <p className="text-gray-400 text-sm mb-6">
            {apiKeyStatus?.isAdmin 
              ? "You're an admin - using system API key" 
              : "Your API key is used to power Kayra's AI. Get one at openai.com"}
          </p>

          {apiKeyStatus?.isAdmin ? (
            <div className="bg-green-900/20 border border-green-700 rounded p-4 text-green-400">
              ✓ Admin account - No API key required
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    API Key Status
                  </label>
                  <div className={`px-4 py-2 rounded ${
                    apiKeyStatus?.hasKey 
                      ? "bg-green-900/20 text-green-400" 
                      : "bg-yellow-900/20 text-yellow-400"
                  }`}>
                    {apiKeyStatus?.hasKey ? "✓ API Key Configured" : "⚠ No API Key Set"}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {apiKeyStatus?.hasKey ? "Update API Key" : "Add API Key"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                    >
                      {showKey ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Your API key is encrypted and stored securely. We never see or log it.
                  </p>
                </div>

                <button
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-bold"
                >
                  {saved ? "✓ Saved!" : "Save API Key"}
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded">
                <h3 className="font-bold mb-2">How to get an API key:</h3>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-400 underline">platform.openai.com/api-keys</a></li>
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

