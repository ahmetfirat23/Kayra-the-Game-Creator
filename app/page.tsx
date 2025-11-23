"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { FreestyleDevServer } from "freestyle-sandboxes/react/dev-server";
import { requestDevServer } from "../lib/freestyle-actions";
import ReactMarkdown from "react-markdown";

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
        ? "bg-blue-600 self-end ml-auto"
        : "bg-gray-700"
      }`}
    >
      <div className="text-xs text-gray-300 mb-1 uppercase font-bold flex items-center gap-2">
        <span>{isUser ? "user" : "3d game builder"}</span>
        {isStreaming && (
          <span className="text-xs animate-pulse">●</span>
        )}
      </div>
      
      {/* Display text content with markdown formatting */}
      {visibleText && (
        <div className="mb-2 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="ml-2">{children}</li>,
              code: ({ children }) => <code className="bg-gray-800 px-1 py-0.5 rounded text-sm">{children}</code>,
              pre: ({ children }) => <pre className="bg-gray-800 p-2 rounded overflow-x-auto mb-2">{children}</pre>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-600 pl-3 italic my-2">{children}</blockquote>,
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
            <div key={idx} className="bg-gray-800 p-2 rounded text-xs">
              <div className="text-blue-300 font-mono mb-1">
                🔧 {tool.type ? tool.type.replace('tool-', '') : 'tool'}
              </div>
              {tool.output && (
                <div className="text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
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
  
  const chats = useQuery(api.chat.listChats) || [];
  
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
    setIsCreatingChat(true);
    try {
      const chatId = await createChat();
      setSelectedChatId(chatId);
    } finally {
      setIsCreatingChat(false);
    }
  };

  /**
   * Handles message submission: validates input, clears the input field,
   * and sends the message to the selected chat.
   */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedChatId) return;
    
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
    <main className="flex h-screen bg-gray-900 text-white">
      {/* Chat Panel - 40% */}
      <div className="w-2/5 flex flex-col border-r border-gray-700">
        {/* Chat dropdown header */}
        <div className="p-4 border-b border-gray-700 flex items-center gap-2">
          <select
            value={selectedChatId || ""}
            onChange={(e) => setSelectedChatId(e.target.value as Id<"chats">)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 flex-1"
          >
            {chats.map((chat) => (
              <option key={chat._id} value={chat._id}>
                {chat.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateChat}
            disabled={isCreatingChat}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-3 py-2 rounded text-sm font-bold whitespace-nowrap"
          >
            {isCreatingChat ? "..." : "+ New"}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {selectedChat?.repoId === "pending" ? (
            <div className="text-center text-blue-500 mt-8 text-sm animate-pulse">
              <div className="text-2xl mb-2">⚙️</div>
              Setting up your 3D game project...
              <div className="mt-2 text-xs text-gray-400">
                Creating Git repository and dev server
              </div>
            </div>
          ) : selectedChat && selectedChat.repoId && selectedChat.repoId !== "pending" ? (
            messages && messages.length > 0 ? (
              messages.map((msg) => (
                <MessageComponent key={msg.id} message={msg} />
              ))
            ) : (
              <div className="text-center text-gray-500 mt-8 text-sm">
                Ask me to build a 3D game! 🎮
                <div className="mt-2 text-xs">
                  Try: &quot;Create a spinning cube game&quot;
                </div>
              </div>
            )
          ) : (
            <div className="text-center text-gray-500 mt-8 text-sm">
              {chats.length === 0 
                ? "Create your first 3D game project!"
                : "Select a project to continue"}
            </div>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedChat?.repoId === "pending" ? "Setting up project..." : "Describe your 3D game..."}
              disabled={!selectedChatId || selectedChat?.repoId === "pending"}
              className="flex-1 bg-gray-800 border-gray-600 rounded p-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!selectedChatId || selectedChat?.repoId === "pending"}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-bold text-sm"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Preview Panel - 60% */}
      <div className="w-3/5 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold">Live Preview 🎮</h2>
          <p className="text-xs text-gray-400 mt-1">
            Your 3D game will appear here once the AI starts building
          </p>
        </div>
        <div className="flex-1 bg-gray-950 flex items-center justify-center">
          {selectedChat?.repoId === "pending" ? (
            <div className="text-blue-500 text-center animate-pulse">
              <div className="text-4xl mb-4">⚙️</div>
              <div className="text-sm">Setting up dev environment...</div>
              <div className="text-xs text-gray-500 mt-2">This may take 30-60 seconds</div>
            </div>
          ) : selectedChat?.repoId ? (
            <FreestyleDevServer 
              actions={{ requestDevServer }} 
              repoId={selectedChat.repoId} 
            />
          ) : (
            <div className="text-gray-600 text-center">
              <div className="text-4xl mb-4">🎮</div>
              <div className="text-sm">Create a chat to start building games</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}