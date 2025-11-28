"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { FreestyleDevServer } from "freestyle-sandboxes/react/dev-server";
import { requestDevServer, downloadRepoAsZip } from "../lib/freestyle-actions";
import ReactMarkdown from "react-markdown";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

// Theme toggle hook
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if dark class is already on document (set by layout script)
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return { theme, toggleTheme, mounted };
}

// Theme toggle button component
function ThemeToggle({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative text-[10px] md:text-xs w-8 h-8 md:w-9 md:h-9 rounded-full font-bold bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] text-[#718096] dark:text-[#A0AEC0] transition-all flex items-center justify-center overflow-hidden"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className={`absolute transition-all duration-300 ${theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}>
        🌙
      </span>
      <span className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`}>
        ☀️
      </span>
    </button>
  );
}

function LandingPage() {
  const { theme, toggleTheme, mounted } = useTheme();
  
  return (
    <main className="min-h-screen md:h-screen flex flex-col bg-gradient-to-br from-[#F0E6FA] via-[#FAFBFC] to-[#E8F4FC] dark:from-[#1A202C] dark:via-[#2D3748] dark:to-[#1A202C] overflow-y-auto md:overflow-hidden relative transition-colors duration-300">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        {mounted && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
      </div>
      
      {/* Decorative blobs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-[#D4B8E8] dark:bg-[#6B4A8C] rounded-full blur-3xl opacity-30 dark:opacity-20 pointer-events-none" />
      <div className="absolute bottom-40 right-20 w-80 h-80 bg-[#A8D4E6] dark:bg-[#4A6B8C] rounded-full blur-3xl opacity-30 dark:opacity-20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-[#B8E8C8] dark:bg-[#4A8C6B] rounded-full blur-3xl opacity-20 dark:opacity-15 pointer-events-none" />
      
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 relative z-10 min-h-0">
        <div className="max-w-5xl mx-auto text-center w-full">
          {/* Logo and Title */}
          <div className="mb-5 animate-fade-in">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="text-5xl animate-float">🌳</div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-1 leading-tight bg-gradient-to-r from-[#8B7EC8] via-[#7EB8D8] to-[#7EC8A8] bg-clip-text text-transparent">
              Kayra
            </h1>
            <p className="text-lg text-[#718096] dark:text-[#A0AEC0] font-medium mb-2">
              the Game Creator
            </p>
            <p className="text-sm text-[#A0AEC0] dark:text-[#718096] max-w-xl mx-auto leading-relaxed">
              Transform your game ideas into reality with AI-powered 3D game creation
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-5">
            <div className="bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_4px_24px_rgba(168,212,230,0.2)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-[#E8F4FC] dark:border-[#4A5568] hover:shadow-[0_8px_32px_rgba(168,212,230,0.3)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] flex items-center justify-center text-xl mb-3 mx-auto shadow-md">
                🎮
              </div>
              <h3 className="text-base font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-1">
                Create 3D Games
              </h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] leading-relaxed">
                Tell Kayra your game idea and watch it come to life
              </p>
            </div>

            <div className="bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_4px_24px_rgba(212,184,232,0.2)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-[#F0E6FA] dark:border-[#4A5568] hover:shadow-[0_8px_32px_rgba(212,184,232,0.3)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D4B8E8] to-[#C4A8D8] dark:from-[#A888C8] dark:to-[#9878B8] flex items-center justify-center text-xl mb-3 mx-auto shadow-md">
                ⚡
              </div>
              <h3 className="text-base font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-1">
                Instant Preview
              </h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] leading-relaxed">
                See your game running live as Kayra builds it
              </p>
            </div>

            <div className="bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm rounded-2xl p-4 shadow-[0_4px_24px_rgba(184,232,200,0.2)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] border border-[#E8F8F0] dark:border-[#4A5568] hover:shadow-[0_8px_32px_rgba(184,232,200,0.3)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#B8E8C8] to-[#98D8B8] dark:from-[#88C8A8] dark:to-[#78B898] flex items-center justify-center text-xl mb-3 mx-auto shadow-md">
                🤖
              </div>
              <h3 className="text-base font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-1">
                AI-Powered
              </h3>
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0] leading-relaxed">
                Advanced AI understands your vision and creates code
              </p>
            </div>
          </div>

          {/* Pricing Info */}
          <div className="bg-gradient-to-r from-[#E8F8F0] via-white to-[#E8F4FC] dark:from-[#1a3a2a] dark:via-[#2D3748] dark:to-[#1a2a3a] backdrop-blur-sm rounded-2xl p-5 mb-5 border-2 border-[#B8E8C8] dark:border-[#88C8A8] shadow-[0_8px_32px_rgba(184,232,200,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B8E8C8] to-[#98D8B8] dark:from-[#88C8A8] dark:to-[#78B898] flex items-center justify-center text-xl shadow-md">
                🎁
              </div>
              <h3 className="text-xl font-bold text-[#4A5568] dark:text-[#E2E8F0]">
                Start Creating for Free
              </h3>
            </div>
            <p className="text-base text-[#718096] dark:text-[#A0AEC0]">
              Get <span className="font-bold text-[#7EC8A8] dark:text-[#88C8A8]">5 free messages per day</span> to bring your game ideas to life
            </p>
            <p className="text-xs text-[#A0AEC0] mt-1">
              No credit card required • Start building immediately
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <SignInButton mode="modal">
              <button className="bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6] dark:hover:from-[#5B98B8] dark:hover:to-[#4B88A8] text-white font-bold text-base px-8 py-3 rounded-full shadow-[0_4px_16px_rgba(168,212,230,0.4)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] transform transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_24px_rgba(168,212,230,0.5)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                Get Started Free ✨
              </button>
            </SignInButton>
            <p className="text-sm text-[#A0AEC0] dark:text-[#718096]">
              Already have an account? 
              <SignInButton mode="modal">
                <button className="ml-2 text-[#7EB8D8] dark:text-[#6BA8C8] font-bold hover:text-[#6EA8C8] dark:hover:text-[#8BC8E8] transition-colors">
                  Sign in
                </button>
              </SignInButton>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3 border-t border-[#E8F4FC] dark:border-[#2D3748] flex-shrink-0 relative z-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs text-[#A0AEC0] dark:text-[#718096]">
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
 * @param showTokens - Whether to show token count on this message (should only be true for last assistant msg in a sequence)
 */
function MessageComponent({ message, showTokens = true }: { message: UIMessage; showTokens?: boolean }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  // Get token usage from message metadata (backend aggregates all step tokens onto last assistant message)
  const usage = (message.metadata as { usage?: { totalTokens?: number } } | undefined)?.usage;
  // Only show tokens when message is complete (not streaming) and showTokens is true
  const totalTokens = !isUser && !isStreaming && showTokens ? usage?.totalTokens : undefined;

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
      className={`p-3 md:p-4 rounded-2xl max-w-[95%] md:max-w-[90%] overflow-hidden shadow-sm transition-all duration-200 ${
        isUser
        ? "bg-gradient-to-br from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] self-end ml-auto"
        : "bg-white dark:bg-[#2D3748] border border-[#E8F4FC] dark:border-[#4A5568]"
      }`}
    >
      <div className={`text-[10px] md:text-xs mb-2 uppercase font-bold flex items-center gap-1 md:gap-2 ${
        isUser ? "text-white/90" : "text-[#7EB8D8] dark:text-[#6BA8C8]"
      }`}>
        <span>{isUser ? "You" : "Kayra 🌳"}</span>
        {isStreaming && (
          <span className="text-xs animate-pulse-soft">●</span>
        )}
        {!isUser && typeof totalTokens === "number" && totalTokens > 0 && (
          <span className="ml-auto text-[10px] font-normal opacity-60 lowercase">
            {totalTokens} tokens
          </span>
        )}
      </div>
      
      {/* Display text content with markdown formatting */}
      {visibleText && (
        <div className="mb-2 prose prose-sm max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className={`mb-2 leading-relaxed ${isUser ? 'text-white' : 'text-[#4A5568] dark:text-[#E2E8F0]'}`}>{children}</p>,
              strong: ({ children }) => <strong className={`font-bold ${isUser ? 'text-white' : 'text-[#2D3748] dark:text-white'}`}>{children}</strong>,
              em: ({ children }) => <em className={`italic ${isUser ? 'text-white/90' : 'text-[#4A5568] dark:text-[#A0AEC0]'}`}>{children}</em>,
              h1: ({ children }) => <h1 className={`text-xl font-bold mb-2 mt-3 ${isUser ? 'text-white' : 'text-[#2D3748] dark:text-white'}`}>{children}</h1>,
              h2: ({ children }) => <h2 className={`text-lg font-bold mb-2 mt-3 ${isUser ? 'text-white' : 'text-[#2D3748] dark:text-white'}`}>{children}</h2>,
              h3: ({ children }) => <h3 className={`text-base font-bold mb-2 mt-2 ${isUser ? 'text-white' : 'text-[#2D3748] dark:text-white'}`}>{children}</h3>,
              ul: ({ children }) => <ul className={`list-disc list-inside mb-2 space-y-1 ${isUser ? 'text-white' : 'text-[#4A5568] dark:text-[#E2E8F0]'}`}>{children}</ul>,
              ol: ({ children }) => <ol className={`list-decimal list-inside mb-2 space-y-1 ${isUser ? 'text-white' : 'text-[#4A5568] dark:text-[#E2E8F0]'}`}>{children}</ol>,
              li: ({ children }) => <li className="ml-2">{children}</li>,
              code: ({ children }) => <code className={`px-1.5 py-0.5 rounded-lg text-sm ${isUser ? 'bg-white/20 text-white' : 'bg-[#F0E6FA] dark:bg-[#4A5568] text-[#8B7EC8] dark:text-[#D4B8E8]'}`}>{children}</code>,
              pre: ({ children }) => <pre className={`p-3 rounded-xl overflow-x-auto mb-2 ${isUser ? 'bg-white/20 text-white' : 'bg-[#F8F9FA] dark:bg-[#1A202C] text-[#4A5568] dark:text-[#E2E8F0]'}`}>{children}</pre>,
              blockquote: ({ children }) => <blockquote className={`border-l-4 pl-3 italic my-2 ${isUser ? 'border-white/50 text-white/90' : 'border-[#D4B8E8] dark:border-[#A888C8] text-[#718096] dark:text-[#A0AEC0]'}`}>{children}</blockquote>,
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

            // For writeFile, the full content is in args.content
            // For readFile, the full content is in output (with metadata marker)
            const isWriteFile = toolName.toLowerCase().includes('writefile');
            const isReadFile = toolName.toLowerCase().includes('readfile');
            
            // Extract args - could be in different places depending on tool type
            const toolAny = tool as Record<string, unknown>;
            const args = (toolAny.args || toolAny.input || toolAny.arguments || {}) as { path?: string; content?: string; [key: string]: unknown };
            
            return (
              <div key={idx} className="bg-[#F8F9FA] dark:bg-[#1A202C] rounded-xl text-xs border border-[#E8F4FC] dark:border-[#4A5568] overflow-hidden">
                <button
                  onClick={() => toggleTool(idx)}
                  className="w-full p-3 text-left hover:bg-[#F0E6FA]/50 dark:hover:bg-[#4A5568]/50 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="text-[#8B7EC8] dark:text-[#D4B8E8] font-mono font-bold flex items-center gap-2 min-w-0">
                    {isFileOperation ? '📝' : '🔧'} {toolName}
                    {/* Show path for file operations - hidden on mobile */}
                    {args.path && (
                      <span className="hidden md:inline font-normal text-[#718096] dark:text-[#A0AEC0] truncate max-w-[200px]">
                        {args.path}
                      </span>
                    )}
                  </div>
                  <div className={`text-[#D4B8E8] dark:text-[#A888C8] transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                    ▶
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-[#E8F4FC] dark:border-[#4A5568] bg-[#FAFBFC] dark:bg-[#2D3748] p-3 space-y-3">
                    {/* For writeFile, show path, line count, and full content */}
                    {isWriteFile && args.content && (
                      <div>
                        <div className="text-xs text-[#7EC8A8] dark:text-[#88C8A8] mb-2">
                          ✅ Written to {args.path || 'file'}
                          <br />
                          📊 {args.content.split('\n').length} lines
                        </div>
                        <div className="text-xs font-bold text-[#8B7EC8] dark:text-[#D4B8E8] mb-1">Full Code:</div>
                        <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed bg-white dark:bg-[#1A202C] p-3 rounded-xl border border-[#E8F4FC] dark:border-[#4A5568]">
                          {args.content}
                        </pre>
                      </div>
                    )}
                    {/* Show tool output */}
                    {tool.output && (() => {
                      const outputStr = typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2);
                      
                      // For readFile, extract and display the full content
                      if (isReadFile) {
                        // Check for metadata marker
                        const fullContentMatch = outputStr.match(/<!--FULL_CONTENT_METADATA:(.+?)-->/);
                        let fullContent: string | null = null;
                        let filePath: string | null = args.path || null;
                        
                        if (fullContentMatch) {
                          try {
                            const parsed = JSON.parse(fullContentMatch[1]);
                            fullContent = parsed._fullContent || null;
                            filePath = parsed._path || filePath;
                          } catch {
                            // Parsing failed, content before marker is the full content
                            fullContent = outputStr.split('<!--FULL_CONTENT_METADATA:')[0].trim();
                          }
                        } else {
                          // No marker, the output itself might be the full content
                          // Only if it doesn't look like a summary (doesn't start with ✅)
                          if (!outputStr.startsWith('✅')) {
                            fullContent = outputStr;
                          }
                        }
                        
                        if (fullContent) {
                          const lineCount = fullContent.split('\n').length;
                          return (
                            <div>
                              <div className="text-xs text-[#7EC8A8] dark:text-[#88C8A8] mb-2">
                                ✅ Read from {filePath || 'file'}
                                <br />
                                📊 {lineCount} lines
                              </div>
                              <div className="text-xs font-bold text-[#8B7EC8] dark:text-[#D4B8E8] mb-1">File Content:</div>
                              <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed bg-white dark:bg-[#1A202C] p-3 rounded-xl border border-[#E8F4FC] dark:border-[#4A5568]">
                                {fullContent}
                              </pre>
                            </div>
                          );
                        }
                      }
                      
                      // For writeFile, content is already shown above, skip output display
                      if (isWriteFile) {
                        return null;
                      }
                      
                      // For other tools, show full output
                      return (
                        <div>
                          <div className="text-xs font-bold text-[#8B7EC8] dark:text-[#D4B8E8] mb-1">Output:</div>
                          <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed">
                            {outputStr}
                          </pre>
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
  const { theme, toggleTheme, mounted } = useTheme();
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
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const [isDownloading, setIsDownloading] = useState(false);
  
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
          paginationOpts: { numItems: 200, cursor: null },
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
  
  // Count total commits to use as a key for refreshing the preview
  // When this changes, the FreestyleDevServer component will remount and refresh
  const commitCount = messages.reduce((count, msg) => {
    const parts = msg.parts as MessagePart[] | undefined;
    if (!parts) return count;
    const commits = parts.filter((part) => {
      if (!part.type?.startsWith('tool-')) return false;
      const toolName = part.type.replace('tool-', '');
      return toolName.includes('commitAndPush');
    });
    return count + commits.length;
  }, 0);
  
  const sendMessage = useMutation(api.chat.sendMessage);
  const createChat = useMutation(api.chat.createChat);

  // Auto-select the first chat when chats are loaded and none is selected
  const firstChatId = chats.length > 0 ? chats[0]._id : null;
  const hasRestoredChat = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change or chat is selected
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selectedChatId]);
  
  // Show toast notification
  const showToast = (message: string, type: "error" | "success" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000); // Auto-hide after 5 seconds
  };
  
  // Sync user on mount (create user record if doesn't exist)
  useEffect(() => {
    if (isSignedIn) {
      syncUser();
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
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#F0E6FA] via-[#FAFBFC] to-[#E8F4FC]">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-float">🌳</div>
          <p className="text-[#718096]">Loading...</p>
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
   * Downloads the current game project as a zip file.
   */
  const handleDownloadProject = async () => {
    if (!selectedChat?.repoId || selectedChat.repoId === "pending") {
      showToast("Project is not ready yet", "error");
      return;
    }

    setIsDownloading(true);
    try {
      const result = await downloadRepoAsZip({ repoId: selectedChat.repoId });
      
      if (result.success && result.data) {
        // Convert base64 to blob and trigger download
        // Clean the base64 string (remove any whitespace)
        const cleanBase64 = result.data.replace(/[\s\r\n]+/g, '');
        
        // Decode base64 to binary
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/gzip' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'game-project.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast("Project downloaded successfully!", "success");
      } else {
        showToast(result.error || "Failed to download project", "error");
      }
    } catch (error) {
      console.error("Failed to download project:", error);
      showToast("Failed to download project", "error");
    } finally {
      setIsDownloading(false);
    }
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
    <main className="flex flex-col h-[100dvh] md:h-screen bg-gradient-to-br from-[#FAFBFC] via-white to-[#F8F9FA] dark:from-[#1A202C] dark:via-[#1A202C] dark:to-[#2D3748] text-[#4A5568] dark:text-[#E2E8F0]">
      {/* Top Bar with Brand, Chat Selector, Preview Title, and User */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 md:py-0 border-b border-[#E8F4FC] dark:border-[#4A5568] bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
        {/* Mobile: Row 1 - Logo + Theme/Settings/Account */}
        <div className="flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <div className="text-xl font-bold bg-gradient-to-r from-[#8B7EC8] via-[#7EB8D8] to-[#7EC8A8] bg-clip-text text-transparent">
              Kayra
            </div>
            <div className="text-xl">🌳</div>
          </div>
          <div className="flex items-center gap-2">
            {mounted && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
            <button
              onClick={() => router.push("/settings")}
              className="w-8 h-8 rounded-full font-bold bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] text-[#718096] dark:text-[#A0AEC0] transition-all flex items-center justify-center"
            >
              ⚙️
            </button>
            <UserButton />
          </div>
        </div>
        
        {/* Mobile: Row 2 - Chat selector + action buttons */}
        <div className="flex items-center gap-2 md:hidden">
          <select
            value={selectedChatId || ""}
            onChange={(e) => setSelectedChatId(e.target.value as Id<"chats">)}
            className="bg-[#F8F9FA] dark:bg-[#1A202C] border border-[#E8F4FC] dark:border-[#4A5568] rounded-xl px-3 py-2 text-xs text-[#4A5568] dark:text-[#E2E8F0] focus:outline-none focus:border-[#A8D4E6] dark:focus:border-[#6BA8C8] focus:ring-2 focus:ring-[#A8D4E6]/20 dark:focus:ring-[#6BA8C8]/20 flex-1 min-w-0 font-medium truncate transition-all"
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
              className="bg-[#F0B8C4] hover:bg-[#E8A8B4] dark:bg-[#9A8ABC] dark:hover:bg-[#AA9ACC] px-3 py-2 rounded-xl text-xs text-white flex-shrink-0 transition-all hover:shadow-md"
              title="Delete chat"
            >
              🗑️
            </button>
          )}
          {selectedChat?.repoId && selectedChat.repoId !== "pending" && hasCommitted && (
            <button
              onClick={handleDownloadProject}
              disabled={isDownloading}
              className="bg-[#A8D4E6] hover:bg-[#98C4D6] dark:bg-[#7EB5D6] dark:hover:bg-[#8EC5E6] disabled:bg-[#E2E8F0] dark:disabled:bg-[#4A5568] disabled:cursor-not-allowed px-3 py-2 rounded-xl text-xs text-white flex-shrink-0 transition-all hover:shadow-md"
              title="Download project as zip"
            >
              {isDownloading ? "..." : "⬇️"}
            </button>
          )}
          <button
            onClick={handleCreateChat}
            disabled={isCreatingChat}
            className="bg-gradient-to-r from-[#B8E8C8] to-[#98D8B8] dark:from-[#6BB8C8] dark:to-[#5BA8B8] hover:from-[#A8D8B8] hover:to-[#88C8A8] dark:hover:from-[#7BC8D8] dark:hover:to-[#6BB8C8] disabled:from-[#E2E8F0] disabled:to-[#E2E8F0] dark:disabled:from-[#4A5568] dark:disabled:to-[#4A5568] disabled:cursor-not-allowed px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap text-white flex-shrink-0 transition-all hover:shadow-md"
          >
            {isCreatingChat ? "..." : "+ New"}
          </button>
        </div>

        {/* Desktop: Left - Brand + Chat Controls */}
        <div className="hidden md:flex items-center gap-5 flex-1 min-w-0">
          <div className="flex flex-col leading-tight flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold bg-gradient-to-r from-[#8B7EC8] via-[#7EB8D8] to-[#7EC8A8] bg-clip-text text-transparent">
                Kayra
              </div>
              <div className="text-2xl">🌳</div>
            </div>
            <div className="text-xs text-[#A0AEC0] dark:text-[#718096] font-medium">the Game Creator</div>
          </div>
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              value={selectedChatId || ""}
              onChange={(e) => setSelectedChatId(e.target.value as Id<"chats">)}
              className="bg-[#F8F9FA] dark:bg-[#1A202C] border border-[#E8F4FC] dark:border-[#4A5568] rounded-xl px-4 py-2 text-sm text-[#4A5568] dark:text-[#E2E8F0] focus:outline-none focus:border-[#A8D4E6] dark:focus:border-[#6BA8C8] focus:ring-2 focus:ring-[#A8D4E6]/20 dark:focus:ring-[#6BA8C8]/20 flex-1 min-w-0 font-medium truncate transition-all"
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
                className="bg-[#F0B8C4] hover:bg-[#E8A8B4] dark:bg-[#9A8ABC] dark:hover:bg-[#AA9ACC] px-3 py-2 rounded-xl text-sm text-white flex-shrink-0 transition-all hover:shadow-md"
                title="Delete chat"
              >
                🗑️
              </button>
            )}
            {selectedChat?.repoId && selectedChat.repoId !== "pending" && hasCommitted && (
              <button
                onClick={handleDownloadProject}
                disabled={isDownloading}
                className="bg-[#A8D4E6] hover:bg-[#98C4D6] dark:bg-[#7EB5D6] dark:hover:bg-[#8EC5E6] disabled:bg-[#E2E8F0] dark:disabled:bg-[#4A5568] disabled:cursor-not-allowed px-3 py-2 rounded-xl text-sm text-white flex-shrink-0 transition-all hover:shadow-md"
                title="Download project as zip"
              >
                {isDownloading ? "..." : "⬇️"}
              </button>
            )}
            <button
              onClick={handleCreateChat}
              disabled={isCreatingChat}
              className="bg-gradient-to-r from-[#B8E8C8] to-[#98D8B8] dark:from-[#6BB8C8] dark:to-[#5BA8B8] hover:from-[#A8D8B8] hover:to-[#88C8A8] dark:hover:from-[#7BC8D8] dark:hover:to-[#6BB8C8] disabled:from-[#E2E8F0] disabled:to-[#E2E8F0] dark:disabled:from-[#4A5568] dark:disabled:to-[#4A5568] disabled:cursor-not-allowed px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap text-white flex-shrink-0 transition-all hover:shadow-md"
            >
              {isCreatingChat ? "..." : "+ New"}
            </button>
          </div>
        </div>
        
        {/* Desktop: Right - User Menu */}
        <div className="hidden md:flex items-center gap-4 justify-end">
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-lg font-bold text-[#4A5568] dark:text-[#E2E8F0]">Live Preview</span>
            <span className="text-xl">🎮</span>
          </div>
          
          <div className="hidden lg:block h-8 w-px bg-[#E8F4FC] dark:bg-[#4A5568]"></div>
          
          <div className="flex items-center gap-3">
            {/* Free user message counter */}
            {remainingMessages?.isFreeUser && remainingMessages.remainingMessages !== null && (
              <div className={`text-[10px] md:text-xs px-3 py-1.5 rounded-full font-bold transition-all ${
                remainingMessages.remainingMessages === 0
                  ? "bg-[#F0B8C4] dark:bg-[#C86B7A] text-white"
                  : remainingMessages.remainingMessages <= 2
                  ? "bg-[#F8D4B8] dark:bg-[#B8944A] text-[#8B6914] dark:text-white"
                  : "bg-[#E8F8F0] dark:bg-[#2D4A3A] text-[#7EC8A8] dark:text-[#88C8A8]"
              }`}>
                {remainingMessages.remainingMessages}/{remainingMessages.totalDailyLimit} free
              </div>
            )}
            {/* Tier indicator (details & actions live in Settings) */}
            {billingStatus && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-[10px] md:text-xs px-3 py-1.5 rounded-full font-bold bg-[#F0E6FA] dark:bg-[#3D3058] text-[#8B7EC8] dark:text-[#D4B8E8]">
                  {billingStatus.tier === "pro"
                    ? "Pro ✨"
                    : billingStatus.tier === "byok"
                    ? "BYOK"
                    : billingStatus.tier === "admin"
                    ? "Admin"
                    : "Free"}
                  {billingStatus.pro?.isActive &&
                    typeof billingStatus.pro.remainingTokens === "number" && (
                      <span className="ml-2 font-normal hidden md:inline">
                        · {Math.floor(billingStatus.pro.remainingTokens / 1_000_000)}M left
                      </span>
                    )}
                </div>
              </div>
            )}
            {mounted && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
            <button
              onClick={() => router.push("/settings")}
              className="text-xs px-3 py-1.5 rounded-full font-bold bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] text-[#718096] dark:text-[#A0AEC0] transition-all"
            >
              Settings
            </button>
            <UserButton />
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-[#4A5568]/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2D3748] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_16px_64px_rgba(168,162,158,0.2)] dark:shadow-[0_16px_64px_rgba(0,0,0,0.4)] animate-fade-in-scale">
            <h2 className="text-xl md:text-2xl font-bold mb-3 text-[#4A5568] dark:text-[#E2E8F0]">
              {apiKeyStatus?.hasKey ? "Update" : "Add"} OpenAI API Key
            </h2>
            <p className="text-sm text-[#718096] dark:text-[#A0AEC0] mb-5">
              Your API key is used to power Kayra&apos;s AI. Get one at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                className="text-[#7EB8D8] dark:text-[#6BA8C8] font-bold hover:text-[#6EA8C8] dark:hover:text-[#5B98B8] transition-colors"
              >
                openai.com
              </a>
            </p>
            
            <div className="bg-gradient-to-r from-[#E8F8F0] to-[#E8F4FC] dark:from-[#2D4A3A] dark:to-[#2A3A4A] border border-[#B8E8C8] dark:border-[#4A5568] rounded-2xl p-4 mb-5">
              <p className="text-xs text-[#718096] dark:text-[#A0AEC0]">
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
                  className="flex-1 bg-[#F8F9FA] dark:bg-[#1A202C] border border-[#E8F4FC] dark:border-[#4A5568] rounded-xl px-4 py-3 text-[#4A5568] dark:text-[#E2E8F0] focus:outline-none focus:border-[#A8D4E6] dark:focus:border-[#6BA8C8] focus:ring-2 focus:ring-[#A8D4E6]/20 dark:focus:ring-[#6BA8C8]/20 transition-all"
                  autoFocus
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="px-4 py-3 bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] rounded-xl text-[#718096] dark:text-[#A0AEC0] transition-all"
                >
                  {showKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowApiKeyModal(false);
                    setApiKey("");
                  }}
                  className="flex-1 bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] px-4 py-3 rounded-xl text-[#718096] dark:text-[#A0AEC0] font-medium transition-all"
                >
                  Cancel
                </button>
                {apiKeyStatus?.hasKey && (
                  <button
                    onClick={handleDeleteApiKey}
                    disabled={savingKey}
                    className="flex-1 bg-[#F0B8C4] hover:bg-[#E8A8B4] dark:bg-[#C86B7A] dark:hover:bg-[#B85A6A] disabled:bg-[#E2E8F0] dark:disabled:bg-[#4A5568] disabled:cursor-not-allowed px-4 py-3 rounded-xl text-white font-medium transition-all"
                  >
                    Delete Key
                  </button>
                )}
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKey.trim() || savingKey}
                  className="flex-1 bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6] disabled:from-[#E2E8F0] disabled:to-[#E2E8F0] dark:disabled:from-[#4A5568] dark:disabled:to-[#4A5568] disabled:cursor-not-allowed px-4 py-3 rounded-xl font-bold text-white transition-all"
                >
                  {savingKey ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex flex-shrink-0 border-b border-[#E8F4FC] dark:border-[#4A5568] bg-white dark:bg-[#2D3748]">
        <button
          onClick={() => setMobileView("chat")}
          className={`flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            mobileView === "chat"
              ? "bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] text-white"
              : "bg-[#F8F9FA] dark:bg-[#1A202C] text-[#718096] dark:text-[#A0AEC0]"
          }`}
        >
          <span>💬</span> Chat
        </button>
        <button
          onClick={() => setMobileView("preview")}
          className={`flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            mobileView === "preview"
              ? "bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] text-white"
              : "bg-[#F8F9FA] dark:bg-[#1A202C] text-[#718096] dark:text-[#A0AEC0]"
          }`}
        >
          <span>🎮</span> Preview
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Chat Panel - fullscreen on mobile when selected, 50% on desktop */}
        <div className={`w-full md:w-1/2 md:flex-none flex flex-col md:border-r border-[#E8F4FC] dark:border-[#4A5568] bg-gradient-to-b from-[#F0E6FA]/30 dark:from-[#3D3058]/30 via-white dark:via-[#1A202C] to-white dark:to-[#1A202C] overflow-hidden ${
          mobileView === "chat" ? "flex flex-1" : "hidden md:flex md:h-full"
        }`}>

        {/* Messages */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden space-y-4 min-h-0">
          {selectedChat?.repoId === "pending" ? (
            <div className="text-center text-[#7EB8D8] dark:text-[#6BA8C8] mt-8 text-sm animate-pulse-soft">
              <div className="text-3xl mb-3">⚙️</div>
              <div className="font-medium text-[#4A5568] dark:text-[#E2E8F0]">Setting up your 3D game project...</div>
              <div className="mt-2 text-xs text-[#A0AEC0]">
                Creating Git repository and dev server
              </div>
            </div>
          ) : selectedChat && selectedChat.repoId && selectedChat.repoId !== "pending" ? (
            messages && messages.length > 0 ? (
              messages.map((msg, idx) => {
                // Show tokens only on the last assistant message before a user message (or end)
                // The backend already aggregates all step tokens onto the last assistant message
                const nextMsg = messages[idx + 1];
                const isLastAssistantInSequence = msg.role === "assistant" && (!nextMsg || nextMsg.role === "user");
                
                return (
                  <MessageComponent 
                    key={msg.id} 
                    message={msg} 
                    showTokens={msg.role === "user" || isLastAssistantInSequence}
                  />
                );
              })
            ) : (
              <div className="text-center text-[#718096] dark:text-[#A0AEC0] mt-6 md:mt-10 animate-fade-in">
                <div className="text-4xl md:text-5xl mb-4 animate-float">👋</div>
                <div className="text-xl md:text-2xl font-bold text-[#4A5568] dark:text-[#E2E8F0] mb-2">Hi! I&apos;m Kayra</div>
                <div className="mb-4 text-[#718096] dark:text-[#A0AEC0] text-sm md:text-base">Tell me what kind of 3D game you want to create!</div>
                <div className="mt-6 text-xs text-[#A0AEC0] dark:text-[#718096] bg-[#F8F9FA] dark:bg-[#2D3748] inline-block px-4 py-2 rounded-full">
                  Try: &quot;Make a flappy bird game&quot; or &quot;Create a racing game&quot;
                </div>
              </div>
            )
          ) : (
            <div className="text-center text-[#718096] dark:text-[#A0AEC0] mt-8 text-sm">
              {chats.length === 0 
                ? "Start typing below to create your first 3D game!"
                : "Select a project to continue"}
            </div>
          )}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="flex-shrink-0 p-4 md:p-6 border-t border-[#E8F4FC] dark:border-[#4A5568] bg-white dark:bg-[#2D3748]">
          <div className="flex gap-3 items-end">
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={
                selectedChat?.repoId === "pending" 
                  ? "Setting up..." 
                  : (isCurrentChatProcessing || isSending)
                  ? "Working..." 
                  : "Describe your game..."
              }
              disabled={selectedChat?.repoId === "pending" || isCurrentChatProcessing || isSending}
              rows={1}
              className="flex-1 bg-[#F8F9FA] dark:bg-[#1A202C] border border-[#E8F4FC] dark:border-[#4A5568] text-[#4A5568] dark:text-[#E2E8F0] rounded-2xl p-3 text-sm focus:outline-none focus:border-[#A8D4E6] dark:focus:border-[#6BA8C8] focus:ring-2 focus:ring-[#A8D4E6]/20 dark:focus:ring-[#6BA8C8]/20 disabled:opacity-50 disabled:cursor-not-allowed placeholder-[#A0AEC0] dark:placeholder-[#718096] resize-none overflow-y-auto overflow-x-hidden transition-all"
            />
            <button
              type="submit"
              disabled={selectedChat?.repoId === "pending" || isCurrentChatProcessing || isSending}
              className="bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6] disabled:from-[#E2E8F0] disabled:to-[#E2E8F0] dark:disabled:from-[#4A5568] dark:disabled:to-[#4A5568] disabled:cursor-not-allowed px-5 py-3 rounded-2xl font-bold text-sm text-white min-w-[70px] transition-all hover:shadow-md"
            >
              {(isCurrentChatProcessing || isSending) ? (
                <span className="dot-pulse">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Preview Panel - fullscreen on mobile when selected, 50% on desktop */}
      <div className={`w-full md:w-1/2 md:flex-none flex flex-col overflow-hidden ${
        mobileView === "preview" ? "flex flex-1" : "hidden md:flex md:h-full"
      }`}>
        <div className="flex-1 bg-gradient-to-br from-[#F8F9FA] to-[#E8F4FC] dark:from-[#1A202C] dark:to-[#2D3748] p-4 md:p-6 flex items-center justify-center">
          {selectedChat?.repoId === "pending" ? (
            <div className="text-[#7EB8D8] dark:text-[#6BA8C8] text-center animate-pulse-soft">
              <div className="text-5xl mb-4">⚙️</div>
              <div className="text-base text-[#4A5568] dark:text-[#E2E8F0] font-medium">Setting up dev environment...</div>
              <div className="text-sm text-[#A0AEC0] dark:text-[#718096] mt-2">This may take 30-60 seconds</div>
            </div>
          ) : selectedChat?.repoId && hasCommitted ? (
            <div className="w-full h-full rounded-3xl overflow-hidden border-2 border-[#E8F4FC] dark:border-[#4A5568] shadow-[0_8px_32px_rgba(168,212,230,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <FreestyleDevServer 
                key={`${selectedChat.repoId}-${commitCount}`}
                actions={{ requestDevServer }} 
                repoId={selectedChat.repoId} 
              />
            </div>
          ) : (
            <div className="text-[#A0AEC0] dark:text-[#718096] text-center">
              <div className="text-5xl mb-4">🎮</div>
              <div className="text-base">
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
          <div className={`rounded-2xl shadow-lg p-4 max-w-md mx-auto md:mx-0 backdrop-blur-sm ${
            toast.type === "error" 
              ? "bg-[#F0B8C4] dark:bg-[#C86B7A] text-white"
              : toast.type === "success"
              ? "bg-[#B8E8C8] dark:bg-[#2D4A3A] text-[#3D5A3F] dark:text-[#88C8A8]"
              : "bg-white dark:bg-[#2D3748] border border-[#E8F4FC] dark:border-[#4A5568] text-[#4A5568] dark:text-[#E2E8F0]"
          }`}>
            <div className="flex items-start gap-3">
              <div className="text-xl flex-shrink-0">
                {toast.type === "error" ? "❌" : toast.type === "success" ? "✅" : "ℹ️"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{toast.message}</p>
              </div>
              <button 
                onClick={() => setToast(null)}
                className="flex-shrink-0 hover:opacity-70 transition-opacity text-lg"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-[#4A5568]/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2D3748] rounded-3xl p-6 max-w-md w-full shadow-[0_16px_64px_rgba(168,162,158,0.2)] dark:shadow-[0_16px_64px_rgba(0,0,0,0.4)] animate-fade-in-scale">
            <h3 className="text-lg font-bold mb-4 text-[#4A5568] dark:text-[#E2E8F0]">
              Confirm Action
            </h3>
            <p className="text-sm text-[#718096] dark:text-[#A0AEC0] mb-6">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] px-5 py-2.5 rounded-xl text-[#718096] dark:text-[#A0AEC0] font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="bg-[#F0B8C4] hover:bg-[#E8A8B4] dark:bg-[#C86B7A] dark:hover:bg-[#B85A6A] px-5 py-2.5 rounded-xl text-white font-bold transition-all"
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