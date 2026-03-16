"use client";

import { useEffect } from "react";

export default function LoginPage() {
  const serverUrl =
    process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:7894";

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const res = await fetch(`${serverUrl}/auth/session-user`, {
          method: "POST",
          credentials: "include",
        });
        if (!isMounted) return;
        if (res.ok) {
          window.location.href = "/";
        }
      } catch (error) {
        if (!isMounted) return;
      }
    };

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [serverUrl]);

  const loginWithGoogle = () => {
    window.location.href = `${serverUrl}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex items-center justify-center px-4 sm:px-5">
      <div
        className="
          w-full max-w-[340px] sm:max-w-[380px]
          bg-neutral-950 
          border border-neutral-900 
          rounded-xl 
          shadow-[0_12px_40px_rgba(0,0,0,0.45)]
          overflow-hidden
        "
      >
        <div className="bg-neutral-950 px-6 py-8 sm:px-9 sm:py-10">
          <div className="text-center mb-7 sm:mb-8">
            {/* Small brand mark */}
            <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-neutral-900 text-slate-100 font-semibold text-base sm:text-lg mb-4 sm:mb-5">
              AI
            </div>

            <h1 className="text-lg sm:text-xl font-medium text-slate-100 tracking-tight">
              Sign in to AI Mail Bot
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-[#b3b3b3]">
              Continue with your Google account
            </p>
          </div>

          <button
            onClick={loginWithGoogle}
            className="
              w-full
              flex items-center justify-center gap-2.5
              bg-neutral-900
              border border-neutral-800
              hover:border-neutral-700
              hover:bg-neutral-800
              text-slate-100
              text-sm font-medium
              rounded-lg
              py-2.5 px-4 sm:px-5
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:ring-offset-1 focus:ring-offset-neutral-950
            "
          >
            <svg 
              className="w-4.5 h-4.5" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.51h5.84c-.25 1.31-.98 2.42-2.07 3.16v2.63h3.35c1.96-1.81 3.09-4.47 3.09-7.99z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-1.01 7.28-2.73l-3.35-2.63c-.93.68-2.05 1.08-3.93 1.08-3.02 0-5.58-2.04-6.49-4.79H.96v2.67C2.77 20.39 6.62 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.51 14.21c-.23-.68-.36-1.41-.36-2.21s.13-1.53.36-2.21V7.34H.96C.35 8.85 0 10.39 0 12s.35 3.15.96 4.66l4.55-2.45z"
              />
              <path
                fill="#EA4335"
                d="M12 4.98c1.64 0 3.11.56 4.27 1.66l3.19-3.19C17.46 1.01 14.97 0 12 0 6.62 0 2.77 2.61.96 6.34l4.55 2.45C6.42 6.02 8.98 4.98 12 4.98z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-[11px] sm:text-xs text-[#b3b3b3]">
            By continuing, you agree to our Terms and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}