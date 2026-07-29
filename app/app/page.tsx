import dynamic from "next/dynamic";

const AppLayout = dynamic(
  () => import("@/components/layout/AppLayout"),
  {
    loading: () => (
      <div className="flex flex-col h-screen bg-[var(--bg)]">
        <div className="h-14 border-b border-[var(--border)] flex items-center justify-between px-6">
          <div className="w-7 h-7 bg-[var(--border)] animate-pulse" />
          <div className="w-20 h-3 bg-[var(--border)] animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border border-[var(--border)] animate-pulse" />
        </div>
      </div>
    ),
  }
);

export default function AppPage() {
  return <AppLayout />;
}
