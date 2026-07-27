import { SignUp } from "@clerk/nextjs";
import { TrainFront } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)]">
              <TrainFront className="h-5 w-5 text-[var(--bg)]" />
            </div>
            <span className="text-lg font-bold uppercase tracking-[0.15em] text-[var(--fg)]">
              RAILY
            </span>
          </Link>
          <h1 className="text-2xl font-bold uppercase tracking-[0.05em] text-[var(--fg)]">
            Create account
          </h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            Join RAILY — AI-powered railway booking
          </p>
        </div>

        {/* Clerk Sign-Up Component */}
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/app"
        />

        {/* Footer */}
        <p className="text-center text-[11px] text-[var(--muted)] uppercase tracking-[0.15em] mt-6">
          AI Operating System for Indian Railways
        </p>
      </div>
    </div>
  );
}
