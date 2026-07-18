import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a centralized, production-ready QueryClient with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent aggressive and disruptive background re-fetching
      staleTime: 1000 * 60 * 2,     // 2 minutes stale time before data is considered out of date
      gcTime: 1000 * 60 * 10,      // 10 minutes garbage collection time to preserve cache memory
      retry: (failureCount, error: any) => {
        // Disable retrying for typical client/authorization errors
        const status = error?.status || error?.statusCode;
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }
        return failureCount < 2; // Retry transient network/server failures up to 2 times
      },
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
