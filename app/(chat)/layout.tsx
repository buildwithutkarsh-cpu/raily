"use client";

import { RapiQueryProvider } from "@/lib/rapi/provider";
import AppLayout from "@/components/layout/AppLayout";

export default function AppRootLayout() {
  return (
    <RapiQueryProvider>
      <AppLayout />
    </RapiQueryProvider>
  );
}
