"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check } from "lucide-react";
import {
  isEmailDraft,
  isListContent,
  formatListContent,
  isCompleteConversation,
  stripEmailNumbering,
  markdownToPlainText,
} from "../utils/chatContentUtils";

const Chats = ({ messages }) => {
  const endRef = useRef(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const handleCopy = useCallback((messageId, content) => {
    const plain = markdownToPlainText(content);
    navigator.clipboard.writeText(plain).then(() => {
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 1500);
    });
  }, []);

  const lastContentLength =
    messages.length > 0
      ? messages[messages.length - 1]?.content?.length ?? 0
      : 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastContentLength]);

  return (
    <div className="chat-scroll flex flex-1 flex-col gap-3 overflow-y-auto pr-1 pt-4 sm:gap-4 sm:pr-2 pt-15 xl:pt-8">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex min-w-0 ${
            message.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div className="min-w-0 w-fit max-w-[88%] sm:max-w-[70%]">
            {message.role === "assistant" &&
            message.pending &&
            message.content === "..." ? (
              <div className="flex items-center gap-1 py-2" aria-label="Loading">
                <span className="loading-dot loading-dot-1" />
                <span className="loading-dot loading-dot-2" />
                <span className="loading-dot loading-dot-3" />
              </div>
            ) : (
            <div
              className={`rounded-xl px-3 py-2 overflow-hidden break-words whitespace-normal [overflow-wrap:anywhere] shadow-[0_10px_26px_rgba(0,0,0,0.35)] prose prose-invert max-w-none [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:bg-[#1a1a1a] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:my-2 [&_pre]:[-ms-overflow-style:none] [&_pre]:[scrollbar-width:none] [&_pre::-webkit-scrollbar]:hidden [&_pre_code]:whitespace-pre [&_code]:bg-[#1a1a1a] [&_code]:px-1 [&_code]:rounded [&_code]:break-all [&_a]:text-[#a27bff] [&_a]:underline [&_a]:break-all [&_table]:border-collapse [&_table]:table-auto [&_table]:w-full [&_th]:border [&_td]:border [&_th]:p-2 [&_td]:p-2 [&_p]:my-2 [&_hr]:border-[#2a2a3a] ${
                message.role === "user"
                  ? "bg-[#a27bff] text-white border border-[#a27bff] text-[13px] sm:text-xs"
                  : "bg-[#0f0f16] text-slate-100 border border-[#2a2a3a] text-[13px] leading-relaxed sm:text-xs"
              }`}
            >
              {message.role === "user" ? (
                <span className="block leading-relaxed my-1">{message.content}</span>
              ) : isEmailDraft(message.content) ? (
                <div className="flex flex-col gap-3 [&_strong]:font-semibold">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">
                      Email draft
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          message.id,
                          isCompleteConversation(message.content)
                            ? stripEmailNumbering(message.content)
                            : message.content
                        )
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-[#2a2a3a] bg-[#1a1a24] px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-[#22222e] hover:text-slate-100 transition-colors"
                    >
                      {copiedMessageId === message.id ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy to Gmail
                        </>
                      )}
                    </button>
                  </div>
                  <div className="border-t border-[#2a2a3a] pt-3 [&_p]:my-3">
                    <ReactMarkdown>
                      {isCompleteConversation(message.content)
                        ? stripEmailNumbering(message.content)
                        : message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : isListContent(message.content) ? (
                <div className="[&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside [&_ul]:space-y-1 [&_ol]:space-y-1 [&_ul]:my-2 [&_ol]:my-2 [&_li]:pl-1">
                  <ReactMarkdown>
                    {formatListContent(message.content)}
                  </ReactMarkdown>
                </div>
              ) : (
                <ReactMarkdown>
                  {isCompleteConversation(message.content)
                    ? stripEmailNumbering(message.content)
                    : message.content}
                </ReactMarkdown>
              )}
            </div>
            )}
            {/* {message.role === "assistant" &&
            Array.isArray(message.citations) &&
            message.citations.length ? (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
                {message.citations.map((citation, index) => (
                  <div
                    key={`${message.id}-citation-${index}`}
                    className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="font-medium text-slate-600">
                      {citation.subject || "Untitled email"}
                    </div>
                    <div>
                      {citation.from ? `From: ${citation.from}` : "From: Unknown"}
                    </div>
                    <div>
                      {citation.date ? `Date: ${citation.date}` : "Date: Unknown"}
                    </div>
                    {citation.snippet ? (
                      <div className="mt-1 text-slate-400">
                        {citation.snippet}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null} */}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default Chats;
