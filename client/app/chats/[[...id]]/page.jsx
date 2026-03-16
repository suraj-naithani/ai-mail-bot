"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import ChatPanel from "../../components/ChatPanel";
import {
  useGetConversationChatsQuery,
} from "../../redux/api/conversationApi";
import { useGetSessionUserQuery } from "../../redux/api/authApi";

const serverUrl =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:7894";

function mapChatToMessage(chat) {
  return {
    id: chat.id,
    role: chat.role === "system" ? "assistant" : chat.role,
    content: chat.message ?? "",
    citations: [],
  };
}

export default function ChatsPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.id?.[0] ?? null;
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [chatSeed, setChatSeed] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { data: sessionData, error: sessionError } = useGetSessionUserQuery();
  const user = sessionData?.user ?? null;
  const {
    data: chatsData,
    error: chatsError,
    isLoading: loadingMessages,
  } = useGetConversationChatsQuery(conversationId, {
    skip: !conversationId,
  });

  const messages = useMemo(
    () => (Array.isArray(chatsData) ? chatsData.map(mapChatToMessage) : []),
    [chatsData]
  );

  const conversationMissing =
    conversationId &&
    (chatsError?.status === 403 || chatsError?.status === 404);

  useEffect(() => {
    if (sessionError?.status === 401) {
      router.push("/login");
    }
  }, [router, sessionError]);

  useEffect(() => {
    if (chatsError?.status === 401) {
      router.push("/login");
    }
  }, [router, chatsError]);

  const isAdmin = user?.role === "admin";
  const connectGmail = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    window.location.href = `${serverUrl}/auth/gmail/connect`;
  };

  const handleConversationCreated = () => {
    setSidebarRefreshTrigger((prev) => prev + 1);
  };

  const handleNewChat = () => {
    setChatSeed((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-black text-slate-100">
      <div className="grid min-h-screen grid-cols-1 sm:grid-cols-[auto_1fr]">
        <Sidebar
          onNewChat={handleNewChat}
          user={user}
          refreshTrigger={sidebarRefreshTrigger}
          mobileOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
        {conversationMissing ? (
          <main className="relative flex h-screen flex-col items-center justify-center px-6 text-center">
            <div className="max-w-md rounded-2xl border border-[#2a2a3a] bg-[#10101a]/70 px-6 py-8 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
              <p className="text-2xl font-semibold text-white">
                Conversation not found
              </p>
              <p className="mt-2 text-sm text-slate-300">
                The link may be invalid or the conversation was deleted.
              </p>
              <button
                type="button"
                onClick={() => router.push("/chats")}
                className="mt-5 rounded-xl bg-[#a27bff] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(162,123,255,0.4)] transition hover:-translate-y-0.5 hover:bg-[#b090ff]"
              >
                Start a new chat
              </button>
            </div>
          </main>
        ) : (
          <ChatPanel
            isAdmin={isAdmin}
            onConnect={connectGmail}
            resetKey={chatSeed}
            conversationId={conversationId}
            initialMessages={messages}
            loadingMessages={!!conversationId && loadingMessages}
            onConversationCreated={handleConversationCreated}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />
        )}
      </div>
    </div>
  );
}
