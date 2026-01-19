import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { BASE_URL, API_ENDPOINTS } from "@/constants/config";

/**
 * Get the full tRPC URL
 * Uses BASE_URL from centralized config
 */
const getTrpcUrl = (): string => {
  if (!BASE_URL) {
    // In development without a configured URL, tRPC calls will fail gracefully
    console.warn("No BASE_URL configured. tRPC calls will not work.");
    return "";
  }
  return `${BASE_URL}${API_ENDPOINTS.TRPC}`;
};

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getTrpcUrl(),
      transformer: superjson,
    }),
  ],
});
