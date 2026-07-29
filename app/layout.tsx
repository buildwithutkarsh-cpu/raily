import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

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
          card: "border border-[var(--border)] rounded-none bg-[var(--bg)] w-full shadow-none",
          headerTitle: "font-sans text-[var(--fg)] font-semibold text-xl",
          headerSubtitle: "font-sans text-[var(--muted)] text-sm",
          socialButtonsBlockButton:
            "font-sans border border-[var(--border)] rounded-none text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-all duration-150 text-sm",
          socialButtonsBlockButtonText: "font-sans",
          formFieldLabel: "font-mono text-[var(--fg)] text-xs uppercase tracking-[0.05em]",
          formFieldInput:
            "font-sans border border-[var(--border)] rounded-none bg-transparent text-[var(--fg)] focus:border-[var(--fg)]",
          formButtonPrimary:
            "font-sans bg-[var(--fg)] text-[var(--bg)] border border-[var(--fg)] rounded-none hover:bg-[var(--railway-red)] hover:border-[var(--railway-red)] transition-all duration-150 text-xs uppercase tracking-[0.05em]",
          footerActionLink:
            "font-sans text-[var(--fg)] hover:text-[var(--railway-red)]",
          identityPreviewText: "font-sans text-sm",
          identityPreviewEditButton: "text-[var(--railway-red)]",
          dividerLine: "bg-[var(--border)]",
          dividerText: "font-mono text-[var(--muted)] text-xs uppercase tracking-[0.05em]",
          otpCodeFieldInput:
            "font-sans border border-[var(--border)] rounded-none text-[var(--fg)]",
          alertText: "font-sans text-sm",
          alert: "border border-[var(--border)] rounded-none bg-transparent",
          formFieldAction:
            "font-sans text-[var(--railway-red)] text-xs",
        },
      }}
    >
      <html
        lang="en"
        className={`h-full antialiased ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      >
        <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)] font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
