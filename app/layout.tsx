import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
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
    <html lang="en" className={`h-full antialiased ${ibmPlexMono.variable}`}>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)] font-mono">
        {/* Custom brutalist cursor — replaces default cursor globally */}
        <Cursor />
        {children}
      </body>
    </html>
  );
}
