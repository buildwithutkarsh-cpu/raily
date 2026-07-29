export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Top bar skeleton */}
      <div className="h-14 border-b border-[var(--border)] flex items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--border)] animate-pulse" />
          <div className="h-3 w-16 bg-[var(--border)] animate-pulse" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-3 w-14 bg-[var(--border)] animate-pulse" />
          <div className="w-7 h-7 bg-[var(--border)] animate-pulse" />
        </div>
      </div>

      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-[600px] w-full space-y-6">
          {/* Message bubble skeletons */}
          <div className="flex justify-start">
            <div className="w-3/4 space-y-2">
              <div className="h-3 w-1/4 bg-[var(--border)] animate-pulse" />
              <div className="h-10 w-full bg-[var(--border)] animate-pulse" />
            </div>
          </div>
          <div className="flex justify-end">
            <div className="w-1/2 space-y-2">
              <div className="h-3 w-1/3 bg-[var(--border)] animate-pulse ml-auto" />
              <div className="h-8 w-full bg-[var(--border)] animate-pulse" />
            </div>
          </div>
          <div className="flex justify-start">
            <div className="w-2/3 space-y-2">
              <div className="h-3 w-1/5 bg-[var(--border)] animate-pulse" />
              <div className="h-16 w-full bg-[var(--border)] animate-pulse" />
            </div>
          </div>

          {/* Input skeleton */}
          <div className="pt-4">
            <div className="h-12 w-full bg-[var(--border)] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
