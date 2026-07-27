import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Cursor from "@/components/Cursor";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RAILY",
  description: "An AI operating system for Indian Railways.",
  openGraph: {
    title: "RAILY",
    description: "An AI operating system for Indian Railways.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        elements: {
          rootBox: "w-full",
          card: "shadow-none border-2 border-[var(--fg)] rounded-none bg-[var(--bg)] w-full",
          headerTitle: "font-mono text-[var(--fg)] font-bold uppercase tracking-[0.05em] text-xl",
          headerSubtitle: "font-mono text-[var(--muted)] text-sm",
          socialButtonsBlockButton:
            "font-mono border-2 border-[var(--fg)] rounded-none text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-all duration-150 text-sm uppercase tracking-[0.1em]",
          socialButtonsBlockButtonText: "font-mono uppercase tracking-[0.05em]",
          formFieldLabel: "font-mono text-[var(--fg)] text-xs uppercase tracking-[0.1em]",
          formFieldInput:
            "font-mono border-2 border-[var(--fg)] rounded-none bg-transparent text-[var(--fg)] focus:ring-0 focus:border-[var(--fg)]",
          formButtonPrimary:
            "font-mono bg-[var(--fg)] text-[var(--bg)] border-2 border-[var(--fg)] rounded-none hover:bg-[var(--railway-red)] hover:border-[var(--railway-red)] transition-all duration-150 text-xs uppercase tracking-[0.1em]",
          footerActionLink:
            "font-mono text-[var(--fg)] hover:text-[var(--railway-red)] underline-offset-2",
          identityPreviewText: "font-mono text-sm",
          identityPreviewEditButton: "text-[var(--railway-red)]",
          dividerLine: "bg-[var(--fg)]/20",
          dividerText: "font-mono text-[var(--muted)] text-xs uppercase tracking-[0.1em]",
          otpCodeFieldInput:
            "font-mono border-2 border-[var(--fg)] rounded-none text-[var(--fg)]",
          alertText: "font-mono text-sm",
          alert: "border-2 border-[var(--fg)] rounded-none bg-transparent",
          formFieldAction:
            "font-mono text-[var(--railway-red)] text-xs uppercase tracking-[0.1em]",
          formFieldErrorText: "font-mono text-[var(--railway-red)] text-xs",
        },
      }}
    >
      <html lang="en" className={`h-full antialiased ${ibmPlexMono.variable}`}>
        <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)] font-mono">
          {/* Custom brutalist cursor — replaces default cursor globally */}
          <Cursor />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
