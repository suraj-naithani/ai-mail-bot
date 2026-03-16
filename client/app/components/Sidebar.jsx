"use client";

import { useEffect, useMemo, useState } from "react";
import { Ellipsis, PanelRight, Plus } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import {
  useDeleteConversationMutation,
  useGetConversationsQuery,
} from "../redux/api/conversationApi";

const Sidebar = ({
  onNewChat,
  user,
  refreshTrigger,
  mobileOpen = false,
  onClose,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px) and (max-width: 1023px)")
      .matches;
  });
  const [avatarError, setAvatarError] = useState(false);
  const [menuChatId, setMenuChatId] = useState(null);
  const [pendingDeleteChat, setPendingDeleteChat] = useState(null);
  const [isMdViewport, setIsMdViewport] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const { data, error, refetch } = useGetConversationsQuery();
  const [deleteConversation, { isLoading: isDeleting }] =
    useDeleteConversationMutation();
  const chats = Array.isArray(data) && error?.status !== 401 ? data : [];

  const activeChatId = useMemo(() => {
    if (pathname?.startsWith("/chats/")) {
      const id = pathname.replace(/^\/chats\/?/, "").split("/")[0] || null;
      return id || null;
    }
    return null;
  }, [pathname]);

  const avatarUrl = user?.photo || user?.avatarUrl;
  const displayName = user?.name || user?.displayName || "User";
  const initials = (
    (displayName.split(" ")[0]?.[0] || "") +
    (displayName.split(" ")[1]?.[0] || "")
  ).toUpperCase();

  const showAvatar = avatarUrl && !avatarError;

  // Refresh conversations when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  useEffect(() => {
    const mdQuery = window.matchMedia(
      "(min-width: 768px) and (max-width: 1023px)"
    );
    const mobileQuery = window.matchMedia("(max-width: 639px)");

    const handleMdChange = (event) => setIsMdViewport(event.matches);
    const handleMobileChange = (event) => setIsMobileViewport(event.matches);

    handleMdChange(mdQuery);
    handleMobileChange(mobileQuery);

    mdQuery.addEventListener("change", handleMdChange);
    mobileQuery.addEventListener("change", handleMobileChange);

    return () => {
      mdQuery.removeEventListener("change", handleMdChange);
      mobileQuery.removeEventListener("change", handleMobileChange);
    };
  }, []);

  useEffect(() => {
    if (isMdViewport) {
      setCollapsed(true);
    }
  }, [isMdViewport]);

  useEffect(() => {
    if (!isMobileViewport && mobileOpen) {
      onClose?.();
    }
  }, [isMobileViewport, mobileOpen, onClose]);

  useEffect(() => {
    if (isMobileViewport) {
      setCollapsed(false);
    }
  }, [isMobileViewport]);

  const handleNewChat = () => {
    router.push("/chats");
    onNewChat?.();
  };

  const handleRowNavigate = (chatId) => {
    setMenuChatId(null);
    router.push(`/chats/${chatId}`);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteChat) return;
    try {
      await deleteConversation(pendingDeleteChat.id).unwrap();
      if (activeChatId === pendingDeleteChat.id) {
        router.push("/chats");
      }
    } finally {
      setPendingDeleteChat(null);
      setMenuChatId(null);
    }
  };

  const newChatIcon = <Plus className="h-4 w-4" />;
  const isCompact = isMobileViewport ? false : collapsed;

  const handleToggle = () => {
    if (isMobileViewport) {
      onClose?.();
      return;
    }
    setCollapsed((prev) => !prev);
  };

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[1px] sm:hidden"
          onClick={() => onClose?.()}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-60 flex-col border-r border-neutral-900 bg-[#0a0a0a] px-2 py-4 transition-all duration-200 ease-in-out sm:static sm:z-auto sm:translate-x-0 ${
          isCompact ? "sm:w-14" : "sm:w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`flex items-center ${
            isCompact ? "justify-center" : "justify-between"
          }`}
        >
          {!isCompact ? (
            <span className="text-sm font-medium text-slate-100">Chats</span>
          ) : null}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#b3b3b3] transition hover:bg-[#14141f] hover:text-white"
            onClick={handleToggle}
            type="button"
            aria-label={isMobileViewport ? "Close sidebar" : "Toggle sidebar"}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>

      <div
        className={`mt-4 flex flex-col gap-1 ${
          isCompact ? "items-center" : "items-stretch"
        }`}
      >
        <button
          type="button"
          onClick={handleNewChat}
          aria-label="New Chat"
          className={
            isCompact
              ? "flex h-9 w-9 items-center justify-center rounded-xl bg-[#a27bff] text-white shadow-[0_6px_16px_rgba(162,123,255,0.32)] hover:bg-[#8f63ff]"
              : "flex w-full items-center justify-center gap-2 rounded-xl bg-[#a27bff] px-4 py-2 text-sm font-medium text-white shadow-[0_6px_16px_rgba(162,123,255,0.2)] hover:bg-[#8f63ff]"
          }
        >
          {newChatIcon}
          {!isCompact ? <span>New Chat</span> : null}
        </button>
      </div>

      {!isCompact ? (
        <div className="sidebar-scroll mt-6 flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group relative min-w-0 rounded-lg border px-3 py-1 text-left text-sm transition ${
                chat.id === activeChatId
                  ? "border-transparent bg-[#1a1a1a] text-slate-100"
                  : "border-transparent text-slate-300 hover:border-[#262626] hover:bg-[#1a1a1a] hover:text-slate-100"
              }`}
              role="button"
              tabIndex={0}
              onClick={() => handleRowNavigate(chat.id)}
              onMouseLeave={() => {
                if (menuChatId === chat.id) {
                  setMenuChatId(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleRowNavigate(chat.id);
                }
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-xs font-normal">{chat.title}</div>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Chat actions"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[#9ca3af] opacity-0 transition hover:text-white focus:opacity-100 group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuChatId((prev) => (prev === chat.id ? null : chat.id));
                    }}
                  >
                  <Ellipsis className="h-4 w-4" />
                  </button>
                  {menuChatId === chat.id ? (
                    <div
                      className="absolute right-0 top-7 z-20 w-28 rounded-md border border-[#262626] bg-[#0f0f0f] hover:bg-[#1a1a1a] shadow-lg"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs text-rose-200"
                        onClick={() => {
                          setPendingDeleteChat(chat);
                          setMenuChatId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        <div className="border-t border-neutral-900 pt-4">
          {!user ? (
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-800" />
            </div>
          ) : isCompact ? (
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-neutral-800">
                {showAvatar ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-200">
                    {initials}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[36px_1fr] items-center gap-3 px-1">
              <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-800">
                {showAvatar ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-200">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">
                  {displayName}
                </div>
                <div className="truncate text-xs text-[#b3b3b3]">
                  {user?.email || ""}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </aside>
    {pendingDeleteChat ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
        <div className="w-full max-w-sm rounded-2xl border border-[#2a2a3a] bg-[#212121] p-5 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <h3 className="text-sm font-semibold">Delete conversation?</h3>
          <p className="mt-2 text-xs text-[#b3b3b3]">
            This will permanently remove the conversation and all its chats.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-[#262626] px-3 py-2 text-xs text-slate-200 hover:bg-[#1a1a1a]"
              onClick={() => setPendingDeleteChat(null)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#e02e2a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#911e1b] disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
};

export default Sidebar;
