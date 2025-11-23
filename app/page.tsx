"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export default function Home() {
  const [input, setInput] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  
  const chats = useQuery(api.chat.listChats) || [];
  const messages = useQuery(
    api.chat.getMessages,
    selectedChatId ? { chatId: selectedChatId } : "skip"
  ) || [];
  
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
   * Creates a new chat and automatically selects it.
   * Shows loading state during creation.
   */
  const handleCreateChat = async () => {
    setIsCreatingChat(true);
    try {
      const newChatId = await createChat();
      setSelectedChatId(newChatId);
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
    const messageText = input;
    setInput("");
    await sendMessage({ chatId: selectedChatId, text: messageText });
  };

  return (
    <main className="flex h-screen bg-gray-900 text-white">
      <div className="w-full flex flex-col">
        {/* Chat dropdown header */}
        <div className="p-4 border-b border-gray-700 flex items-center gap-4">
          <select
            value={selectedChatId || ""}
            onChange={(e) => setSelectedChatId(e.target.value as Id<"chats">)}
            className="bg-gray-800 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500 flex-1"
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
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-bold whitespace-nowrap"
          >
            {isCreatingChat ? "Creating..." : "+ New Chat"}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {selectedChatId ? (
            messages.length > 0 ? (
              messages.map((msg) => (
                <div 
                  key={msg._id}
                  className={`p-3 rounded-lg max-w-[80%] ${
                    msg.sender === "user"
                    ? "bg-blue-600 self-end ml-auto"
                    : "bg-gray-700"
                  }`}
                >
                  <div className="text-xs text-gray-300 mb-1 uppercase font-bold">
                    {msg.sender}
                  </div>
                  {msg.text}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 mt-8">
                No messages yet. Start the conversation!
              </div>
            )
          ) : (
            <div className="text-center text-gray-500 mt-8">
              {chats.length === 0 
                ? "Create your first chat to get started!"
                : "Select a chat to view messages"}
            </div>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={!selectedChatId}
              className="flex-1 bg-gray-800 border-gray-600 rounded p-2 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            <button
              type="submit"
              disabled={!selectedChatId}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-bold"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}