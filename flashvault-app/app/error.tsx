"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen grid place-items-center bg-bg p-6">
      <div className="max-w-[480px] w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 grid place-items-center mx-auto text-[20px]">!</div>
        <h2 className="mt-4 font-bold text-[20px] tracking-tight">Something went wrong</h2>
        <p className="mt-2 text-[14px] text-muted leading-[1.6]">{error.message || "An unexpected error occurred. Our team has been notified."}</p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={reset} className="px-5 h-10 rounded-pill bg-ink text-white text-[13px] font-medium">Try again</button>
          <a href="/" className="px-5 h-10 rounded-pill border border-border bg-white grid place-items-center text-[13px]">Go home</a>
        </div>
      </div>
    </div>
  );
}
