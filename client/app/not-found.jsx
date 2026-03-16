import Link from "next/link";

const NotFound = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-purple-500/30 blur-[120px]" />
        <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
        <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur sm:p-10">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            Page not found
          </div>

          <div className="space-y-3">
            <p className="text-6xl font-semibold text-white sm:text-7xl">404</p>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              We can&apos;t find that page
            </h1>
            <p className="text-sm text-slate-300 sm:text-base">
              The link might be broken or the page may have moved. Use the
              options below to get back on track.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/chats"
              className="rounded-xl bg-[#a27bff] px-5 py-3 text-sm font-semibold text-white shadow-[0_15px_30px_rgba(162,123,255,0.35)] transition hover:-translate-y-0.5 hover:bg-[#b090ff]"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 text-xs text-slate-400 sm:flex-row sm:gap-4">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Status: 404
          </span>
          <span>Need help? Contact support.</span>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
