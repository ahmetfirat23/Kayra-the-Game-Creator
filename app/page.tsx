"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { FreestyleDevServer } from "freestyle-sandboxes/react/dev-server";
import { requestDevServer } from "../lib/freestyle-actions";
import ReactMarkdown from "react-markdown";
import { UserButton } from "@clerk/nextjs";

/**
 * Message component that renders a single message with smooth text streaming.
 * Uses useSmoothText to animate text as it streams in for a better UX.
 */
function MessageComponent({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";

  // Extract tool calls from message parts
  type MessagePart = { type?: string; output?: string | object; [key: string]: unknown };
  const toolCalls = (message.parts as MessagePart[] | undefined)?.filter((part) => part.type?.startsWith('tool-')) || [];

  return (
    <div 
      className={`p-3 rounded-lg max-w-[90%] ${
        isUser
        ? "bg-[#5A8A5E] dark:bg-blue-600 self-end ml-auto"
        : "bg-[#D4C5A9] dark:bg-gray-700"
      }`}
    >
      <div className={`text-xs mb-1 uppercase font-bold flex items-center gap-2 ${
        isUser ? "text-[#F5EFE3] dark:text-white" : "text-[#5B4332] dark:text-gray-300"
      }`}>
        <span>{isUser ? "You" : "Kayra"}</span>
        {isStreaming && (
          <span className="text-xs animate-pulse">●</span>
        )}
      </div>
      
      {/* Display text content with markdown formatting */}
      {visibleText && (
        <div className="mb-2 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 leading-relaxed text-[#4A3425] dark:text-gray-200">{children}</p>,
              strong: ({ children }) => <strong className="font-bold text-[#2D1B00] dark:text-white">{children}</strong>,
              em: ({ children }) => <em className="italic text-[#4A3425] dark:text-gray-200">{children}</em>,
              h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3 text-[#2D1B00] dark:text-white">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 text-[#2D1B00] dark:text-white">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2 text-[#2D1B00] dark:text-white">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-[#4A3425] dark:text-gray-200">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-[#4A3425] dark:text-gray-200">{children}</ol>,
              li: ({ children }) => <li className="ml-2">{children}</li>,
              code: ({ children }) => <code className="bg-[#B5A58D] dark:bg-gray-800 px-1 py-0.5 rounded text-sm text-[#2D1B00] dark:text-gray-200">{children}</code>,
              pre: ({ children }) => <pre className="bg-[#B5A58D] dark:bg-gray-800 p-2 rounded overflow-x-auto mb-2 text-[#2D1B00] dark:text-gray-200">{children}</pre>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-[#5A8A5E] dark:border-gray-600 pl-3 italic my-2 text-[#4A3425] dark:text-gray-300">{children}</blockquote>,
            }}
          >
            {visibleText}
          </ReactMarkdown>
        </div>
      )}
      
      {/* Display tool calls */}
      {toolCalls.length > 0 && (
        <div className="mt-2 space-y-2">
          {toolCalls.map((tool, idx: number) => (
            <div key={idx} className="bg-[#B5A58D] dark:bg-gray-800 p-2 rounded text-xs border border-[#9A8A70] dark:border-gray-700">
              <div className="text-[#5A8A5E] dark:text-blue-300 font-mono mb-1 font-bold">
                🔧 {tool.type ? tool.type.replace('tool-', '') : 'tool'}
              </div>
              {tool.output && (
                <div className="text-[#2D1B00] dark:text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  
  const chats = useQuery(api.chat.listChats) || [];
  const apiKeyStatus = useQuery(api.users.getApiKey);
  const syncUser = useMutation(api.users.syncUser);
  const updateApiKey = useAction(api.users.updateApiKey); // Action, not mutation
  const deleteApiKey = useMutation(api.users.deleteApiKey);
  const deleteChat = useMutation(api.chat.deleteChat);

  // Sync user on mount (create user record if doesn't exist)
  useEffect(() => {
    console.log("Syncing user...");
    syncUser()
      .then((userId) => console.log("User synced:", userId))
      .catch((err) => console.error("Failed to sync user:", err));
  }, [syncUser]);
  
  // Get chat to retrieve threadId and repoId
  const selectedChat = useQuery(
    api.chat.getChat,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  );

  // Get streaming messages
  const messagesData = useQuery(
    api.chat.listThreadMessages,
    selectedChat?.threadId 
      ? { 
          threadId: selectedChat.threadId,
          paginationOpts: { numItems: 50, cursor: null },
          streamArgs: { kind: "list" as const }
        }
      : "skip"
  );

  // Extract messages from the paginated result
  const messages = messagesData?.page || [];
  
  // Check if any message is currently streaming
  const isStreaming = messages.some((msg) => msg.status === "streaming");
  
  // Check if any commit has been made - use the same check as we do for display
  type MessagePart = { type?: string; [key: string]: unknown };
  const hasCommitted = messages.some((msg) => 
    (msg.parts as MessagePart[] | undefined)?.some((part) => {
      if (!part.type?.startsWith('tool-')) return false;
      // Get the tool name the same way we display it
      const toolName = part.type.replace('tool-', '');
      return toolName.includes('commitAndPush');
    })
  );
  
  const sendMessage = useMutation(api.chat.sendMessage);
  const createChat = useMutation(api.chat.createChat);

  // Auto-select the first chat when chats are loaded and none is selected
  const firstChatId = chats.length > 0 ? chats[0]._id : null;
  useEffect(() => {
    if (firstChatId && !selectedChatId) {
      setSelectedChatId(firstChatId);
    }
  }, [firstChatId, selectedChatId]);

  /**
   * Creates a new chat with Freestyle repo and automatically selects it.
   * Shows loading state during creation.
   */
  const handleCreateChat = async () => {
    // Check if user has API key
    if (apiKeyStatus && !apiKeyStatus.hasKey && !apiKeyStatus.isAdmin) {
      setShowApiKeyModal(true);
      return;
    }

    setIsCreatingChat(true);
    try {
      const chatId = await createChat();
      setSelectedChatId(chatId);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    
    setSavingKey(true);
    try {
      await updateApiKey({ apiKey });
      setShowApiKeyModal(false);
      setApiKey("");
      alert("✅ API key validated and saved successfully!");
    } catch (error) {
      console.error("Failed to save API key:", error);
      // Extract the actual error message from Convex error format
      let errorMessage = "Failed to save API key";
      if (error instanceof Error) {
        // Look for "Uncaught Error: " pattern which contains the actual error
        const uncaughtMatch = error.message.match(/Uncaught Error: (.+?)(?:\n|$)/);
        if (uncaughtMatch) {
          errorMessage = uncaughtMatch[1];
        } else {
          // Fallback: try to extract after CONVEX wrapper
          const convexMatch = error.message.match(/\[CONVEX A\([^)]+\)\](?:\s*\[Request ID: [^\]]+\])?\s*(.+?)(?:\n|$)/);
          errorMessage = convexMatch ? convexMatch[1] : error.message;
        }
      }
      alert(`❌ ${errorMessage}`);
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm("Delete your API key? You'll need to add it again to create games.")) return;
    
    setSavingKey(true);
    try {
      await deleteApiKey();
      setShowApiKeyModal(false);
      alert("API key deleted successfully!");
    } catch (error) {
      console.error("Failed to delete API key:", error);
      alert("Failed to delete API key");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteChat = async (chatId: Id<"chats">) => {
    if (!confirm("Delete this game project? This cannot be undone.")) return;
    
    try {
      await deleteChat({ chatId });
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      alert("Failed to delete chat");
    }
  };

  /**
   * Handles message submission: validates input, clears the input field,
   * and sends the message to the selected chat.
   */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedChatId || isStreaming) return;
    
    // Check if user has API key
    if (apiKeyStatus && !apiKeyStatus.hasKey && !apiKeyStatus.isAdmin) {
      setShowApiKeyModal(true);
      return;
    }
    
    // Check if repo is ready
    if (selectedChat?.repoId === "pending") {
      alert("Repository is still being created. Please wait a moment...");
      return;
    }
    
    const messageText = input;
    setInput("");
    
    try {
      await sendMessage({ chatId: selectedChatId, text: messageText });
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. The repository might still be loading.");
    }
  };

  return (
    <main className="flex flex-col h-screen bg-[#E8DCC8] dark:bg-gray-900 text-[#4A3425] dark:text-white">
      {/* Top Bar with Brand, Chat Selector, Preview Title, and User */}
      <div className="h-16 px-4 border-b border-[#B5A58D] dark:border-gray-700 flex items-center justify-between gap-4">
        {/* Left: Brand + Chat Controls */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="text-2xl font-bold bg-gradient-to-r from-[#2D1B00] via-[#5B4332] to-[#5A8A5E] dark:from-blue-500 dark:via-blue-500 dark:to-purple-600 bg-clip-text text-transparent">
              Kayra
            </div>
            <div className="text-xs text-[#5B4332] dark:text-gray-500 mt-1 font-medium">the Game Creator</div>
          </div>
          
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <select
              value={selectedChatId || ""}
              onChange={(e) => setSelectedChatId(e.target.value as Id<"chats">)}
              className="bg-[#F5EFE3] dark:bg-gray-800 border border-[#B5A58D] dark:border-gray-600 rounded px-3 py-2 text-sm text-[#2D1B00] dark:text-white focus:outline-none focus:border-[#5A8A5E] dark:focus:border-blue-500 flex-1 font-medium"
            >
              {chats.map((chat) => (
                <option key={chat._id} value={chat._id}>
                  {chat.name}
                </option>
              ))}
            </select>
            {selectedChatId && (
              <button
                onClick={() => handleDeleteChat(selectedChatId)}
                className="bg-[#A85842] dark:bg-red-700 hover:bg-[#8B4332] dark:hover:bg-red-900 px-3 py-2 rounded text-sm text-white"
                title="Delete chat"
              >
                🗑️
              </button>
            )}
            <button
              onClick={handleCreateChat}
              disabled={isCreatingChat}
              className="bg-[#5A8A5E] dark:bg-green-600 hover:bg-[#4A7C4E] dark:hover:bg-green-700 disabled:bg-[#C4B599] dark:disabled:bg-gray-700 disabled:cursor-not-allowed px-3 py-2 rounded text-sm font-bold whitespace-nowrap text-white"
            >
              {isCreatingChat ? "..." : "+ New"}
            </button>
          </div>
        </div>
        
        {/* Right: Preview Title + User Menu */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#2D1B00] dark:text-white">Live Preview</span>
            <span className="text-xl">🎮</span>
          </div>
          
          <div className="h-8 w-px bg-[#C4B599] dark:bg-gray-700"></div>
          
          <div className="flex items-center gap-3">
            {apiKeyStatus && !apiKeyStatus.isAdmin && (
              <button
                onClick={() => setShowApiKeyModal(true)}
                className={`text-xs px-3 py-1 rounded font-bold ${
                  apiKeyStatus.hasKey
                    ? "bg-[#D4C5A9] dark:bg-gray-700 hover:bg-[#C4B599] dark:hover:bg-gray-600 text-[#3D2817] dark:text-gray-300"
                    : "bg-[#D4A574] dark:bg-yellow-600 hover:bg-[#C49564] dark:hover:bg-yellow-700 text-white"
                }`}
              >
                {apiKeyStatus.hasKey ? "Update API Key" : "Add API Key"}
              </button>
            )}
            <UserButton />
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#F5EFE3] dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-2 text-[#2D1B00] dark:text-white">
              {apiKeyStatus?.hasKey ? "Update" : "Add"} OpenAI API Key
            </h2>
            <p className="text-sm text-[#4A3425] dark:text-gray-400 mb-4">
              Your API key is used to power Kayra&apos;s AI. Get one at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                className="text-[#5A8A5E] dark:text-blue-400 underline font-bold"
              >
                openai.com
              </a>
            </p>
            
            <div className="bg-[#E8F5E9] dark:bg-blue-900/20 border border-[#5A8A5E] dark:border-blue-700 rounded p-3 mb-4">
              <p className="text-xs text-[#3D5A3F] dark:text-blue-300">
                🔐 Your API key is encrypted and stored securely. We only decrypt it when making AI requests on your behalf. Like all BYOK services, we technically have access to your key—only use services you trust.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="flex-1 bg-white dark:bg-gray-700 border border-[#B5A58D] dark:border-gray-600 rounded px-4 py-2 text-[#2D1B00] dark:text-white focus:outline-none focus:border-[#5A8A5E] dark:focus:border-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="px-4 py-2 bg-[#D4C5A9] dark:bg-gray-700 hover:bg-[#C4B599] dark:hover:bg-gray-600 rounded text-[#2D1B00] dark:text-white"
                >
                  {showKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowApiKeyModal(false);
                    setApiKey("");
                  }}
                  className="flex-1 bg-[#D4C5A9] dark:bg-gray-700 hover:bg-[#C4B599] dark:hover:bg-gray-600 px-4 py-2 rounded text-[#2D1B00] dark:text-white font-medium"
                >
                  Cancel
                </button>
                {apiKeyStatus?.hasKey && (
                  <button
                    onClick={handleDeleteApiKey}
                    disabled={savingKey}
                    className="flex-1 bg-[#A85842] dark:bg-gray-600 hover:bg-[#8B4332] dark:hover:bg-gray-500 disabled:bg-[#C4B599] dark:disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded text-white"
                  >
                    Delete Key
                  </button>
                )}
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKey.trim() || savingKey}
                  className="flex-1 bg-[#5A8A5E] dark:bg-blue-600 hover:bg-[#4A7C4E] dark:hover:bg-blue-700 disabled:bg-[#C4B599] dark:disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-bold text-white"
                >
                  {savingKey ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel - 50% */}
        <div className="w-1/2 flex flex-col border-r border-[#B5A58D] dark:border-gray-700 overflow-hidden">

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 min-h-0">
          {selectedChat?.repoId === "pending" ? (
            <div className="text-center text-[#5A8A5E] dark:text-blue-500 mt-8 text-sm animate-pulse">
              <div className="text-2xl mb-2">⚙️</div>
              Setting up your 3D game project...
              <div className="mt-2 text-xs text-[#6B5844] dark:text-gray-400">
                Creating Git repository and dev server
              </div>
            </div>
          ) : selectedChat && selectedChat.repoId && selectedChat.repoId !== "pending" ? (
            messages && messages.length > 0 ? (
              messages.map((msg) => (
                <MessageComponent key={msg.id} message={msg} />
              ))
            ) : (
              <div className="text-center text-[#5B4332] dark:text-gray-500 mt-8 text-sm">
                <div className="text-3xl mb-3">👋</div>
                <div className="text-lg font-bold text-[#2D1B00] dark:text-white mb-2">Hi! I&apos;m Kayra</div>
                <div className="mb-4 text-[#4A3425] dark:text-gray-300">Tell me what kind of 3D game you want to create!</div>
                <div className="mt-4 text-xs text-[#6B5844] dark:text-gray-600">
                  Try: &quot;Make a flappy bird game&quot; or &quot;Create a racing game&quot;
                </div>
              </div>
            )
          ) : (
            <div className="text-center text-[#5B4332] dark:text-gray-500 mt-8 text-sm">
              {chats.length === 0 
                ? "Create your first 3D game project!"
                : "Select a project to continue"}
            </div>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="p-6 border-t border-[#B5A58D] dark:border-gray-700">
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedChat?.repoId === "pending" 
                  ? "Setting up project..." 
                  : isStreaming 
                  ? "Kayra is working..." 
                  : "Tell Kayra what game you want to create..."
              }
              disabled={!selectedChatId || selectedChat?.repoId === "pending" || isStreaming}
              className="flex-1 bg-[#F5EFE3] dark:bg-gray-800 border border-[#B5A58D] dark:border-gray-600 text-[#2D1B00] dark:text-white rounded p-2 text-sm focus:outline-none focus:border-[#5A8A5E] dark:focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder-[#8B7A65] dark:placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={!selectedChatId || selectedChat?.repoId === "pending" || isStreaming}
              className="bg-[#5A8A5E] dark:bg-blue-500 hover:bg-[#4A7C4E] dark:hover:bg-blue-600 disabled:bg-[#C4B599] dark:disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-bold text-sm text-white"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Preview Panel - 50% */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <div className="flex-1 bg-[#D4C5A9] dark:bg-gray-950 p-6 flex items-center justify-center">
          {selectedChat?.repoId === "pending" ? (
            <div className="text-[#5A8A5E] dark:text-blue-500 text-center animate-pulse">
              <div className="text-4xl mb-4">⚙️</div>
              <div className="text-sm text-[#2D1B00] dark:text-white font-medium">Setting up dev environment...</div>
              <div className="text-xs text-[#5B4332] dark:text-gray-500 mt-2">This may take 30-60 seconds</div>
            </div>
          ) : selectedChat?.repoId && hasCommitted ? (
            <div className="w-full h-full rounded-lg overflow-hidden border-2 border-[#8B7A65] dark:border-gray-700 shadow-2xl">
              <FreestyleDevServer 
                actions={{ requestDevServer }} 
                repoId={selectedChat.repoId} 
              />
            </div>
          ) : (
            <div className="text-[#5B4332] dark:text-gray-600 text-center">
              <div className="text-4xl mb-4">🎮</div>
              <div className="text-sm">
                {selectedChat?.repoId && messages.length > 0
                  ? "Kayra is designing your game..."
                  : selectedChat?.repoId 
                  ? "Describe your game idea to get started"
                  : "Create a chat to start building games"}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}