"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Tooltip } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

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
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>
        <Tooltip.Provider delayDuration={180} skipDelayDuration={80}>
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            richColors
            closeButton
            toastOptions={{ className: "torque-toast" }}
          />
        </Tooltip.Provider>
      </QueryClientProvider>
    </NuqsAdapter>
  );
}
