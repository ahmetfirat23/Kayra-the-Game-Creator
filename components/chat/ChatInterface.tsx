"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CONFIG } from "../../convex/config";
import { sandboxActionForPageEvent } from "../../lib/sandbox-page";
import {
  nextPreviewEpoch,
  sandboxToStopOnSwitch,
  shouldEnsureSandboxOnReload,
} from "../../lib/sandbox-lifecycle";
import { ThemeToggle } from "../ui/ThemeToggle";
import { MessageComponent } from "./MessageComponent";
import { ApiKeyModal, Toast, ConfirmDialog } from "../ui/Modals";

interface ChatInterfaceProps {
  theme: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
  mounted: boolean;
}

export function ChatInterface({ theme, toggleTheme, mounted }: ChatInterfaceProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const [isDownloading, setIsDownloading] = useState(false);
  
  const chats = useQuery(api.chat.listChats) || [];
  const apiKeyStatus = useQuery(api.users.getApiKeyStatus);
  const remainingMessages = useQuery(api.users.getRemainingMessages);
  const syncUser = useMutation(api.users.syncUser);
  const billingStatus = useQuery(api.users.getBillingStatus);
  const updateApiKey = useAction(api.users.updateApiKey);
  const deleteApiKey = useMutation(api.users.deleteApiKey);
  const deleteChat = useMutation(api.chat.deleteChat);
  
  const selectedChat = useQuery(
    api.chat.getChat,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  );

  const preview = useQuery(
    api.chat.getPreview,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  );

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

  const messages = messagesData?.page || [];
  const isStreaming = messages.some((msg) => msg.status === "streaming");
  const isAiTurn = selectedChat?.isAiTurn || false;
  const isCurrentChatProcessing = isAiTurn || isSending;
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const wasAiTurn = useRef(false);

  useEffect(() => {
    setPreviewEpoch((epoch) => nextPreviewEpoch(wasAiTurn.current, isAiTurn, epoch));
    wasAiTurn.current = isAiTurn;
  }, [isAiTurn]);
  
  type MessagePart = { type?: string; [key: string]: unknown };
  const hasCommitted = messages.some((msg) => 
    (msg.parts as MessagePart[] | undefined)?.some((part) => {
      if (!part.type?.startsWith('tool-')) return false;
      const toolName = part.type.replace('tool-', '');
      return toolName.includes('commitAndPush');
    })
  );
  
  const sendMessage = useMutation(api.chat.sendMessage);
  const createChat = useMutation(api.chat.createChat);

  const firstChatId = chats.length > 0 ? chats[0]._id : null;
  const hasRestoredChat = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shownByokFallbackNotice, setShownByokFallbackNotice] = useState(false);

  const postSandbox = useCallback(
    async (chatId: Id<"chats">, action: "ensure" | "delete" | "download" | "heartbeat") => {
      const response = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Sandbox request failed",
        );
      }
      return payload;
    },
    [],
  );

  const sendSandboxDeleteBeacon = useCallback((chatId: Id<"chats">, event: "pagehide" | "beforeunload" | "sign-out") => {
    const action = sandboxActionForPageEvent(event);
    if (!action) return;
    const body = JSON.stringify({ chatId, action });
    void fetch("/api/sandbox", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    });
  }, []);
  
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selectedChatId]);
  
  const showToast = (message: string, type: "error" | "success" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };
  
  useEffect(() => {
    syncUser();
  }, [syncUser]);

  useEffect(() => {
    if (!selectedChatId) return;

    const onPageHide = () => sendSandboxDeleteBeacon(selectedChatId, "pagehide");
    const onBeforeUnload = () => sendSandboxDeleteBeacon(selectedChatId, "beforeunload");

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [selectedChatId, sendSandboxDeleteBeacon]);

  const previousChatId = useRef<Id<"chats"> | null>(null);
  useEffect(() => {
    const previous = previousChatId.current;
    previousChatId.current = selectedChatId;
    const stopId = sandboxToStopOnSwitch(previous, selectedChatId);
    if (!stopId) return;
    void postSandbox(stopId as Id<"chats">, "delete").catch(() => {
      // The machine may already be stopped.
    });
  }, [selectedChatId, postSandbox]);

  const reloadGame = async () => {
    if (!selectedChatId || isPreparing) return;
    // Destroying the VM mid-reply kills the tool bridge and leaves isAiTurn stuck.
    if (!shouldEnsureSandboxOnReload(isAiTurn)) {
      showToast("Kayra is still working — wait for this reply to finish.", "info");
      return;
    }
    setIsPreparing(true);
    try {
      await postSandbox(selectedChatId, "ensure");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not reload the game.",
        "error",
      );
    } finally {
      // Always unlock the composer after ensure settles; only a live AI turn keeps it busy.
      setIsPreparing(false);
    }
  };

  useEffect(() => {
    if (!selectedChatId) return;

    const beat = () => {
      void postSandbox(selectedChatId, "heartbeat").catch(() => {
        // Heartbeat failures are non-fatal; the next ensure/heartbeat recovers.
      });
    };

    beat();
    const interval = window.setInterval(beat, 20_000);
    return () => window.clearInterval(interval);
  }, [selectedChatId, postSandbox]);

  useEffect(() => {
    if (chats.length > 0 && !selectedChatId && !hasRestoredChat.current) {
      hasRestoredChat.current = true;
      const savedChatId = localStorage.getItem("selectedChatId");
      if (savedChatId) {
        const chatExists = chats.some(chat => chat._id === savedChatId);
        if (chatExists) {
          setSelectedChatId(savedChatId as Id<"chats">);
          return;
        }
      }
      if (firstChatId) {
        setSelectedChatId(firstChatId);
      }
    }
  }, [chats, firstChatId, selectedChatId]);

  useEffect(() => {
    if (selectedChatId && chats.length > 0) {
      const chatExists = chats.some(chat => chat._id === selectedChatId);
      if (!chatExists && firstChatId) {
        setSelectedChatId(firstChatId);
      }
    }
  }, [selectedChatId, chats, firstChatId]);

  // Clear selectedChatId if the chat was deleted (selectedChat becomes null)
  useEffect(() => {
    if (selectedChatId && selectedChat === null && chats.length > 0) {
      const firstChat = chats[0];
      setSelectedChatId(firstChat._id);
    } else if (selectedChatId && selectedChat === null && chats.length === 0) {
      setSelectedChatId(null);
    }
  }, [selectedChatId, selectedChat, chats]);

  useEffect(() => {
    if (selectedChatId) {
      localStorage.setItem("selectedChatId", selectedChatId);
    }
  }, [selectedChatId]);

  useEffect(() => {
    if (!isStreaming) {
      setIsSending(false);
    }
  }, [selectedChatId, isStreaming]);

  useEffect(() => {
    if (isStreaming && isSending) {
      setIsSending(false);
    }
  }, [isStreaming, isSending]);

  useEffect(() => {
    if (isSending) {
      const timeout = setTimeout(() => {
        setIsSending(false);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isSending]);

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

  const handleCreateChat = async () => {
    if (remainingMessages?.isFreeUser && remainingMessages.remainingMessages === 0) {
      showToast(`You've used all ${CONFIG.FREE_TIER_DAILY_LIMIT} free messages today! Add your own OpenAI API key to continue.`, "error");
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
          await postSandbox(chatId, "delete");
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

  const handleDownloadProject = async () => {
    if (!selectedChatId) {
      showToast("Project is not ready yet", "error");
      return;
    }

    setIsDownloading(true);
    try {
      const result = await postSandbox(selectedChatId, "download");
      
      if (result.success && result.data) {
        const cleanBase64 = String(result.data).replace(/[\s\r\n]+/g, '');
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/gzip' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'game-project.tar.gz';
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isCurrentChatProcessing || isPreparing) {
      return;
    }
    
    if (remainingMessages?.isFreeUser && remainingMessages.remainingMessages === 0) {
      showToast(`You've used all ${CONFIG.FREE_TIER_DAILY_LIMIT} free messages today! Add your own OpenAI API key to continue.`, "error");
      setShowApiKeyModal(true);
      return;
    }
    
    const messageText = input;
    setIsSending(true);
    
    try {
      let chatId = selectedChatId;
      if (!chatId) {
        try {
          chatId = await createChat();
          setSelectedChatId(chatId);
        } catch (error) {
          console.error("Failed to create chat:", error);
          showToast("Failed to create a new game project. Please try again.", "error");
          setIsSending(false);
          return;
        }
      }

      setIsPreparing(true);
      try {
        await postSandbox(chatId, "ensure");
      } catch (error) {
        console.error("Failed to prepare sandbox:", error);
        showToast(
          error instanceof Error ? error.message : "Failed to start the game environment.",
          "error",
        );
        setIsPreparing(false);
        setIsSending(false);
        return;
      } finally {
        setIsPreparing(false);
      }
      
      setInput("");
      
      await sendMessage({ chatId, text: messageText });
    } catch (error) {
      console.error("Failed to send message:", error);
      setInput(messageText);
      
      if (error instanceof Error && error.message.includes("Daily message limit exceeded")) {
        showToast(error.message, "error");
        setShowApiKeyModal(true);
      } else if (error instanceof Error && error.message.includes("Pro token allowance exceeded")) {
        showToast(error.message, "error");
      } else if (error instanceof Error && error.message.includes("Pro key is not configured")) {
        showToast(
          "Pro is enabled but the Pro API key is not configured. Please contact the owner or use your own key in Settings.",
          "error",
        );
      } else if (error instanceof Error && error.message.includes("No API key configured")) {
        showToast(
          "No AI API key is configured for this app. Please contact the owner or add your own key in Settings.",
          "error",
        );
      } else {
        showToast("Failed to send message. Please try again.", "error");
      }
      
      setIsSending(false);
    }
  };

  return (
    <main className="flex flex-col h-[100dvh] md:h-screen bg-gradient-to-br from-[#FAFBFC] via-white to-[#F8F9FA] dark:from-[#1A202C] dark:via-[#1A202C] dark:to-[#2D3748] text-[#4A5568] dark:text-[#E2E8F0]">
      {/* Top Bar */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 md:py-2 border-b border-[#E8F4FC] dark:border-[#4A5568] bg-white/80 dark:bg-[#2D3748]/80 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 shadow-sm">
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
              x Delete
            </button>
          )}
          {selectedChat?.repoId && selectedChat.repoId !== "pending" && hasCommitted && (
            <button
              onClick={handleDownloadProject}
              disabled={isDownloading}
              className="bg-[#A8D4E6] hover:bg-[#98C4D6] dark:bg-[#7EB5D6] dark:hover:bg-[#8EC5E6] disabled:bg-[#E2E8F0] dark:disabled:bg-[#4A5568] disabled:cursor-not-allowed px-3 py-2 rounded-xl text-xs text-white flex-shrink-0 transition-all hover:shadow-md"
              title="Download project as zip"
            >
              {isDownloading ? "..." : "⬇ Save"}
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
        <div className="hidden md:flex items-center gap-5 min-w-0">
          <div className="flex flex-col leading-tight flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold bg-gradient-to-r from-[#8B7EC8] via-[#7EB8D8] to-[#7EC8A8] bg-clip-text text-transparent">
                Kayra
              </div>
              <div className="text-2xl">🌳</div>
            </div>
            <div className="text-xs text-[#A0AEC0] dark:text-[#718096] font-medium">the Game Creator</div>
          </div>
          
          <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xl">
            <select
              value={selectedChatId || ""}
              onChange={(e) => setSelectedChatId(e.target.value as Id<"chats">)}
              className="bg-[#F8F9FA] dark:bg-[#1A202C] border border-[#E8F4FC] dark:border-[#4A5568] rounded-xl px-4 py-2 pr-[2em] text-sm text-[#4A5568] dark:text-[#E2E8F0] focus:outline-none focus:border-[#A8D4E6] dark:focus:border-[#6BA8C8] focus:ring-2 focus:ring-[#A8D4E6]/20 dark:focus:ring-[#6BA8C8]/20 flex-1 min-w-0 font-medium truncate transition-all"
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
                x Delete
              </button>
            )}
            {selectedChat?.repoId && selectedChat.repoId !== "pending" && hasCommitted && (
              <button
                onClick={handleDownloadProject}
                disabled={isDownloading}
                className="bg-[#A8D4E6] hover:bg-[#98C4D6] dark:bg-[#7EB5D6] dark:hover:bg-[#8EC5E6] disabled:bg-[#E2E8F0] dark:disabled:bg-[#4A5568] disabled:cursor-not-allowed px-3 py-2 rounded-xl text-sm text-white flex-shrink-0 transition-all hover:shadow-md"
                title="Download project as zip"
              >
                {isDownloading ? "..." : "⬇ Save"}
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
            {remainingMessages?.isFreeUser && remainingMessages.remainingMessages !== null && (
              <div className={`text-[10px] md:text-xs px-3 py-1.5 rounded-full font-bold transition-all ${
                remainingMessages.remainingMessages === 0
                  ? "bg-[#F0B8C4] dark:bg-[#C86B7A] text-white"
                  : remainingMessages.remainingMessages <= 2
                  ? "bg-[#F8D4B8] dark:bg-[#B8944A] text-[#8B6914] dark:text-white"
                  : "bg-[#E8F8F0] dark:bg-[#2D4A3A] text-[#7EC8A8] dark:text-[#88C8A8]"
              }`}>
                {remainingMessages.remainingMessages}/{CONFIG.FREE_TIER_DAILY_LIMIT} free
              </div>
            )}
            {billingStatus && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-[10px] md:text-xs px-3 py-2 rounded-full font-bold bg-[#F0E6FA] dark:bg-[#3D3058] text-[#8B7EC8] dark:text-[#D4B8E8]">
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
              className="text-xs px-3 py-2 rounded-full font-bold bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] text-[#718096] dark:text-[#A0AEC0] transition-all"
            >
              Settings
            </button>
            <UserButton />
          </div>
        </div>
      </div>

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
        {/* Chat Panel */}
        <div className={`w-full md:w-1/2 md:flex-none flex flex-col md:border-r border-[#E8F4FC] dark:border-[#4A5568] bg-gradient-to-b from-[#F0E6FA]/30 dark:from-[#3D3058]/30 via-white dark:via-[#1A202C] to-white dark:to-[#1A202C] overflow-hidden ${
          mobileView === "chat" ? "flex flex-1" : "hidden md:flex md:h-full"
        }`}>
          {/* Messages */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden space-y-4 min-h-0">
            {selectedChatId ? (
              messages && messages.length > 0 ? (
                messages.map((msg, idx) => {
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
                    Try: &quot;Make an endless runner game&quot; or &quot;Create a racing game&quot;
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
            <div ref={messagesEndRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSend} className="flex-shrink-0 p-4 md:p-4 border-t border-[#E8F4FC] dark:border-[#4A5568] bg-white dark:bg-[#2D3748] shadow-[0_-2px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_8px_rgba(0,0,0,0.3)]">
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
                  isPreparing
                    ? "Starting your game..."
                    : (isCurrentChatProcessing || isSending)
                    ? "Working..." 
                    : "Describe your game..."
                }
                disabled={isPreparing || isCurrentChatProcessing || isSending}
                rows={1}
                className="flex-1 bg-[#F8F9FA] dark:bg-[#1A202C] border border-[#E8F4FC] dark:border-[#4A5568] text-[#4A5568] dark:text-[#E2E8F0] rounded-2xl p-3 text-sm focus:outline-none focus:border-[#A8D4E6] dark:focus:border-[#6BA8C8] focus:ring-2 focus:ring-[#A8D4E6]/20 dark:focus:ring-[#6BA8C8]/20 disabled:opacity-50 disabled:cursor-not-allowed placeholder-[#A0AEC0] dark:placeholder-[#718096] resize-none overflow-y-auto overflow-x-hidden transition-all"
              />
              <button
                type="submit"
                disabled={isPreparing || isCurrentChatProcessing || isSending}
                className="bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6] disabled:from-[#E2E8F0] disabled:to-[#E2E8F0] dark:disabled:from-[#4A5568] dark:disabled:to-[#4A5568] disabled:cursor-not-allowed px-5 py-3 rounded-2xl font-bold text-sm text-white min-w-[70px] transition-all hover:shadow-md"
              >
                {(isPreparing || isCurrentChatProcessing || isSending) ? (
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

        {/* Preview Panel */}
        <div className={`w-full md:w-1/2 md:flex-none flex flex-col overflow-hidden ${
          mobileView === "preview" ? "flex flex-1" : "hidden md:flex md:h-full"
        }`}>
          <div className="relative flex-1 bg-gradient-to-br from-[#F0E6FA] via-[#FAFBFC] to-[#E8F4FC] dark:from-[#1A202C] dark:via-[#2D3748] dark:to-[#1A202C] p-4 md:p-6 flex items-center justify-center">
            {preview?.previewUrl ? (
              <div className="w-full h-full rounded-3xl overflow-hidden border-2 border-[#E8F4FC] dark:border-[#4A5568] shadow-[0_8px_32px_rgba(168,212,230,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <iframe
                  key={`${preview.previewUrl}-${previewEpoch}`}
                  src={preview.previewUrl}
                  title="Game preview"
                  className="w-full h-full border-0 bg-[#F0E6FA] dark:bg-[#1A202C]"
                />
              </div>
            ) : isPreparing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-3.5">
                <div className="text-6xl leading-none">🌳</div>
                <div className="text-4xl font-bold tracking-tight leading-none text-[#7EB8D8] dark:text-[#A8D4E6]">Kayra</div>
                <p className="m-0 max-w-[220px] text-[15px] leading-snug font-medium text-[#718096] dark:text-[#A0AEC0]">Starting your game</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-5xl mb-3">🌳</div>
                <div className="text-base font-medium text-[#4A5568] dark:text-[#E2E8F0]">
                  {selectedChatId && messages.length > 0
                    ? "This preview is stopped."
                    : selectedChatId
                    ? "Describe your game idea to get started"
                    : "Start typing to create your first game"}
                </div>
                {selectedChatId && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void reloadGame()}
                    className="mt-4 bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] px-5 py-3 rounded-2xl font-bold text-sm text-white"
                  >
                    Reload the game
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals and Toasts */}
      {showApiKeyModal && (
        <ApiKeyModal
          hasKey={apiKeyStatus?.hasKey || false}
          apiKey={apiKey}
          showKey={showKey}
          savingKey={savingKey}
          onApiKeyChange={setApiKey}
          onShowKeyToggle={() => setShowKey(!showKey)}
          onSave={handleSaveApiKey}
          onDelete={handleDeleteApiKey}
          onClose={() => {
            setShowApiKeyModal(false);
            setApiKey("");
          }}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </main>
  );
}
