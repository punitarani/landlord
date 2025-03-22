import { useQuery } from "@tanstack/react-query";

interface TokenResponse {
  token?: string;
  error?: string;
}

/**
 * Custom hook to get MapKit token
 *
 * This hook will first try to use the NEXT_PUBLIC_MAPKIT_TOKEN from environment variables.
 * If that's not available, it will attempt to fetch from the API as a fallback.
 */
export function useMapKitToken() {
  return useQuery<TokenResponse>({
    queryKey: ["mapkit-token"],
    queryFn: async () => {
      // First, try to use token from environment variable
      const envToken = process.env.NEXT_PUBLIC_MAPKIT_TOKEN;

      if (envToken) {
        return { token: envToken };
      }

      // Fallback to API if env token is not available
      try {
        const response = await fetch("/api/mapkit-token");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch MapKit token");
        }

        return data;
      } catch (error) {
        return {
          error: (error as Error).message || "MapKit token not available",
        };
      }
    },
  });
}
