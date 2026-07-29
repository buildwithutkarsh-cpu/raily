"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function UserMenu() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
      title="Sign out"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}