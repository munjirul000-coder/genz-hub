"use client";
import { Card, CardContent } from "@/components/ui/card";

export function ProductCardSkeleton() {
  return (
    <Card className="rounded-[16px] overflow-hidden border-border bg-bg2 animate-pulse">
      <div className="aspect-[4/5] bg-bg3" />
      <CardContent className="p-4 space-y-3">
        <div className="h-3 bg-bg3 rounded w-1/3" />
        <div className="h-4 bg-bg3 rounded w-3/4" />
        <div className="h-3 bg-bg3 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-6 bg-bg3 rounded-full w-16" />
          <div className="h-6 bg-bg3 rounded-full w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="max-w-[1320px] mx-auto px-[20px] sm:px-[28px] py-8 space-y-6">
      <div className="h-8 bg-bg3 rounded w-1/4 animate-pulse" />
      <div className="h-4 bg-bg3 rounded w-1/2 animate-pulse" />
      <ProductGridSkeleton />
    </div>
  );
}

export function EmptyState({ title, description, action, icon = "◫" }: { title: string; description?: string; action?: React.ReactNode; icon?: string }) {
  return (
    <div className="py-16 px-6 text-center border border-dashed border-border rounded-[20px] bg-bg2">
      <div className="w-16 h-16 rounded-full bg-bg3 border border-border grid place-items-center mx-auto text-[24px]">{icon}</div>
      <h3 className="mt-6 text-[20px] font-bold tracking-tight">{title}</h3>
      {description && <p className="mt-2 text-[14px] text-muted max-w-[420px] mx-auto leading-[1.6]">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, retry }: { title?: string; message?: string; retry?: () => void }) {
  return (
    <div className="py-16 px-6 text-center border border-red-200 rounded-[20px] bg-red-50">
      <div className="w-16 h-16 rounded-full bg-red-100 border border-red-200 grid place-items-center mx-auto text-[24px]">!</div>
      <h3 className="mt-6 text-[20px] font-bold tracking-tight text-red-900">{title}</h3>
      {message && <p className="mt-2 text-[13px] text-red-700 max-w-[420px] mx-auto">{message}</p>}
      {retry && <button onClick={retry} className="mt-6 px-6 h-10 rounded-pill bg-ink text-white font-bold text-[13px]">Try Again →</button>}
    </div>
  );
}

export function LoadingDots() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-8">
      <span className="w-2 h-2 rounded-full bg-ink animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 rounded-full bg-ink animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 rounded-full bg-ink animate-bounce" />
    </div>
  );
}
