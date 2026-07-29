"use client";

import { ReactNode } from "react";
import { RapiQueryProvider } from "@/lib/rapi/provider";

export default function AppRootLayout({ children }: { children: ReactNode }) {
  return (
    <RapiQueryProvider>
      {children}
    </RapiQueryProvider>
  );
}
