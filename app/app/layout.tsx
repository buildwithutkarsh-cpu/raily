"use client";

import AppLayout from "@/components/app/AppLayout";

/**
 * App route layout — wraps the /app route in the full AppLayout experience.
 * AppLayout manages all content internally via sidebar section selection.
 */
export default function AppRootLayout() {
  return <AppLayout />;
}
