"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { Send } from "lucide-react";
import Header from "./Header";
import Chats from "./Chats";
import LoadingSpinner from "./LoadingSpinner";
import {
  useCreateConversationMutation,
  useSendConversationMessageMutation,
  conversationApi,
} from "../redux/api/conversationApi";

const EMPTY_MESSAGES = [];

const ChatPanel = ({
  isAdmin,
  onConnect,
  resetKey,
  user,
  conversationId,
  initialMessages,
  onMessagesLoaded,
  loadingMessages = false,
  onConversationCreated,
  onOpenSidebar,
}) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [createConversation] = useCreateConversationMutation();
  const [sendConversationMessage] = useSendConversationMessageMutation();
  const streamedContentRef = useRef("");

  const emptyState = useMemo(() => messages.length === 0, [messages.length]);

  // Use stable empty when initialMessages not provided to avoid infinite effect loop
  const messagesToSync = useMemo(
    () =>
      initialMessages === undefined || initialMessages === null
        ? EMPTY_MESSAGES
        : Array.isArray(initialMessages)
          ? initialMessages
          : EMPTY_MESSAGES,
    [initialMessages]
  );

  useEffect(() => {
    if (conversationId != null) {
      setMessages((prev) => {
        if (
          prev.length === messagesToSync.length &&
          prev.every((p, i) => {
            const m = messagesToSync[i];
            const content = m?.content ?? m?.message ?? "";
            return m && p.id === m.id && p.content === content;
          })
        ) {
          return prev;
        }
        return messagesToSync;
      });
    } else {
      setMessages([]);
      setInput("");
    }
  }, [conversationId, messagesToSync]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setInput("");
    }
  }, [resetKey, conversationId]);

  const handleSend = async (event) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage = {
      id: Math.random().toString(16).slice(2, 10),
      role: "user",
      content: trimmed,
    };

    const assistantId = Math.random().toString(16).slice(2, 10);
    streamedContentRef.current = "";
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: "...",
        citations: [],
        pending: true,
      },
    ]);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      // If no conversationId, create a new conversation first
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const conversation = await createConversation({
          title: "New chat",
        }).unwrap();
        currentConversationId = conversation.id;
        
        // Notify parent component about the new conversation
        if (typeof onConversationCreated === "function") {
          onConversationCreated(conversation);
        }
      }
      await sendConversationMessage({
        conversationId: currentConversationId,
        message: trimmed,
        onMetadata: (data) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, citations: data.citations ?? [] }
                : msg
            )
          );
        },
        onChunk: (content) => {
          streamedContentRef.current += content;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content:
                      msg.content === "..."
                        ? content
                        : msg.content + content,
                  }
                : msg
            )
          );
        },
        onTitle: (title) => {
          // Invalidate conversations cache to update sidebar with new title
          dispatch(
            conversationApi.util.invalidateTags([
              { type: "Conversation", id: currentConversationId },
              "Conversation",
            ])
          );
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content:
                      msg.content === "..."
                        ? "No answer available."
                        : msg.content,
                    pending: false,
                  }
                : msg
            )
          );
        },
      }).unwrap();

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, pending: false } : msg
        )
      );

      if (!conversationId && currentConversationId) {
        const assistantContent =
          streamedContentRef.current || "No answer available.";
        const chatsArray = [
          { id: userMessage.id, role: "user", message: trimmed },
          { id: assistantId, role: "assistant", message: assistantContent },
        ];
        dispatch(
          conversationApi.util.upsertQueryData(
            "getConversationChats",
            currentConversationId,
            chatsArray
          )
        );
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            router.replace(`/chats/${currentConversationId}`, {
              scroll: false,
            });
          });
        });
      }
    } catch (err) {
      if (err?.status === 401) {
        router.push("/login");
        return;
      }
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  "Sorry, I couldn't answer that right now. Please try again.",
                pending: false,
              }
            : message
        )
      );
      const message =
        err?.data?.message ||
        err?.data?.error ||
        err?.message ||
        "Failed to send message";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <main className="relative flex h-screen flex-col overflow-hidden text-slate-100">
      <div className="absolute left-2 right-2 top-3 z-10 max-[1150px]:left-0 max-[1150px]:right-0 max-[1150px]:top-0 max-[1150px]:w-full max-[1150px]:bg-black max-[1150px]:px-[10px] max-[1150px]:py-3">
        <Header
          isAdmin={isAdmin}
          onConnect={onConnect}
          onOpenSidebar={onOpenSidebar}
        />
      </div>

      <div className="flex h-full flex-col gap-3 px-4 lg:px-8 pb-2 lg:pb-6 pt-0">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-3 overflow-hidden">
          <section className="flex min-h-0 flex-1 flex-col [contain:layout]">
            {conversationId && loadingMessages ? (
              <div className="flex flex-1 items-center justify-center">
                <LoadingSpinner size={40} />
              </div>
            ) : emptyState ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-xl px-8 py-10 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center">
                    <div className="h-14 w-14 rounded-full bg-[conic-gradient(from_0deg,#e0d3ff,#9b7bff,#e0d3ff)] p-[3px] shadow-[0_0_26px_rgba(155,123,255,0.55)] [animation:spin_10s_linear_infinite]">
                      <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_top,#f1eaff,transparent_65%)] blur-[1.5px]" />
                    </div>
                  </div>
                  <div className="text-4xl font-medium bg-gradient-to-t from-[#a27bff] to-white text-transparent bg-clip-text">
                    {user?.name || user?.displayName
                      ? `Hello, ${(user?.name || user?.displayName).split(" ")[0]}`
                      : ""}
                  </div>
                  <div className="mt-2 text-4xl font-medium text-slate-100">
                    How can I assist you today?
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-200">
                    {[
                      "Summarize my latest emails",
                      "Draft a reply to a client",
                      "Show follow-ups due today",
                    ].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-[#2a2a3a] bg-[#141420]/80 px-3 py-1 text-[#c5c7d4] shadow-[0_6px_18px_rgba(0,0,0,0.25)] backdrop-blur"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Chats messages={messages} />
            )}
          </section>

          {error ? (
            <div className="rounded-lg border border-rose-900/60 bg-rose-950/50 px-4 py-2 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          <form
            className="flex items-center gap-2 rounded-xl border border-[#222236] bg-[#12121a]/90 px-2 py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur sm:gap-2 sm:rounded-xl sm:px-2 sm:py-1 md:gap-2 md:rounded-xl md:px-2 md:py-1 lg:gap-3 lg:rounded-2xl lg:px-3 lg:py-2"
            onSubmit={handleSend}
          >
            <div className="flex-1">
              <input
                className="w-full rounded-lg border border-transparent bg-transparent px-2.5 py-2 text-[13px] text-slate-100 placeholder:text-[#9aa0b4] outline-none focus:border-transparent focus:outline-none sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-[12px] md:rounded-lg md:px-2 md:py-1.5 md:text-[12px] lg:rounded-xl lg:px-3 lg:py-2.5 lg:text-sm"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about your inbox..."
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#a27bff] text-white shadow-[0_12px_30px_rgba(162,123,255,0.45)] hover:bg-[#8f63ff] disabled:cursor-not-allowed disabled:bg-[#7a52e0] sm:h-8 sm:w-8 sm:rounded-lg md:h-9 md:w-9 md:rounded-xl lg:h-11 lg:w-11 lg:rounded-2xl"
              aria-label="Send"
              disabled={isLoading}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};

export default ChatPanel;
