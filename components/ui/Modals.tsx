interface ToastProps {
  message: string;
  type: "error" | "success" | "info";
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:right-6 md:left-auto z-50 animate-fade-in">
      <div className={`rounded-2xl shadow-lg p-4 max-w-md mx-auto md:mx-0 backdrop-blur-sm ${
        type === "error" 
          ? "bg-[#F0B8C4] dark:bg-[#C86B7A] text-white"
          : type === "success"
          ? "bg-[#B8E8C8] dark:bg-[#2D4A3A] text-[#3D5A3F] dark:text-[#88C8A8]"
          : "bg-white dark:bg-[#2D3748] border border-[#E8F4FC] dark:border-[#4A5568] text-[#4A5568] dark:text-[#E2E8F0]"
      }`}>
        <div className="flex items-start gap-3">
          <div className="text-xl flex-shrink-0">
            {type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{message}</p>
          </div>
          <button 
            onClick={onClose}
            className="flex-shrink-0 hover:opacity-70 transition-opacity text-lg"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-[#4A5568]/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#2D3748] rounded-3xl p-6 max-w-md w-full shadow-[0_16px_64px_rgba(168,162,158,0.2)] dark:shadow-[0_16px_64px_rgba(0,0,0,0.4)] animate-fade-in-scale">
        <h3 className="text-lg font-bold mb-4 text-[#4A5568] dark:text-[#E2E8F0]">
          Confirm Action
        </h3>
        <p className="text-sm text-[#718096] dark:text-[#A0AEC0] mb-6">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] px-5 py-2.5 rounded-xl text-[#718096] dark:text-[#A0AEC0] font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-[#F0B8C4] hover:bg-[#E8A8B4] dark:bg-[#C86B7A] dark:hover:bg-[#B85A6A] px-5 py-2.5 rounded-xl text-white font-bold transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface ApiKeyModalProps {
  hasKey: boolean;
  apiKey: string;
  showKey: boolean;
  savingKey: boolean;
  onApiKeyChange: (key: string) => void;
  onShowKeyToggle: () => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ApiKeyModal({ 
  hasKey, 
  apiKey, 
  showKey, 
  savingKey, 
  onApiKeyChange, 
  onShowKeyToggle, 
  onSave, 
  onDelete, 
  onClose 
}: ApiKeyModalProps) {
  return (
    <div className="fixed inset-0 bg-[#4A5568]/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#2D3748] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_16px_64px_rgba(168,162,158,0.2)] dark:shadow-[0_16px_64px_rgba(0,0,0,0.4)] animate-fade-in-scale">
        <h2 className="text-xl md:text-2xl font-bold mb-3 text-[#4A5568] dark:text-[#E2E8F0]">
          {hasKey ? "Update" : "Add"} OpenAI API Key
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
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="flex-1 bg-[#F8F9FA] dark:bg-[#1A202C] border border-[#E8F4FC] dark:border-[#4A5568] rounded-xl px-4 py-3 text-[#4A5568] dark:text-[#E2E8F0] focus:outline-none focus:border-[#A8D4E6] dark:focus:border-[#6BA8C8] focus:ring-2 focus:ring-[#A8D4E6]/20 dark:focus:ring-[#6BA8C8]/20 transition-all"
              autoFocus
            />
            <button
              onClick={onShowKeyToggle}
              className="px-4 py-3 bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] rounded-xl text-[#718096] dark:text-[#A0AEC0] transition-all"
            >
              {showKey ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-[#F8F9FA] dark:bg-[#1A202C] hover:bg-[#E8F4FC] dark:hover:bg-[#4A5568] px-4 py-3 rounded-xl text-[#718096] dark:text-[#A0AEC0] font-medium transition-all"
            >
              Cancel
            </button>
            {hasKey && (
              <button
                onClick={onDelete}
                disabled={savingKey}
                className="flex-1 bg-[#F0B8C4] hover:bg-[#E8A8B4] dark:bg-[#C86B7A] dark:hover:bg-[#B85A6A] disabled:bg-[#E2E8F0] dark:disabled:bg-[#4A5568] disabled:cursor-not-allowed px-4 py-3 rounded-xl text-white font-medium transition-all"
              >
                Delete Key
              </button>
            )}
            <button
              onClick={onSave}
              disabled={!apiKey.trim() || savingKey}
              className="flex-1 bg-gradient-to-r from-[#A8D4E6] to-[#88C4D6] dark:from-[#6BA8C8] dark:to-[#5B98B8] hover:from-[#98C4D6] hover:to-[#78B4C6] disabled:from-[#E2E8F0] disabled:to-[#E2E8F0] dark:disabled:from-[#4A5568] dark:disabled:to-[#4A5568] disabled:cursor-not-allowed px-4 py-3 rounded-xl font-bold text-white transition-all"
            >
              {savingKey ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
