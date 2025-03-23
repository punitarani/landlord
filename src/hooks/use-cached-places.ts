import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useIndexedDB } from './use-indexed-db';

// Types based on your existing types in MapKit.tsx
interface Place {
  id: string;
  name: string;
  location: string;
  google: string;
  website?: string;
  phone?: string;
  reviews?: Review[];
}

interface Review {
  id: string;
  place_id: string;
  rating: number;
  created_at: string;
  updated_at: string;
  comment?: string;
  user_id?: string;
}

// Mock data for fallback
const MOCK_PLACES: Place[] = [
  {
    id: "1",
    name: "Vedanta Society Building",
    location: "POINT(-122.419 37.795)",
    google: JSON.stringify({
      address: "2323 Vallejo St, San Francisco, CA 94123",
      neighborhood: "Pacific Heights",
    }),
    website: "https://sfvedanta.org",
    phone: "(415) 922-2323",
    reviews: [
      {
        id: "r1",
        place_id: "1",
        rating: 4.5,
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-01T00:00:00Z"
      },
      {
        id: "r2",
        place_id: "1",
        rating: 5,
        created_at: "2023-01-02T00:00:00Z",
        updated_at: "2023-01-02T00:00:00Z"
      }
    ]
  },
  {
    id: "2",
    name: "Stuart Hall Apartments",
    location: "POINT(-122.415 37.794)",
    google: JSON.stringify({
      address: "1715 Octavia St, San Francisco, CA 94109",
      neighborhood: "Pacific Heights",
    }),
    website: "https://www.sacredsf.org",
    phone: "(415) 563-2900",
    reviews: [
      {
        id: "r3",
        place_id: "2",
        rating: 3.5,
        created_at: "2023-01-03T00:00:00Z",
        updated_at: "2023-01-03T00:00:00Z"
      }
    ]
  },
  {
    id: "3",
    name: "Mrs. Doubtfire's House",
    location: "POINT(-122.42 37.79)",
    google: JSON.stringify({
      address: "2640 Steiner St, San Francisco, CA 94115",
      neighborhood: "Pacific Heights",
    }),
  },
  {
    id: "4",
    name: "Fillmore Stairs",
    location: "POINT(-122.434 37.795)",
    google: JSON.stringify({
      address: "1709 Broderick St, San Francisco, CA 94115",
      neighborhood: "Pacific Heights",
    }),
  },
];

interface UseCachedPlacesOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  cacheDuration?: number; // in minutes
  useMockData?: boolean;
}

export function useCachedPlaces({
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  cacheDuration = 60, // Default to 1 hour
  useMockData = false
}: UseCachedPlacesOptions = {}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFetchingFresh, setIsFetchingFresh] = useState<boolean>(false);
  const [isCached, setIsCached] = useState<boolean>(false);
  
  // Get IndexedDB methods
  const {
    isReady: isDbReady,
    isCacheValid,
    getCacheTimestamp,
    storePlaces,
    storeReviews,
    getPlaces,
    getReviews,
    clearCache
  } = useIndexedDB();

  // Track cache timestamp
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Update the last updated timestamp
  useEffect(() => {
    if (!isDbReady || !isCached) return;
    
    async function getTimestamp() {
      const timestamp = await getCacheTimestamp('places');
      setLastUpdated(timestamp);
    }
    
    getTimestamp();
  }, [isDbReady, isCached, getCacheTimestamp]);

  // Helper function to normalize review data
  const normalizeReview = useCallback((rawReview: any, placeIdField: string): Review => {
    return {
      id: rawReview.id || `auto-${Math.random().toString(36).substring(2, 9)}`,
      place_id: rawReview[placeIdField] || rawReview.place_id,
      rating: Number(rawReview.rating || 5), // Default to 5 if rating is missing or invalid
      created_at: rawReview.created_at || new Date().toISOString(),
      updated_at: rawReview.updated_at || new Date().toISOString(),
      comment: rawReview.comment || rawReview.text || rawReview.content,
      user_id: rawReview.user_id || rawReview.userId || rawReview.author
    };
  }, []);

  // Fetch reviews for places from Supabase
  const fetchReviewsForPlaces = useCallback(async (
    places: Place[],
    supabase: any,
  ): Promise<Place[]> => {
    try {
      // Create copies of the places to add reviews to
      const placesWithReviews = [...places];
      let allReviews: Review[] = [];

      // Try each possible reviews table name
      const tableVariations = ["Reviews", "reviews", "Review", "review"];
      let foundReviews = false;
      
      for (const reviewTable of tableVariations) {
        try {
          console.log(`Trying to fetch reviews from "${reviewTable}" table...`);

          // Test if the table exists and is accessible
          const { data: testReview, error: testError } = await supabase
            .from(reviewTable)
            .select("*")
            .limit(1);

          if (testError) {
            console.log(
              `Cannot access "${reviewTable}" table:`,
              testError.code,
              testError.message
            );
            continue; // Try next table name
          }

          if (testReview && testReview.length > 0) {
            console.log(`Found "${reviewTable}" table with reviews`);

            // Fetch all reviews (limited to a reasonable number)
            const { data: reviews, error: reviewsError } = await supabase
              .from(reviewTable)
              .select("*")
              .limit(500);  // Increased limit to handle more reviews

            if (reviewsError) {
              console.error("Error fetching reviews:", reviewsError);
              continue;
            }

            if (reviews && reviews.length > 0) {
              console.log(`Successfully loaded ${reviews.length} reviews from ${reviewTable} table`);

              // Identify the place ID field
              const placeIdField = Object.keys(reviews[0]).find(key => 
                key === 'place_id' || key === 'placeId' || key === 'place' || key === 'placeUuid'
              ) || 'place_id';
              
              // Store all reviews in IndexedDB for future use
              const normalizedReviews = reviews.map((review: any) => normalizeReview(review, placeIdField));
              allReviews = normalizedReviews;
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
                {}
              );

              // Add reviews to each place
              placesWithReviews.forEach((place) => {
                place.reviews = reviewsByPlaceId[place.id] || [];
              });

              foundReviews = true;
              break; // Exit the loop, we found reviews
            }
          }
        } catch (e) {
          console.error(`Error checking "${reviewTable}" table:`, e);
        }
      }

      if (!foundReviews) {
        console.log("No reviews found in any table");
        
        // Try to get cached reviews if available
        try {
          const cachedReviews = await getReviews();
          if (cachedReviews && cachedReviews.length > 0) {
            console.log(`Using ${cachedReviews.length} cached reviews from IndexedDB`);
            
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
              {}
            );

            // Add cached reviews to places
            placesWithReviews.forEach((place) => {
              place.reviews = reviewsByPlaceId[place.id] || [];
            });
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
  }, [normalizeReview, storeReviews, getReviews, cacheDuration]);

  // Main function to fetch places with caching
  const fetchPlacesWithCache = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // If mock data is explicitly requested, use it
      if (useMockData) {
        console.log("Using mock data as requested");
        setPlaces(MOCK_PLACES);
        setLoading(false);
        return;
      }
      
      // Check if we have Supabase credentials
      if (!supabaseUrl || !supabaseKey) {
        console.log("No Supabase credentials, using mock data");
        setPlaces(MOCK_PLACES);
        setLoading(false);
        return;
      }
      
      // Check if the cache is valid before fetching from network
      if (isDbReady) {
        const isPlacesCacheValid = await isCacheValid('places', cacheDuration);
        
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
            setIsFetchingFresh(true);
            fetchFreshData();
            return;
          } else {
            console.log("Cache is valid but empty, fetching fresh data");
          }
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
            console.log(`Error fetching fresh data, using ${cachedPlaces.length} cached places as fallback`);
            setPlaces(cachedPlaces);
            setIsCached(true);
          } else {
            console.log("No cached data available, using mock data");
            setPlaces(MOCK_PLACES);
          }
        } catch (cacheErr) {
          console.error("Error retrieving cache:", cacheErr);
          setPlaces(MOCK_PLACES);
        }
      } else {
        console.log("IndexedDB not ready, using mock data");
        setPlaces(MOCK_PLACES);
      }
    } finally {
      setLoading(false);
      setIsFetchingFresh(false);
    }
  }, [
    supabaseUrl, 
    supabaseKey, 
    isDbReady, 
    isCacheValid, 
    getPlaces, 
    useMockData, 
    cacheDuration,
    fetchReviewsForPlaces
  ]);
  
  // Function to fetch fresh data from Supabase
  const fetchFreshData = useCallback(async () => {
    try {
      console.log("Connecting to Supabase:", supabaseUrl);
      const supabase = createClient(supabaseUrl!, supabaseKey!);
      
      // Try to fetch from "Place" table (uppercase)
      console.log('Trying to query "Place" table in Supabase...');
      const { data, error } = await supabase
        .from("Place")
        .select("id, name, location, google, website, phone")
        .limit(500);  // Increased for more places

      if (error) {
        console.error("Error fetching from Place table:", error.code, error.message);
        
        // Try lowercase "place" as fallback
        console.log('Trying lowercase "place" table as fallback...');
        const { data: lowerData, error: lowerError } = await supabase
          .from("place")
          .select("id, name, location, google, website, phone")
          .limit(500);

        if (lowerError) {
          console.error("Error fetching from lowercase place table:", lowerError);
          
          // Try "places" (plural) as second fallback
          console.log('Trying plural "places" table as second fallback...');
          const { data: pluralData, error: pluralError } = await supabase
            .from("places")
            .select("id, name, location, google, website, phone")
            .limit(500);

          if (pluralError) {
            console.error("Error fetching from places table:", pluralError);
            throw new Error("All database queries failed");
          }

          if (pluralData?.length) {
            console.log(`Loaded ${pluralData.length} places from plural "places" table`);
            
            // Fetch reviews and save to cache
            const placesWithReviews = await fetchReviewsForPlaces(pluralData, supabase);
            await storePlaces(placesWithReviews, cacheDuration);
            
            setIsCached(false);
            setPlaces(placesWithReviews);
            return;
          }
        }

        if (lowerData?.length) {
          console.log(`Loaded ${lowerData.length} places from lowercase "place" table`);
          
          // Fetch reviews and save to cache
          const placesWithReviews = await fetchReviewsForPlaces(lowerData, supabase);
          await storePlaces(placesWithReviews, cacheDuration);
          
          setIsCached(false);
          setPlaces(placesWithReviews);
          return;
        }

        throw new Error("No places found in any table");
      }

      if (data?.length) {
        console.log(`Successfully loaded ${data.length} places from Place table`);
        
        // Fetch reviews if available and combine with places
        const placesWithReviews = await fetchReviewsForPlaces(data, supabase);
        
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
    }
  }, [
    supabaseUrl, 
    supabaseKey, 
    fetchReviewsForPlaces, 
    storePlaces, 
    cacheDuration
  ]);
  
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

  // Initial data fetch
  useEffect(() => {
    // Only fetch if IndexedDB is ready or if we're using mock data
    if (isDbReady || useMockData || !supabaseUrl || !supabaseKey) {
      fetchPlacesWithCache();
    }
  }, [isDbReady, fetchPlacesWithCache, useMockData, supabaseUrl, supabaseKey]);

  return {
    places,
    loading,
    error,
    isFetchingFresh,
    isCached,
    refreshData,
    clearCache: clearPlacesCache,
    lastUpdated
  };
} 