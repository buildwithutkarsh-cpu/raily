import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-6">
      <div className="max-w-[400px] text-center space-y-8">
        {/* Status */}
        <div className="space-y-2">
          <p className="text-[200px] font-semibold leading-none tracking-tighter text-[var(--fg)]">
            404
          </p>
          <p className="text-sm uppercase tracking-[0.15em] text-[var(--muted)] font-mono">
            Page not found
          </p>
        </div>

        {/* Message */}
        <p className="text-[13px] text-[var(--muted)] leading-relaxed">
          This route does not exist on the Indian Railways network.
        </p>

        {/* Divider */}
        <div className="w-12 h-px bg-[var(--border)] mx-auto" />

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 bg-[var(--fg)] text-[var(--bg)] text-xs font-medium hover:bg-[var(--railway-red)] transition-colors"
          >
            Return Home
          </Link>
          <Link
            href="/app"
            className="px-4 py-2 border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
          >
            Open RAILY
          </Link>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] pt-4">
          AI Operating System for Indian Railways
        </p>
      </div>
    </div>
  );
}
