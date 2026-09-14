export default function Loading() {
  return (
    <div className="min-h-screen grid place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-border border-t-ink animate-spin" />
        <span className="font-mono text-[12px] tracking-wide text-muted">LOADING VAULT...</span>
      </div>
    </div>
  );
}
