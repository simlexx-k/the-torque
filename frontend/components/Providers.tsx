"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Tooltip } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeRuntime } from "@/components/ThemeToggle";

function ThemeAwareToaster() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <Toaster
      position="bottom-right"
      theme={mounted && theme === "dark" ? "dark" : "light"}
      richColors
      closeButton
      toastOptions={{ className: "torque-toast" }}
    />
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            retry: 2,
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="data-theme"
      themes={["light", "dark"]}
      defaultTheme="light"
      enableSystem={false}
      enableColorScheme
      storageKey="torque-theme"
    >
      <ThemeRuntime />
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <Tooltip.Provider delayDuration={180} skipDelayDuration={80}>
            {children}
            <ThemeAwareToaster />
          </Tooltip.Provider>
        </QueryClientProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
