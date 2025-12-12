"use client";

import { useState } from "react";
import { type UIMessage } from "@convex-dev/agent/react";
import { useSmoothText } from "@convex-dev/agent/react";
import ReactMarkdown from "react-markdown";

/**
 * Message component that renders a single message with smooth text streaming.
 * Uses useSmoothText to animate text as it streams in for a better UX.
 * @param showTokens - Whether to show token count on this message (should only be true for last assistant msg in a sequence)
 */
export function MessageComponent({ message, showTokens = true }: { message: UIMessage; showTokens?: boolean }) {
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

            // For writeFiles, the full content is in args.files array
            // For readFiles, the output contains multiple files
            // For editFiles, the edits are in args.files array
            const isWriteFiles = toolName.toLowerCase().includes('writefile');
            const isReadFiles = toolName.toLowerCase().includes('readfile');
            const isEditFiles = toolName.toLowerCase().includes('editfile');
            
            // Extract args - could be in different places depending on tool type
            const toolAny = tool as Record<string, unknown>;
            const args = (toolAny.args || toolAny.input || toolAny.arguments || {}) as { 
              path?: string; 
              paths?: string[]; 
              content?: string; 
              files?: Array<{path: string; content?: string; edits?: Array<{oldText: string; newText: string}>}>; 
              edits?: Array<{oldText: string; newText: string}>;
              [key: string]: unknown 
            };
            
            return (
              <div key={idx} className="bg-[#F8F9FA] dark:bg-[#1A202C] rounded-xl text-xs border border-[#E8F4FC] dark:border-[#4A5568] overflow-hidden">
                <button
                  onClick={() => toggleTool(idx)}
                  className="w-full p-3 text-left hover:bg-[#F0E6FA]/50 dark:hover:bg-[#4A5568]/50 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="text-[#8B7EC8] dark:text-[#D4B8E8] font-mono font-bold flex items-center gap-2 min-w-0">
                    {isFileOperation ? '📝' : '🔧'} {toolName}
                    {/* Show path for single file operations - hidden on mobile */}
                    {args.path && (
                      <span className="hidden md:inline font-normal text-[#718096] dark:text-[#A0AEC0] truncate max-w-[200px]">
                        {args.path}
                      </span>
                    )}
                    {/* Show file count for multi-file operations */}
                    {args.paths && Array.isArray(args.paths) && (
                      <span className="hidden md:inline font-normal text-[#718096] dark:text-[#A0AEC0]">
                        ({args.paths.length} files)
                      </span>
                    )}
                    {args.files && Array.isArray(args.files) && (isWriteFiles || isEditFiles) && (
                      <span className="hidden md:inline font-normal text-[#718096] dark:text-[#A0AEC0]">
                        ({args.files.length} files)
                      </span>
                    )}
                  </div>
                  <div className={`text-[#D4B8E8] dark:text-[#A888C8] transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                    ▶
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-[#E8F4FC] dark:border-[#4A5568] bg-[#FAFBFC] dark:bg-[#2D3748] p-3 space-y-3">
                    {/* For writeFiles, show all files that were written */}
                    {isWriteFiles && (() => {
                      // Check if output contains multi-file write result
                      if (typeof tool.output === 'object' && tool.output !== null) {
                        const outputObj = tool.output as any;
                        
                        // New multi-file format
                        if (outputObj._multiFileWrite && Array.isArray(outputObj.files)) {
                          return (
                            <div className="space-y-4">
                              {outputObj.files.map((file: any, fileIdx: number) => {
                                if (file.error || !file.success) {
                                  return (
                                    <div key={fileIdx} className="border-l-4 border-red-400 pl-3">
                                      <div className="text-xs text-red-600 dark:text-red-400 mb-1">
                                        ❌ {file.path}
                                      </div>
                                      <div className="text-xs text-[#718096] dark:text-[#A0AEC0]">
                                        {file.error || 'Write failed'}
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div key={fileIdx} className="border-l-4 border-[#7EC8A8] dark:border-[#88C8A8] pl-3">
                                    <div className="text-xs text-[#7EC8A8] dark:text-[#88C8A8] mb-2">
                                      ✅ Written to {file.path}
                                      <br />
                                      📊 {file.lines} lines, {file.chars} characters
                                    </div>
                                    {file.warning && (
                                      <div className="text-xs text-orange-600 dark:text-orange-400 mb-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                                        ⚠️ {file.warning}
                                      </div>
                                    )}
                                    {/* Show content for each file */}
                                    {args.files && args.files[fileIdx] && args.files[fileIdx].content && (
                                      <>
                                        <div className="text-xs font-bold text-[#8B7EC8] dark:text-[#D4B8E8] mb-1">Full Code:</div>
                                        <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed bg-white dark:bg-[#1A202C] p-3 rounded-xl border border-[#E8F4FC] dark:border-[#4A5568]">
                                          {args.files[fileIdx].content}
                                        </pre>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                      }
                      
                      // Legacy single file format (backward compatibility)
                      if (args.content) {
                        return (
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
                        );
                      }
                      return null;
                    })()}
                    {/* Show tool output */}
                    {tool.output && (() => {
                      let outputStr = typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2);
                      
                      // For readFiles, extract and display multiple files
                      if (isReadFiles) {
                        // Check if output is a multi-file read result
                        if (typeof tool.output === 'object' && tool.output !== null) {
                          const outputObj = tool.output as any;
                          
                          // New multi-file format
                          if (outputObj._multiFileRead && Array.isArray(outputObj.files)) {
                            return (
                              <div className="space-y-4">
                                {outputObj.files.map((file: any, fileIdx: number) => {
                                  if (file.error) {
                                    return (
                                      <div key={fileIdx} className="border-l-4 border-red-400 pl-3">
                                        <div className="text-xs text-red-600 dark:text-red-400 mb-1">
                                          ❌ {file.path}
                                        </div>
                                        <div className="text-xs text-[#718096] dark:text-[#A0AEC0]">
                                          {file.error}
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  const lineCount = file.content ? file.content.split('\n').length : 0;
                                  return (
                                    <div key={fileIdx} className="border-l-4 border-[#7EC8A8] dark:border-[#88C8A8] pl-3">
                                      <div className="text-xs text-[#7EC8A8] dark:text-[#88C8A8] mb-2">
                                        ✅ Read from {file.path}
                                        <br />
                                        📊 {lineCount} lines
                                      </div>
                                      {file.warning && (
                                        <div className="text-xs text-orange-600 dark:text-orange-400 mb-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                                          ⚠️ {file.warning}
                                        </div>
                                      )}
                                      <div className="text-xs font-bold text-[#8B7EC8] dark:text-[#D4B8E8] mb-1">File Content:</div>
                                      <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed bg-white dark:bg-[#1A202C] p-3 rounded-xl border border-[#E8F4FC] dark:border-[#4A5568]">
                                        {file.content}
                                      </pre>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          
                          // Legacy single-file format (backward compatibility)
                          const fullContent = outputObj._fullContent || null;
                          const filePath = outputObj._path || args.path || null;
                          
                          if (fullContent) {
                            const lineCount = fullContent.split('\n').length;
                            return (
                              <div>
                                <div className="text-xs text-[#7EC8A8] dark:text-[#88C8A8] mb-2">
                                  ✅ Read from {filePath || 'file'}
                                  <br />
                                  📊 {lineCount} lines
                                </div>
                                {outputObj._warning && (
                                  <div className="text-xs text-orange-600 dark:text-orange-400 mb-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                                    ⚠️ {outputObj._warning}
                                  </div>
                                )}
                                <div className="text-xs font-bold text-[#8B7EC8] dark:text-[#D4B8E8] mb-1">File Content:</div>
                                <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap max-h-96 overflow-y-auto text-xs font-mono leading-relaxed bg-white dark:bg-[#1A202C] p-3 rounded-xl border border-[#E8F4FC] dark:border-[#4A5568]">
                                  {fullContent}
                                </pre>
                              </div>
                            );
                          }
                        }
                      }
                      
                      // For editFiles, display the edit results
                      if (isEditFiles) {
                        // Check if output is a multi-file edit result
                        if (typeof tool.output === 'object' && tool.output !== null) {
                          const outputObj = tool.output as any;
                          
                          // New multi-file format
                          if (outputObj._multiFileEdit && Array.isArray(outputObj.files)) {
                            return (
                              <div className="space-y-4">
                                {outputObj.files.map((file: any, fileIdx: number) => {
                                  if (file.error || !file.success) {
                                    return (
                                      <div key={fileIdx} className="border-l-4 border-red-400 pl-3">
                                        <div className="text-xs text-red-600 dark:text-red-400 mb-1">
                                          ❌ {file.path}
                                        </div>
                                        <div className="text-xs text-[#718096] dark:text-[#A0AEC0]">
                                          {file.error || 'Edit failed'}
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Get the original file edits from args
                                  const originalFileEdits = args.files && args.files[fileIdx] ? args.files[fileIdx].edits : [];
                                  
                                  return (
                                    <div key={fileIdx} className="border-l-4 border-[#7EC8A8] dark:border-[#88C8A8] pl-3">
                                      <div className="text-xs text-[#7EC8A8] dark:text-[#88C8A8] mb-2">
                                        ✅ Edited {file.path}
                                        <br />
                                        ✏️ {file.editCount || 0} edits applied
                                      </div>
                                      {/* Show the edits that were made */}
                                      {originalFileEdits && originalFileEdits.length > 0 && (
                                        <div className="space-y-2 mt-2">
                                          {originalFileEdits.map((edit: any, editIdx: number) => (
                                            <div key={editIdx} className="bg-white dark:bg-[#1A202C] p-2 rounded border border-[#E8F4FC] dark:border-[#4A5568]">
                                              <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">- Old:</div>
                                              <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap text-xs font-mono leading-relaxed mb-2 p-2 bg-red-50 dark:bg-red-900/10 rounded">
                                                {edit.oldText}
                                              </pre>
                                              <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">+ New:</div>
                                              <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap text-xs font-mono leading-relaxed p-2 bg-green-50 dark:bg-green-900/10 rounded">
                                                {edit.newText}
                                              </pre>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                        }
                        
                        // Legacy single-file format (backward compatibility)
                        if (args.edits && Array.isArray(args.edits)) {
                          return (
                            <div>
                              <div className="text-xs text-[#7EC8A8] dark:text-[#88C8A8] mb-2">
                                ✅ Edited {args.path || 'file'}
                                <br />
                                ✏️ {args.edits.length} edits applied
                              </div>
                              <div className="space-y-2">
                                {args.edits.map((edit: any, editIdx: number) => (
                                  <div key={editIdx} className="bg-white dark:bg-[#1A202C] p-2 rounded border border-[#E8F4FC] dark:border-[#4A5568]">
                                    <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">- Old:</div>
                                    <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap text-xs font-mono leading-relaxed mb-2 p-2 bg-red-50 dark:bg-red-900/10 rounded">
                                      {edit.oldText}
                                    </pre>
                                    <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">+ New:</div>
                                    <pre className="text-[#4A5568] dark:text-[#E2E8F0] whitespace-pre-wrap text-xs font-mono leading-relaxed p-2 bg-green-50 dark:bg-green-900/10 rounded">
                                      {edit.newText}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        
                        // If no structured data, skip output display
                        return null;
                      }
                      
                      // For writeFiles, content is already shown above, skip output display
                      if (isWriteFiles) {
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
