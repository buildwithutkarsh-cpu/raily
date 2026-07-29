"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-6">
      <div className="max-w-[400px] text-center space-y-8">
        {/* Status */}
        <div className="space-y-2">
          <div className="w-12 h-12 flex items-center justify-center bg-[var(--railway-red)] mx-auto">
            <span className="text-[var(--bg)] text-lg font-semibold">!</span>
          </div>
          <p className="text-sm uppercase tracking-[0.15em] text-[var(--muted)] font-mono">
            Something went wrong
          </p>
        </div>

        {/* Message */}
        <p className="text-[13px] text-[var(--muted)] leading-relaxed">
          An unexpected error occurred. Please try again.
        </p>

        {/* Divider */}
        <div className="w-12 h-px bg-[var(--border)] mx-auto" />

        {/* Actions */}
        <button
          onClick={reset}
          className="px-4 py-2 bg-[var(--fg)] text-[var(--bg)] text-xs font-medium hover:bg-[var(--railway-red)] transition-colors"
        >
          Try Again
        </button>

        {/* Footer */}
        <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] pt-4">
          AI Operating System for Indian Railways
        </p>
      </div>
    </div>
  );
}
