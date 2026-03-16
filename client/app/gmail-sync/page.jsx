"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSyncGmailMutation } from "../redux/api/gmailApi";

export default function GmailSyncPage() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("syncing");
  const [syncedCount, setSyncedCount] = useState(0);
  const router = useRouter();
  const [syncGmail] = useSyncGmailMutation();

  useEffect(() => {
    if (status !== "syncing") return;
    let isMounted = true;

    const sync = async () => {
      try {
        const data = await syncGmail({ all: true }).unwrap();
        if (!isMounted) return;
        const nextSyncedCount = data.syncedCount || 0;
        setSyncedCount(nextSyncedCount);
        setProgress(100);
        setStatus("done");
        toast.success(`Synced ${nextSyncedCount} emails`);
        router.push("/chats");
      } catch (err) {
        if (!isMounted) return;
        setStatus("error");
        const message =
          err?.data?.message ||
          err?.data?.error ||
          err?.message ||
          "Failed to sync emails";
        toast.error(message);
        router.push("/chats");
      }
    };

    sync();

    return () => {
      isMounted = false;
    };
  }, [status, router, syncGmail]);

  return (
    <div className="h-screen overflow-hidden bg-black px-6 py-0 text-slate-100">
      <div className="mx-auto flex h-full w-full max-w-sm items-center">
        <div className="w-full rounded-2xl border border-[#262626] bg-[#0a0a0a] px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] text-[#615fff]">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M4 6h16M4 10h16M4 14h10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">
                Syncing Gmail
              </h1>
              <p className="text-xs text-[#b3b3b3]">
                Your emails are being imported securely.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="h-2 rounded-full bg-neutral-900">
              <div
                className={`h-2 rounded-full transition-all ${
                  status === "error" ? "bg-rose-500" : "bg-[#615fff]"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#b3b3b3]">
              <span>{Math.round(progress)}%</span>
              {status === "done" ? (
                <span className="text-emerald-400">
                  Synced {syncedCount} emails
                </span>
              ) : null}
            </div>
          </div>

          <p className="mt-5 text-[11px] text-[#b3b3b3]">
            You can keep this tab open while we finish syncing.
          </p>
        </div>
      </div>
    </div>
  );
}
