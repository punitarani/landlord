import { createSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIndexedDB } from "./use-indexed-db";

// Helper function to parse location data
const parseLocation = (
  location: unknown,
): { lat: number; lng: number } | null => {
  // If location is null or undefined
  if (!location) return null;

  // Case 1: Location is a string in PostGIS format
  if (
    typeof location === "string" &&
    location.startsWith("0101000020E6100000")
  ) {
    try {
      // This is simplified for example - actual implementation would need to parse hex
      return null; // Not implemented here
    } catch (e) {
      return null;
    }
  }

  // Case 2: Location is a string in POINT(lng lat) format
  if (typeof location === "string" && location.startsWith("POINT(")) {
    try {
      const coordsStr = location.substring(6, location.length - 1);
      const [lng, lat] = coordsStr.split(" ").map(Number);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { lat, lng };
    } catch (e) {
      return null;
    }
  }

  // Case 3: Location is a GeoJSON object
  try {
    if (
      location &&
      typeof location === "object" &&
      "type" in location &&
      location.type === "Point" &&
      "coordinates" in location &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length >= 2
    ) {
      const coordinates = location.coordinates as number[];
      const [lng, lat] = coordinates;
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { lat, lng };
    }
  } catch (e) {
    // Ignore errors
  }

  // Case 4: Stringified GeoJSON
  if (typeof location === "string") {
    try {
      const parsedLocation = JSON.parse(location);
      if (
        parsedLocation &&
        parsedLocation.type === "Point" &&
        Array.isArray(parsedLocation.coordinates) &&
        parsedLocation.coordinates.length >= 2
      ) {
        const [lng, lat] = parsedLocation.coordinates;
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return { lat, lng };
      }
    } catch (e) {
      // Not valid JSON, ignore
    }
  }

  return null;
};

// Define types based on Supabase database schema
export interface Place {
  id: string;
  name: string;
  location: unknown;
  google: string | null;
  website?: string | null;
  phone?: string | null;
  reviews?: Review[];
}

export interface Review {
  id: string;
  place_id: string;
  rating: number;
  created_at?: string;
  updated_at?: string;
  comment?: string;
  user_id?: string;
}

// Type for raw review data that might come in various formats
interface RawReview {
  id?: string;
  place_id?: string;
  placeId?: string;
  place?: string;
  placeUuid?: string;
  rating?: number;
  created_at?: string;
  updated_at?: string;
  comment?: string;
  text?: string;
  content?: string;
  user_id?: string;
  userId?: string;
  author?: string;
  [key: string]: unknown;
}

interface UseCachedPlacesOptions {
  cacheDuration?: number; // in minutes
}

// Define a type for the review from Supabase
type SupabaseReview = Database["public"]["Tables"]["Reviews"]["Row"];

export function useCachedPlaces({
  cacheDuration = 60, // Default to 1 hour
}: UseCachedPlacesOptions = {}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFetchingFresh, setIsFetchingFresh] = useState<boolean>(false);
  const [isCached, setIsCached] = useState<boolean>(false);
  const fetchingRef = useRef<boolean>(false);

  // Get IndexedDB methods
  const {
    isReady: isDbReady,
    isCacheValid,
    getCacheTimestamp,
    storePlaces,
    storeReviews,
    getPlaces,
    getReviews,
    clearCache,
  } = useIndexedDB();

  // Track cache timestamp
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Update the last updated timestamp
  useEffect(() => {
    if (!isDbReady || !isCached) return;

    async function getTimestamp() {
      const timestamp = await getCacheTimestamp("places");
      setLastUpdated(timestamp);
    }

    getTimestamp();
  }, [isDbReady, isCached, getCacheTimestamp]);

  // Helper function to normalize review data
  const normalizeReview = useCallback(
    (rawReview: RawReview, placeIdField: string): Review => {
      return {
        id:
          rawReview.id || `auto-${Math.random().toString(36).substring(2, 9)}`,
        place_id:
          (rawReview[placeIdField] as string) || rawReview.place_id || "",
        rating: Number(rawReview.rating || 5), // Default to 5 if rating is missing or invalid
        created_at: rawReview.created_at || new Date().toISOString(),
        updated_at: rawReview.updated_at || new Date().toISOString(),
        comment:
          (rawReview.comment as string) ||
          (rawReview.text as string) ||
          (rawReview.content as string),
        user_id:
          (rawReview.user_id as string) ||
          (rawReview.userId as string) ||
          (rawReview.author as string),
      };
    },
    [],
  );

  // Fetch reviews for places from Supabase
  const fetchReviewsForPlaces = useCallback(
    async (places: Place[]): Promise<Place[]> => {
      try {
        // Create copies of the places to add reviews to
        const placesWithReviews = [...places];

        // Create supabase client
        const supabase = createSupabaseClient();

        // Directly query the Reviews table
        const { data: reviews, error: reviewsError } = await supabase
          .from("Reviews")
          .select("*");

        if (reviewsError) {
          console.error("Error fetching reviews:", reviewsError);
          return places;
        }

        if (reviews && reviews.length > 0) {
          console.log(
            `Successfully loaded ${reviews.length} reviews from Reviews table`,
          );

          // Store all reviews in IndexedDB for future use
          const normalizedReviews: Review[] = reviews.map(
            (review: SupabaseReview) => ({
              id: review.id,
              place_id: review.place_id || "",
              rating: review.rating,
            }),
          );

          await storeReviews(normalizedReviews, cacheDuration);

          // Group reviews by place_id
          const reviewsByPlaceId = normalizedReviews.reduce(
            (acc: Record<string, Review[]>, review: Review) => {
              const placeId = review.place_id;
              if (!acc[placeId]) {
                acc[placeId] = [];
              }
              acc[placeId].push(review);
              return acc;
            },
            {},
          );

          // Add reviews to each place
          for (const place of placesWithReviews) {
            place.reviews = reviewsByPlaceId[place.id] || [];
          }
        } else {
          console.log("No reviews found in Reviews table");

          // Try to use cached reviews if available
          try {
            const cachedReviews = await getReviews();
            if (cachedReviews && cachedReviews.length > 0) {
              console.log(
                `Using ${cachedReviews.length} cached reviews from IndexedDB`,
              );

              // Group cached reviews by place_id
              const reviewsByPlaceId = cachedReviews.reduce(
                (acc: Record<string, Review[]>, review: Review) => {
                  const placeId = review.place_id;
                  if (!acc[placeId]) {
                    acc[placeId] = [];
                  }
                  acc[placeId].push(review);
                  return acc;
                },
                {},
              );

              // Add cached reviews to places
              for (const place of placesWithReviews) {
                place.reviews = reviewsByPlaceId[place.id] || [];
              }
            }
          } catch (err) {
            console.error("Error retrieving cached reviews:", err);
          }
        }

        return placesWithReviews;
      } catch (error) {
        console.error("Error in fetchReviewsForPlaces:", error);
        return places; // Return original places without reviews
      }
    },
    [storeReviews, getReviews, cacheDuration],
  );

  // Function to fetch fresh data from Supabase
  const fetchFreshData = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      console.log("Already fetching data, skipping duplicate request");
      return;
    }

    fetchingRef.current = true;
    setIsFetchingFresh(true);

    try {
      // Use the Supabase client from lib
      const supabase = createSupabaseClient();

      // Query the Place table
      console.log('Querying "Place" table in Supabase...');
      const { data, error } = await supabase
        .from("Place")
        .select("id, name, location, google, website, phone");

      if (error) {
        console.error(
          "Error fetching from Place table:",
          error.code,
          error.message,
        );
        throw new Error(`Failed to fetch places: ${error.message}`);
      }

      if (data?.length) {
        console.log(
          `Successfully loaded ${data.length} places from Place table`,
        );
        console.log("Sample place data:", data[0]);

        // Convert to our Place type
        const typedPlaces: Place[] = data.map((place) => ({
          id: place.id,
          name: place.name,
          location: place.location,
          google: place.google,
          website: place.website,
          phone: place.phone,
        }));

        console.log(`Converted ${typedPlaces.length} places to typed format`);

        // Fetch reviews if available and combine with places
        const placesWithReviews = await fetchReviewsForPlaces(typedPlaces);

        // Store in IndexedDB
        await storePlaces(placesWithReviews, cacheDuration);

        setIsCached(false);
        setPlaces(placesWithReviews);
      } else {
        throw new Error("No places found in Place table");
      }
    } catch (err) {
      console.error("Error fetching fresh data:", err);
      throw err;
    } finally {
      setIsFetchingFresh(false);
      fetchingRef.current = false;
    }
  }, [fetchReviewsForPlaces, storePlaces, cacheDuration]);

  // Main function to fetch places with caching
  const fetchPlacesWithCache = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if the cache is valid before fetching from network
      if (isDbReady) {
        const isPlacesCacheValid = await isCacheValid("places", cacheDuration);

        if (isPlacesCacheValid) {
          console.log("Using cached places from IndexedDB");

          // Get cached places and reviews
          const cachedPlaces = await getPlaces();

          if (cachedPlaces && cachedPlaces.length > 0) {
            console.log(`Retrieved ${cachedPlaces.length} cached places`);
            setPlaces(cachedPlaces);
            setIsCached(true);
            setLoading(false);

            // Optionally fetch fresh data in the background
            fetchFreshData().catch(console.error);
            return;
          }

          console.log("Cache is valid but empty, fetching fresh data");
        } else {
          console.log("Cache is invalid or expired, fetching fresh data");
        }
      } else {
        console.log("IndexedDB not ready yet, fetching from network");
      }

      // Fetch fresh data
      await fetchFreshData();
    } catch (err) {
      console.error("Error in fetchPlacesWithCache:", err);
      setError(err instanceof Error ? err : new Error(String(err)));

      // Try to use cached data as fallback
      if (isDbReady) {
        try {
          const cachedPlaces = await getPlaces();
          if (cachedPlaces && cachedPlaces.length > 0) {
            console.log(
              `Error fetching fresh data, using ${cachedPlaces.length} cached places as fallback`,
            );
            setPlaces(cachedPlaces);
            setIsCached(true);
          } else {
            console.error("No cached data available");
            setPlaces([]);
          }
        } catch (cacheErr) {
          console.error("Error retrieving cache:", cacheErr);
          setPlaces([]);
        }
      } else {
        console.error("IndexedDB not ready");
        setPlaces([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isDbReady, isCacheValid, getPlaces, cacheDuration, fetchFreshData]);

  // Refresh data manually
  const refreshData = useCallback(async () => {
    setIsFetchingFresh(true);
    try {
      await fetchFreshData();
      return true;
    } catch (err) {
      console.error("Error refreshing data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsFetchingFresh(false);
    }
  }, [fetchFreshData]);

  // Clear the cache manually
  const clearPlacesCache = useCallback(async () => {
    if (isDbReady) {
      await clearCache();
      console.log("Places cache cleared");
      return true;
    }
    return false;
  }, [isDbReady, clearCache]);

  // Function to fetch places within given bounds
  const fetchPlacesWithinBounds = useCallback(
    async (
      northEast: { lat: number; lng: number },
      southWest: { lat: number; lng: number },
      zoomLevel?: number,
    ) => {
      try {
        const supabase = createSupabaseClient();

        console.log(
          'Querying "Place" table within bounds:',
          northEast,
          southWest,
          zoomLevel ? `zoom: ${zoomLevel.toFixed(2)}` : "",
        );

        const { data, error } = await supabase
          .from("Place")
          .select("id, name, location, google, website, phone");

        if (error) {
          console.error(
            "Error fetching from Place table within bounds:",
            error.code,
            error.message,
          );
          throw new Error(
            `Failed to fetch places within bounds: ${error.message}`,
          );
        }

        if (data?.length) {
          console.log(
            `Successfully loaded ${data.length} places from database, filtering to map bounds`,
          );

          const typedPlaces: Place[] = data
            .map((place) => ({
              id: place.id,
              name: place.name,
              location: place.location,
              google: place.google,
              website: place.website,
              phone: place.phone,
            }))
            .filter((place) => {
              const location = parseLocation(place.location);
              if (!location) return false;

              return (
                location.lat >= southWest.lat &&
                location.lat <= northEast.lat &&
                location.lng >= southWest.lng &&
                location.lng <= northEast.lng
              );
            });

          console.log(`Found ${typedPlaces.length} places within map bounds`);

          let filteredByZoom = typedPlaces;
          if (zoomLevel !== undefined) {
            if (zoomLevel < 10) {
              filteredByZoom = typedPlaces.filter(
                (place) => place.reviews && place.reviews.length > 0,
              );
              console.log(
                `Low zoom (${zoomLevel.toFixed(2)}): Filtered to ${filteredByZoom.length} notable places`,
              );
            } else if (zoomLevel < 14 && typedPlaces.length > 30) {
              const withReviews = typedPlaces.filter(
                (place) => place.reviews && place.reviews.length > 0,
              );
              const withoutReviews = typedPlaces.filter(
                (place) => !place.reviews || place.reviews.length === 0,
              );

              const totalToShow = Math.min(30, typedPlaces.length);
              const withoutReviewsToShow = Math.max(
                0,
                totalToShow - withReviews.length,
              );

              filteredByZoom = [
                ...withReviews,
                ...withoutReviews.slice(0, withoutReviewsToShow),
              ];
              console.log(
                `Medium zoom (${zoomLevel.toFixed(2)}): Showing ${filteredByZoom.length} places`,
              );
            }
          }

          const placesWithReviews = await fetchReviewsForPlaces(filteredByZoom);

          setPlaces((prevPlaces) => {
            const existingIds = new Set(prevPlaces.map((place) => place.id));

            const newPlaces = placesWithReviews.filter(
              (place) => !existingIds.has(place.id),
            );

            console.log(`Adding ${newPlaces.length} new places to the map`);

            if (newPlaces.length > 0) {
              const combinedPlaces = [...prevPlaces, ...newPlaces];

              if (zoomLevel !== undefined && combinedPlaces.length > 100) {
                console.log(
                  `Limiting total places from ${combinedPlaces.length} to 100 for performance`,
                );
                const withReviews = combinedPlaces.filter(
                  (place) => place.reviews && place.reviews.length > 0,
                );
                const withoutReviews = combinedPlaces.filter(
                  (place) => !place.reviews || place.reviews.length === 0,
                );

                const remainingSpots = Math.max(0, 100 - withReviews.length);
                return [
                  ...withReviews,
                  ...withoutReviews.slice(0, remainingSpots),
                ];
              }

              return combinedPlaces;
            }
            return prevPlaces;
          });
        } else {
          console.log("No new places found within bounds");
        }
      } catch (err) {
        console.error("Error fetching places within bounds:", err);
      }
    },
    [fetchReviewsForPlaces],
  );

  // Initial data fetch
  useEffect(() => {
    if (isDbReady) {
      fetchPlacesWithCache();
    }
  }, [isDbReady, fetchPlacesWithCache]);

  return {
    places,
    loading,
    error,
    isFetchingFresh,
    isCached,
    refreshData,
    clearCache: clearPlacesCache,
    lastUpdated,
    fetchPlacesWithinBounds,
  };
}
