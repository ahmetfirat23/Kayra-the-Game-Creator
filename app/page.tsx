"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { FreestyleDevServer } from "freestyle-sandboxes/react/dev-server";
import { requestDevServer } from "../lib/freestyle-actions";
import ReactMarkdown from "react-markdown";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

/**
 * Landing page component shown to non-authenticated users
 */
function LandingPage() {
  return (
    <main className="h-screen flex flex-col bg-gradient-to-br from-[#E8DCC8] via-[#F5EFE3] to-[#D4C5A9] dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-auto">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-5xl mx-auto text-center w-full">
          {/* Logo and Title */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="text-5xl">🌳</div>
            </div>
            <h1 className="text-5xl font-bold mb-0 pb-1 leading-tight bg-gradient-to-r from-[#2D1B00] via-[#5B4332] to-[#5A8A5E] dark:from-green-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              Kayra
            </h1>
            <p className="text-xl text-[#5B4332] dark:text-gray-300 font-medium mb-3">
              the Game Creator
            </p>
            <p className="text-base text-[#6B5844] dark:text-gray-400 max-w-2xl mx-auto">
              Transform your game ideas into reality with AI-powered 3D game creation
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-[#B5A58D] dark:border-gray-700">
              <div className="text-3xl mb-2">🎮</div>
              <h3 className="text-base font-bold text-[#2D1B00] dark:text-white mb-1">
                Create 3D Games
              </h3>
              <p className="text-xs text-[#5B4332] dark:text-gray-400">
                Tell Kayra your game idea and watch it come to life in real-time
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-[#B5A58D] dark:border-gray-700">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="text-base font-bold text-[#2D1B00] dark:text-white mb-1">
                Instant Preview
              </h3>
              <p className="text-xs text-[#5B4332] dark:text-gray-400">
                See your game running live as Kayra builds it for you
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-[#B5A58D] dark:border-gray-700">
              <div className="text-3xl mb-2">🤖</div>
              <h3 className="text-base font-bold text-[#2D1B00] dark:text-white mb-1">
                AI-Powered
              </h3>
              <p className="text-xs text-[#5B4332] dark:text-gray-400">
                Advanced AI understands your vision and creates the code
              </p>
            </div>
          </div>

          {/* Pricing Info */}
          <div className="bg-gradient-to-r from-[#5A8A5E]/20 to-[#D4C5A9]/20 dark:from-green-900/30 dark:to-blue-900/30 backdrop-blur-sm rounded-2xl p-6 mb-6 border-2 border-[#5A8A5E] dark:border-green-700 shadow-xl">
            <div className="text-2xl mb-2">🎁</div>
            <h3 className="text-xl font-bold text-[#2D1B00] dark:text-white mb-2">
              Start Creating for Free
            </h3>
            <p className="text-base text-[#4A3425] dark:text-gray-300 mb-1">
              Get <span className="font-bold text-[#5A8A5E] dark:text-green-400 text-lg">5 free messages per day</span> to bring your game ideas to life
            </p>
            <p className="text-xs text-[#6B5844] dark:text-gray-400">
              No credit card required • Start building immediately
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <SignInButton mode="modal">
              <button className="bg-[#5A8A5E] dark:bg-green-600 hover:bg-[#4A7C4E] dark:hover:bg-green-700 text-white font-bold text-base px-8 py-3 rounded-lg shadow-lg transform transition hover:scale-105">
                Get Started Free
              </button>
            </SignInButton>
            <p className="text-xs text-[#6B5844] dark:text-gray-500">
              Already have an account? 
              <SignInButton mode="modal">
                <button className="ml-1 text-[#5A8A5E] dark:text-green-400 font-bold hover:underline">
                  Sign in
                </button>
              </SignInButton>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 border-t border-[#B5A58D] dark:border-gray-700 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs text-[#6B5844] dark:text-gray-500">
            © 2025 Kayra • Powered by OpenAI • Built for Creators
          </p>
        </div>
      </footer>
    </main>
  );
}

/**
 * Message component that renders a single message with smooth text streaming.
 * Uses useSmoothText to animate text as it streams in for a better UX.
 */
function MessageComponent({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const usage = (message.metadata as { usage?: { totalTokens?: number } } | undefined)?.usage;
  const totalTokens = !isUser ? usage?.totalTokens : undefined;

  // Extract tool calls from message parts
  type MessagePart = { type?: string; output?: string | object; [key: string]: unknown };
  const toolCalls = (message.parts as MessagePart[] | undefined)?.filter((part) => part.type?.startsWith('tool-')) || [];

  const toggleTool = (idx: number) => {
    setExpandedTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  return (
    <div 
      className={`p-2 md:p-3 rounded-lg max-w-[95%] md:max-w-[90%] ${
        isUser
        ? "bg-[#5A8A5E] dark:bg-blue-600 self-end ml-auto"
        : "bg-[#D4C5A9] dark:bg-gray-700"
      }`}
    >
      <div className={`text-[10px] md:text-xs mb-1 uppercase font-bold flex items-center gap-1 md:gap-2 ${
        isUser ? "text-white dark:text-white" : "text-[#5B4332] dark:text-gray-300"
      }`}>
        <span>{isUser ? "You" : "Kayra"}</span>
        {isStreaming && (
          <span className="text-xs animate-pulse">●</span>
        )}
        {!isUser && typeof totalTokens === "number" && totalTokens > 0 && (
          <span className="ml-auto text-[10px] font-normal opacity-70 lowercase">
            {totalTokens} tokens
          </span>
        )}
      </div>
      
      {/* Display text content with markdown formatting */}
      {visibleText && (
        <div className="mb-2 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className={`mb-2 leading-relaxed ${isUser ? 'text-gray-200' : 'text-[#4A3425]'} dark:text-gray-200`}>{children}</p>,
              strong: ({ children }) => <strong className={`font-bold ${isUser ? 'text-white' : 'text-[#2D1B00]'} dark:text-white`}>{children}</strong>,
              em: ({ children }) => <em className={`italic ${isUser ? 'text-gray-200' : 'text-[#4A3425]'} dark:text-gray-200`}>{children}</em>,
              h1: ({ children }) => <h1 className={`text-xl font-bold mb-2 mt-3 ${isUser ? 'text-white' : 'text-[#2D1B00]'} dark:text-white`}>{children}</h1>,
              h2: ({ children }) => <h2 className={`text-lg font-bold mb-2 mt-3 ${isUser ? 'text-white' : 'text-[#2D1B00]'} dark:text-white`}>{children}</h2>,
              h3: ({ children }) => <h3 className={`text-base font-bold mb-2 mt-2 ${isUser ? 'text-white' : 'text-[#2D1B00]'} dark:text-white`}>{children}</h3>,
              ul: ({ children }) => <ul className={`list-disc list-inside mb-2 space-y-1 ${isUser ? 'text-gray-200' : 'text-[#4A3425]'} dark:text-gray-200`}>{children}</ul>,
              ol: ({ children }) => <ol className={`list-decimal list-inside mb-2 space-y-1 ${isUser ? 'text-gray-200' : 'text-[#4A3425]'} dark:text-gray-200`}>{children}</ol>,
              li: ({ children }) => <li className="ml-2">{children}</li>,
              code: ({ children }) => <code className={`px-1 py-0.5 rounded text-sm ${isUser ? 'bg-[#4A7C4E] text-gray-200' : 'bg-[#B5A58D] text-[#2D1B00]'} dark:bg-gray-800 dark:text-gray-200`}>{children}</code>,
              pre: ({ children }) => <pre className={`p-2 rounded overflow-x-auto mb-2 ${isUser ? 'bg-[#4A7C4E] text-gray-200' : 'bg-[#B5A58D] text-[#2D1B00]'} dark:bg-gray-800 dark:text-gray-200`}>{children}</pre>,
              blockquote: ({ children }) => <blockquote className={`border-l-4 pl-3 italic my-2 ${isUser ? 'border-white text-gray-200' : 'border-[#5A8A5E] text-[#4A3425]'} dark:border-gray-600 dark:text-gray-300`}>{children}</blockquote>,
            }}
          >
            {visibleText}
          </ReactMarkdown>
        </div>
      )}
      
      {/* Display tool calls */}
      {toolCalls.length > 0 && (
        <div className="mt-2 space-y-2">
          {toolCalls.map((tool, idx: number) => {
            const toolName = tool.type ? tool.type.replace('tool-', '') : 'tool';
            const isFileOperation = toolName.toLowerCase().includes('write') || toolName.toLowerCase().includes('file');
            const isExpanded = expandedTools.has(idx);
            const toolWithArgs = tool as { args?: unknown; output?: unknown };
            
            // Format tool arguments for display
            const formatArgs = (args: unknown): string => {
              if (typeof args === 'string') {
                return args;
              }
              try {
                return JSON.stringify(args, null, 2);
              } catch {
                return String(args);
              }
            };
            
            return (
              <div key={idx} className="bg-[#B5A58D] dark:bg-gray-800 rounded text-xs border border-[#9A8A70] dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => toggleTool(idx)}
                  className="w-full p-3 text-left hover:bg-[#A59580] dark:hover:bg-gray-700 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="text-[#5A8A5E] dark:text-blue-300 font-mono font-bold flex items-center gap-2">
                    {isFileOperation ? '📝' : '🔧'} {toolName}
                  </div>
                  <div className={`text-[#5A8A5E] dark:text-blue-300 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                    ▶
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-[#9A8A70] dark:border-gray-700 bg-[#2D1B00]/5 dark:bg-black/30 p-3 space-y-3">
                    {/* Show tool arguments if available (e.g., full file content for writeFile) */}
                    {toolWithArgs.args !== undefined && toolWithArgs.args !== null && (
                      <div>
                        <div className="text-xs font-bold text-[#5A8A5E] dark:text-blue-300 mb-1">Arguments:</div>
                        <pre className="text-[#2D1B00] dark:text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed">
                          {formatArgs(toolWithArgs.args)}
                        </pre>
                      </div>
                    )}
                    {/* Show tool output */}
                    {tool.output && (() => {
                      const outputStr = typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2);
                      
                      // Extract full content if present (for readFile)
                      // Check for both old and new metadata formats
                      const fullContentMatch = outputStr.match(/<!--FULL_CONTENT_METADATA:(.+?)-->/) || 
                                               outputStr.match(/<!--FULL_CONTENT:(.+?)-->/);
                      let displayOutput = outputStr;
                      let fullContent: string | null = null;
                      
                      if (fullContentMatch) {
                        try {
                          const parsed = JSON.parse(fullContentMatch[1]);
                          if (parsed._fullContent) {
                            fullContent = parsed._fullContent;
                            // Remove the metadata marker from display
                            displayOutput = outputStr.replace(/<!--FULL_CONTENT[^:]*:.+?-->/, '').trim();
                          }
                        } catch {
                          // If parsing fails, check if the output itself is the full content
                          // (for readFile, the output might be the full file content)
                          if (outputStr.length > 1000 && !outputStr.includes('✅ Read')) {
                            // Likely full content without metadata marker
                            fullContent = outputStr.split('<!--FULL_CONTENT_METADATA:')[0].trim();
                            displayOutput = `✅ File content (${fullContent.split('\n').length} lines)`;
                          }
                        }
                      } else if (outputStr.length > 1000 && toolName.includes('readFile')) {
                        // If it's a readFile and output is large, it's likely the full content
                        fullContent = outputStr.split('<!--FULL_CONTENT_METADATA:')[0].trim();
                        displayOutput = `✅ File content (${fullContent.split('\n').length} lines)`;
                      }
                      
                      return (
                        <div>
                          {toolWithArgs.args !== undefined && toolWithArgs.args !== null && (
                            <div className="text-xs font-bold text-[#5A8A5E] dark:text-blue-300 mb-1 mt-3">Output:</div>
                          )}
                          <pre className="text-[#2D1B00] dark:text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed">
                            {displayOutput}
                          </pre>
                          {/* Show full content if available (for readFile) */}
                          {fullContent && (
                            <div className="mt-3">
                              <div className="text-xs font-bold text-[#5A8A5E] dark:text-blue-300 mb-1">Full Content:</div>
                              <pre className="text-[#2D1B00] dark:text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed bg-[#2D1B00]/10 dark:bg-black/20 p-2 rounded">
                                {fullContent}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  
  const chats = useQuery(api.chat.listChats) || [];
  const apiKeyStatus = useQuery(api.users.getApiKey);
  const remainingMessages = useQuery(api.users.getRemainingMessages);
  const syncUser = useMutation(api.users.syncUser);
  const billingStatus = useQuery(api.users.getBillingStatus);
  const updateApiKey = useAction(api.users.updateApiKey); // Action, not mutation
  const deleteApiKey = useMutation(api.users.deleteApiKey);
  const deleteChat = useMutation(api.chat.deleteChat);
  
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
  
  // Check if it's AI's turn (from database - persists across refreshes/chat switches)
  const isAiTurn = selectedChat?.isAiTurn || false;
  
  // Check if current chat is processing - rely on database state (isAiTurn)
  // plus client state (isSending) only for the brief moment before DB updates
  const isCurrentChatProcessing = isAiTurn || isSending;
  
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
  const hasRestoredChat = useRef(false);
  
  // Show toast notification
  const showToast = (message: string, type: "error" | "success" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000); // Auto-hide after 5 seconds
  };
  
  // Sync user on mount (create user record if doesn't exist)
  useEffect(() => {
    if (isSignedIn) {
      console.log("Syncing user...");
      syncUser()
        .then((userId) => console.log("User synced:", userId))
        .catch((err) => console.error("Failed to sync user:", err));
    }
  }, [syncUser, isSignedIn]);

  // Restore selected chat from localStorage on mount
  useEffect(() => {
    if (chats.length > 0 && !selectedChatId && !hasRestoredChat.current) {
      hasRestoredChat.current = true;
      const savedChatId = localStorage.getItem("selectedChatId");
      if (savedChatId) {
        // Check if the saved chat still exists
        const chatExists = chats.some(chat => chat._id === savedChatId);
        if (chatExists) {
          setSelectedChatId(savedChatId as Id<"chats">);
          return;
        }
      }
      // Fall back to first chat if no saved selection or saved chat doesn't exist
      if (firstChatId) {
        setSelectedChatId(firstChatId);
      }
    }
  }, [chats, firstChatId, selectedChatId]);

  // If selected chat is deleted, fall back to first available chat
  useEffect(() => {
    if (selectedChatId && chats.length > 0) {
      const chatExists = chats.some(chat => chat._id === selectedChatId);
      if (!chatExists && firstChatId) {
        setSelectedChatId(firstChatId);
      }
    }
  }, [selectedChatId, chats, firstChatId]);

  // Save selected chat to localStorage whenever it changes
  useEffect(() => {
    if (selectedChatId) {
      localStorage.setItem("selectedChatId", selectedChatId);
    }
  }, [selectedChatId]);

  // When switching chats, reset isSending (unless still streaming on current chat)
  useEffect(() => {
    if (!isStreaming) {
      setIsSending(false);
    }
  }, [selectedChatId, isStreaming]);

  // Reset isSending when streaming starts
  useEffect(() => {
    if (isStreaming && isSending) {
      setIsSending(false);
    }
  }, [isStreaming, isSending]);

  // Safety timeout: reset isSending if streaming doesn't start within 10 seconds
  useEffect(() => {
    if (isSending) {
      const timeout = setTimeout(() => {
        setIsSending(false);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isSending]);

  // Notify once per session when we first fall back from Pro key to BYOK.
  const [shownByokFallbackNotice, setShownByokFallbackNotice] = useState(false);
  useEffect(() => {
    if (
      !shownByokFallbackNotice &&
      billingStatus?.pro?.byokFallbackNotifiedThisPeriod
    ) {
      showToast(
        "Your Pro allowance is exhausted, so Kayra is now using your own OpenAI API key (BYOK) for this period.",
        "info",
      );
      setShownByokFallbackNotice(true);
    }
  }, [billingStatus?.pro?.byokFallbackNotifiedThisPeriod, shownByokFallbackNotice]);

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#E8DCC8] dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🌳</div>
          <p className="text-[#5B4332] dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page if not signed in
  if (!isSignedIn) {
    return <LandingPage />;
  }

  /**
   * Creates a new chat with Freestyle repo and automatically selects it.
   * Shows loading state during creation.
   */
  const handleCreateChat = async () => {
    // Check if free user has reached daily limit
    if (remainingMessages?.isFreeUser && remainingMessages.remainingMessages === 0) {
      showToast(`You've used all ${remainingMessages.totalDailyLimit} free messages today! Add your own OpenAI API key to continue.`, "error");
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
      showToast("API key validated and saved successfully!", "success");
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
      showToast(errorMessage, "error");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    setConfirmDialog({
      message: "Delete your API key? You'll need to add it again to create games.",
      onConfirm: async () => {
    setSavingKey(true);
    try {
      await deleteApiKey();
      setShowApiKeyModal(false);
          showToast("API key deleted successfully!", "success");
    } catch (error) {
      console.error("Failed to delete API key:", error);
          showToast("Failed to delete API key", "error");
    } finally {
      setSavingKey(false);
    }
      }
    });
  };

  const handleDeleteChat = async (chatId: Id<"chats">) => {
    setConfirmDialog({
      message: "Delete this game project? This cannot be undone.",
      onConfirm: async () => {
    try {
      await deleteChat({ chatId });
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
      }
          showToast("Game project deleted", "success");
    } catch (error) {
      console.error("Failed to delete chat:", error);
          showToast("Failed to delete chat", "error");
        }
    }
    });
  };

  /**
   * Handles message submission: validates input, clears the input field,
   * and sends the message to the selected chat.
   * If no chat exists, automatically creates one first.
   */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // CRITICAL: Block if streaming (from DB) or currently sending
    if (!input.trim() || isCurrentChatProcessing) {
      return;
    }
    
    // Check if free user has reached daily limit
    if (remainingMessages?.isFreeUser && remainingMessages.remainingMessages === 0) {
      showToast(`You've used all ${remainingMessages.totalDailyLimit} free messages today! Add your own OpenAI API key to continue.`, "error");
      setShowApiKeyModal(true);
      return;
    }
    
    // Capture message text before clearing
    const messageText = input;
    setIsSending(true);
    
    try {
      // If no chat is selected, create one first
      let chatId = selectedChatId;
      if (!chatId) {
        try {
          chatId = await createChat();
          setSelectedChatId(chatId);
          // Wait a moment for the repo to start being created
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error("Failed to create chat:", error);
          showToast("Failed to create a new game project. Please try again.", "error");
          setIsSending(false);
          return;
        }
      }
      
      // Check if repo is ready
      if (selectedChat?.repoId === "pending") {
        showToast("Repository is still being created. Please wait a moment...", "info");
        setIsSending(false);
        return;
      }
      
      setInput("");
      
      await sendMessage({ chatId, text: messageText });
      
      // Keep isSending true - will be reset when streaming starts or by timeout
    } catch (error) {
      console.error("Failed to send message:", error);
      
      // Restore the message so user can retry
      setInput(messageText);
      
      // Check if it's a daily limit error
      if (error instanceof Error && error.message.includes("Daily message limit exceeded")) {
        showToast(error.message, "error");
        setShowApiKeyModal(true);
      } else if (error instanceof Error && error.message.includes("Pro token allowance exceeded")) {
        // Pro token cap reached - show a clear toast instead of a raw error
        showToast(error.message, "error");
      } else if (error instanceof Error && error.message.includes("Pro key is not configured")) {
        showToast(
          "Pro is enabled but the Pro API key is not configured. Please contact the owner or use your own key in Settings.",
          "error",
        );
      } else if (error instanceof Error && error.message.includes("No API key configured")) {
        // Misconfiguration / missing system key
        showToast(
          "No AI API key is configured for this app. Please contact the owner or add your own key in Settings.",
          "error",
        );
      } else if (error instanceof Error && error.message.includes("Repository is still being created")) {
        showToast("Repository is still being created. Please wait a moment and try again.", "info");
      } else {
        showToast("Failed to send message. Please try again.", "error");
      }
      
      setIsSending(false);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-[#E8DCC8] dark:bg-gray-900 text-[#4A3425] dark:text-white">
      {/* Top Bar with Brand, Chat Selector, Preview Title, and User */}
      <div className="min-h-16 px-3 md:px-4 py-2 md:py-0 border-b border-[#B5A58D] dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
        {/* Left: Brand + Chat Controls */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <div className="flex flex-col leading-tight flex-shrink-0">
            <div className="flex items-center gap-1 md:gap-2">
              <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#2D1B00] via-[#5B4332] to-[#5A8A5E] dark:from-blue-400 dark:via-purple-400 dark:to-purple-500 bg-clip-text text-transparent">
                Kayra
              </div>
              <div className="text-xl md:text-2xl opacity-90 dark:opacity-70">🌳</div>
            </div>
            <div className="text-[10px] md:text-xs text-[#5B4332] dark:text-gray-400 font-medium hidden sm:block">the Game Creator</div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
            <select
              value={selectedChatId || ""}
              onChange={(e) => setSelectedChatId(e.target.value as Id<"chats">)}
              className="bg-[#F5EFE3] dark:bg-gray-800 border border-[#B5A58D] dark:border-gray-600 rounded px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-[#2D1B00] dark:text-white focus:outline-none focus:border-[#5A8A5E] dark:focus:border-blue-500 flex-1 min-w-0 font-medium truncate"
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
                className="bg-[#A85842] dark:bg-red-700 hover:bg-[#8B4332] dark:hover:bg-red-900 px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm text-white flex-shrink-0"
                title="Delete chat"
              >
                🗑️
              </button>
            )}
            <button
              onClick={handleCreateChat}
              disabled={isCreatingChat}
              className="bg-[#5A8A5E] dark:bg-green-600 hover:bg-[#4A7C4E] dark:hover:bg-green-700 disabled:bg-[#C4B599] dark:disabled:bg-gray-700 disabled:cursor-not-allowed px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm font-bold whitespace-nowrap text-white flex-shrink-0"
            >
              {isCreatingChat ? "..." : "+ New"}
            </button>
          </div>
        </div>
        
        {/* Right: User Menu (Preview Title hidden on mobile) */}
        <div className="flex items-center gap-2 md:gap-4 justify-between md:justify-end">
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-lg font-bold text-[#2D1B00] dark:text-white">Live Preview</span>
            <span className="text-xl">🎮</span>
          </div>
          
          <div className="hidden lg:block h-8 w-px bg-[#C4B599] dark:bg-gray-700"></div>
          
          <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
            {/* Free user message counter */}
            {remainingMessages?.isFreeUser && remainingMessages.remainingMessages !== null && (
              <div className={`text-[10px] md:text-xs px-2 md:px-3 py-1 rounded font-bold ${
                remainingMessages.remainingMessages === 0
                  ? "bg-[#A85842] dark:bg-red-700 text-white"
                  : remainingMessages.remainingMessages <= 2
                  ? "bg-[#D4A574] dark:bg-yellow-600 text-white"
                  : "bg-[#D4C5A9] dark:bg-gray-700 text-[#3D2817] dark:text-gray-300"
              }`}>
                {remainingMessages.remainingMessages}/{remainingMessages.totalDailyLimit} free
              </div>
            )}
            {/* Tier indicator (details & actions live in Settings) */}
            {billingStatus && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-[10px] md:text-xs px-2 md:px-3 py-1 rounded font-bold bg-[#D4C5A9] dark:bg-gray-700 text-[#3D2817] dark:text-gray-300">
                  {billingStatus.tier === "pro"
                    ? "Pro"
                    : billingStatus.tier === "byok"
                    ? "BYOK"
                    : billingStatus.tier === "admin"
                    ? "Admin"
                    : "Free"}
                  {billingStatus.pro?.isActive &&
                    typeof billingStatus.pro.remainingTokens === "number" && (
                      <span className="ml-1 md:ml-2 font-normal hidden md:inline">
                        · {Math.floor(billingStatus.pro.remainingTokens / 1_000_000)}M left
                      </span>
                    )}
                </div>
              </div>
            )}
            <button
              onClick={() => router.push("/settings")}
              className="text-[10px] md:text-xs px-2 md:px-3 py-1 rounded font-bold bg-[#D4C5A9] dark:bg-gray-700 hover:bg-[#C4B599] dark:hover:bg-gray-600 text-[#3D2817] dark:text-gray-300"
            >
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">⚙️</span>
            </button>
            <UserButton />
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5EFE3] dark:bg-gray-800 rounded-lg p-4 md:p-6 max-w-md w-full">
            <h2 className="text-lg md:text-xl font-bold mb-2 text-[#2D1B00] dark:text-white">
              {apiKeyStatus?.hasKey ? "Update" : "Add"} OpenAI API Key
            </h2>
            <p className="text-xs md:text-sm text-[#4A3425] dark:text-gray-400 mb-4">
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
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Chat Panel - full width on mobile, 50% on desktop */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-[#B5A58D] dark:border-gray-700 overflow-hidden">

        {/* Messages */}
        <div className="flex-1 p-3 md:p-6 overflow-y-auto space-y-3 md:space-y-4 min-h-0">
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
              <div className="text-center text-[#5B4332] dark:text-gray-500 mt-4 md:mt-8 text-xs md:text-sm">
                <div className="text-2xl md:text-3xl mb-2 md:mb-3">👋</div>
                <div className="text-base md:text-lg font-bold text-[#2D1B00] dark:text-white mb-1 md:mb-2">Hi! I&apos;m Kayra</div>
                <div className="mb-2 md:mb-4 text-[#4A3425] dark:text-gray-300 text-xs md:text-sm">Tell me what kind of 3D game you want to create!</div>
                <div className="mt-2 md:mt-4 text-[10px] md:text-xs text-[#6B5844] dark:text-gray-600">
                  Try: &quot;Make a flappy bird game&quot; or &quot;Create a racing game&quot;
                </div>
              </div>
            )
          ) : (
            <div className="text-center text-[#5B4332] dark:text-gray-500 mt-8 text-sm">
              {chats.length === 0 
                ? "Start typing below to create your first 3D game!"
                : "Select a project to continue"}
            </div>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="p-3 md:p-6 border-t border-[#B5A58D] dark:border-gray-700">
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedChat?.repoId === "pending" 
                  ? "Setting up..." 
                  : (isCurrentChatProcessing || isSending)
                  ? "Working..." 
                  : "Describe your game..."
              }
              disabled={selectedChat?.repoId === "pending" || isCurrentChatProcessing || isSending}
              className="flex-1 bg-[#F5EFE3] dark:bg-gray-800 border border-[#B5A58D] dark:border-gray-600 text-[#2D1B00] dark:text-white rounded p-2 text-xs md:text-sm focus:outline-none focus:border-[#5A8A5E] dark:focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder-[#8B7A65] dark:placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={selectedChat?.repoId === "pending" || isCurrentChatProcessing || isSending}
              className="bg-[#5A8A5E] dark:bg-blue-500 hover:bg-[#4A7C4E] dark:hover:bg-blue-600 disabled:bg-[#C4B599] dark:disabled:bg-gray-700 disabled:cursor-not-allowed px-3 md:px-4 py-2 rounded font-bold text-xs md:text-sm text-white min-w-[60px] md:min-w-[70px]"
            >
              {(isCurrentChatProcessing || isSending) ? (
                <span className="dot-pulse">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Preview Panel - full width on mobile, 50% on desktop */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col overflow-hidden">
        <div className="flex-1 bg-[#D4C5A9] dark:bg-gray-950 p-3 md:p-6 flex items-center justify-center">
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
                  : "Start typing to create your first game"}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:right-6 md:left-auto z-50 animate-fade-in">
          <div className={`rounded-lg shadow-lg p-3 md:p-4 max-w-md mx-auto md:mx-0 border-2 ${
            toast.type === "error" 
              ? "bg-[#A85842] dark:bg-red-700 border-[#8B4332] dark:border-red-900 text-white"
              : toast.type === "success"
              ? "bg-[#5A8A5E] dark:bg-green-700 border-[#4A7C4E] dark:border-green-900 text-white"
              : "bg-[#D4C5A9] dark:bg-gray-700 border-[#B5A58D] dark:border-gray-600 text-[#2D1B00] dark:text-white"
          }`}>
            <div className="flex items-start gap-2 md:gap-3">
              <div className="text-xl md:text-2xl flex-shrink-0">
                {toast.type === "error" ? "❌" : toast.type === "success" ? "✅" : "ℹ️"}
              </div>
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium">{toast.message}</p>
              </div>
              <button 
                onClick={() => setToast(null)}
                className="flex-shrink-0 hover:opacity-70 transition-opacity"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5EFE3] dark:bg-gray-800 rounded-lg p-4 md:p-6 max-w-md w-full shadow-2xl animate-fade-in">
            <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 text-[#2D1B00] dark:text-white">
              Confirm Action
            </h3>
            <p className="text-sm md:text-base text-[#4A3425] dark:text-gray-300 mb-4 md:mb-6">
              {confirmDialog.message}
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="bg-[#D4C5A9] dark:bg-gray-700 hover:bg-[#C4B599] dark:hover:bg-gray-600 px-4 py-2 rounded text-[#2D1B00] dark:text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="bg-[#A85842] dark:bg-red-700 hover:bg-[#8B4332] dark:hover:bg-red-900 px-4 py-2 rounded text-white font-bold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}