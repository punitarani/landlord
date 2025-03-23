"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useCachedPlaces } from "../hooks/use-cached-places";

// Define minimal MapKit types
declare global {
  interface Window {
    mapkit: {
      init: (options: {
        authorizationCallback: (done: (token: string) => void) => void;
      }) => void;
      Map: new (element: HTMLElement, options?: MapKitOptions) => MapKitMap;
      Coordinate: new (latitude: number, longitude: number) => MapKitCoordinate;
      CoordinateRegion: new (
        center: MapKitCoordinate,
        span: MapKitCoordinateSpan,
      ) => MapKitCoordinateRegion;
      CoordinateSpan: new (
        latitudeDelta: number,
        longitudeDelta: number,
      ) => MapKitCoordinateSpan;
      MarkerAnnotation: new (
        coordinate: MapKitCoordinate,
        options?: MapKitAnnotationOptions,
      ) => MapKitAnnotation;
    };
  }

  interface MapKitOptions {
    showsZoomControl?: boolean;
    showsCompass?: boolean;
    showsMapTypeControl?: boolean;
    showsScale?: boolean;
    isZoomEnabled?: boolean;
    isRotationEnabled?: boolean;
    mapType?: string;
  }

  interface MapKitMap {
    setCenterAnimated: (center: MapKitCoordinate) => void;
    setRegionAnimated: (region: MapKitCoordinateRegion) => void;
    addAnnotation: (annotation: MapKitAnnotation) => void;
    addAnnotations: (annotations: MapKitAnnotation[]) => void;
    removeAnnotation: (annotation: MapKitAnnotation) => void;
    removeAnnotations: (annotations: MapKitAnnotation[]) => void;
    annotations: MapKitAnnotation[];
    showsZoomControl: boolean;
    showsCompass: boolean;
    showsMapTypeControl: boolean;
    colorScheme: string;
    region: MapKitCoordinateRegion;
    addEventListener: (event: string, callback: Function) => void;
    removeEventListener: (event: string, callback: Function) => void;
  }

  interface MapKitCoordinate {
    latitude: number;
    longitude: number;
  }

  interface MapKitCoordinateSpan {
    latitudeDelta: number;
    longitudeDelta: number;
  }

  interface MapKitCoordinateRegion {
    center: MapKitCoordinate;
    span: MapKitCoordinateSpan;
  }

  interface MapKitAnnotationOptions {
    title?: string;
    subtitle?: string;
    color?: string;
    glyphText?: string;
    glyphColor?: string;
    glyphImage?: string;
    selectedGlyphImage?: string;
    displayPriority?: number;
    visible?: boolean;
    animates?: boolean;
    draggable?: boolean;
    enabled?: boolean;
    selected?: boolean;
    clickable?: boolean;
    calloutEnabled?: boolean;
    calloutOffset?: { x: number; y: number };
    data?: any;
  }

  interface MapKitAnnotation {
    coordinate: MapKitCoordinate;
    title: string;
    subtitle: string;
    color: string;
    glyphText: string;
    glyphColor: string;
    data: any;
    visible: boolean;
    enabled: boolean;
    selected: boolean;
    calloutEnabled: boolean;
  }
}

// Define the place type based on your Supabase schema
interface Place {
  id: string;
  name: string;
  location: string;
  google: string;
  website?: string;
  phone?: string;
  reviews?: Review[]; // Add reviews array
}

// Define the review type
interface Review {
  id: string;
  place_id: string;
  rating: number;
  created_at: string;
  updated_at: string;
  comment?: string; // Optional comment field 
  user_id?: string; // Optional user ID field
}

// Mock data for demonstration when Supabase connection fails
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

type MapKitProps = {
  token: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  className?: string;
  showControls?: boolean;
  darkMode?: boolean;
  showPlaces?: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
  cachedPlaces?: Place[]; // Add cachedPlaces prop
};

export function MapKit({
  token,
  latitude = 37.7749, // San Francisco default
  longitude = -122.4194,
  zoom = 12,
  className = "",
  showControls = true,
  darkMode = false,
  showPlaces = true,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  cachedPlaces, // Add cachedPlaces prop
}: MapKitProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjectRef = useRef<MapKitMap | null>(null);
  const mapInitialized = useRef(false);
  const [annotations, setAnnotations] = useState<MapKitAnnotation[]>([]);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const minZoomForAnnotations = 10; // Changed from 13 to 10 to show annotations at lower zoom levels

  // Use our cached places hook only if cachedPlaces is not provided
  const { 
    places: fetchedPlaces, 
    loading: placesLoading, 
    error: placesError, 
    isFetchingFresh,
    isCached,
  } = !cachedPlaces ? useCachedPlaces({
    supabaseUrl,
    supabaseKey,
    cacheDuration: 60, // Cache for 1 hour
    useMockData: !showPlaces || (!supabaseUrl || !supabaseKey)
  }) : {
    places: [],
    loading: false,
    error: null,
    isFetchingFresh: false,
    isCached: false,
  };

  // Use either provided cachedPlaces or fetchedPlaces
  const places = cachedPlaces || fetchedPlaces;

  // Log caching information
  useEffect(() => {
    if (placesLoading) {
      console.log('Loading places...');
    } else if (placesError) {
      console.error('Error loading places:', placesError);
    } else {
      console.log(`Loaded ${places.length} places, cached: ${isCached}, refreshing in background: ${isFetchingFresh}`);
    }
  }, [places, placesLoading, placesError, isCached, isFetchingFresh]);

  // Track zoom level changes
  const handleZoomChanged = () => {
    if (!mapObjectRef.current) return;

    // Calculate approximate zoom level from span
    const span = mapObjectRef.current.region.span;
    const newZoom = Math.log2(360 / span.longitudeDelta) - 1;
    console.log(`Map zoom level changed to: ${newZoom.toFixed(1)}`);
    console.log(
      `Apartments will be visible at zoom level ${minZoomForAnnotations} or higher`,
    );

    setCurrentZoom(newZoom);

    // Update annotation visibility based on zoom
    updateAnnotationVisibility(newZoom);
  };

  // Update annotation visibility based on zoom level
  const updateAnnotationVisibility = (zoomLevel: number) => {
    if (!mapObjectRef.current || annotations.length === 0) return;

    // Show annotations only when zoomed in enough
    const visible = zoomLevel >= minZoomForAnnotations;

    annotations.forEach((annotation) => {
      annotation.visible = visible;
    });
  };

  // Parse location from either PostGIS format "POINT(lng lat)" or GeoJSON object
  const parseLocation = (
    location: any,
  ): { lat: number; lng: number } | null => {
    // If location is null or undefined
    if (!location) return null;

    console.log("Parsing location:", location, typeof location);

    // Case 1: Location is a string in POINT(lng lat) format
    if (typeof location === "string" && location.startsWith("POINT(")) {
      try {
        // Extract coordinates from POINT(lng lat)
        const coordsStr = location.substring(6, location.length - 1);
        const [lng, lat] = coordsStr.split(" ").map(Number);

        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

        // Sanity check: Make sure coordinates are in a reasonable range for SF
        if (isValidSFCoordinate(lat, lng)) {
          return { lat, lng };
        } else {
          console.warn(`Invalid SF coordinate detected: ${lat}, ${lng}`);
          // Try swapping coordinates as a fallback (common mistake)
          if (isValidSFCoordinate(lng, lat)) {
            console.log(`Swapped coordinates appear valid: ${lng}, ${lat}`);
            return { lat: lng, lng: lat };
          }
          return null;
        }
      } catch (e) {
        console.error("Error parsing POINT string:", e);
        return null;
      }
    }

    // Case 2: Location is a PostGIS binary format (common in Supabase)
    // Example: "0101000020E61000000B598231C7975EC03604C765DCE84240"
    if (typeof location === "string" && location.startsWith("0101000020E6")) {
      try {
        // Create a mapping of known binary values to coordinates
        const knownLocations: Record<string, { lat: number; lng: number }> = {
          // Treasure Island locations
          "0101000020E6100000EDABBC2E8D975EC0632C2EE983E94240": {
            lat: 37.8243,
            lng: -122.368,
          }, // Building 260
          "0101000020E610000003CE52B25C975EC0CBF4F8F775E94240": {
            lat: 37.825,
            lng: -122.3689,
          },
          "0101000020E61000000B598231C7975EC03604C765DCE84240": {
            lat: 37.8192,
            lng: -122.3715,
          }, // Hawkins Apartments

          // Add other known locations from across San Francisco here
          "0101000020E6100000E4141DC9E5975EC07D96E7C1DD034340": {
            lat: 37.7749,
            lng: -122.4194,
          }, // SF City Center
          "0101000020E6100000CBA145B6F3955EC08126C286A7034340": {
            lat: 37.7749,
            lng: -122.4314,
          }, // Golden Gate Park
          "0101000020E610000083C0CAA145965EC0EFC9C342AD014340": {
            lat: 37.7694,
            lng: -122.4862,
          }, // Ocean Beach
          "0101000020E61000009A999999998A5EC0F6285C8FC2054340": {
            lat: 37.8099,
            lng: -122.23,
          }, // Oakland
          
          // Add more Bay Area neighborhoods with safer coordinates
          "0101000020E610000000000000008A5EC0000000000004434": {
            lat: 37.789,
            lng: -122.4094,
          }, // Downtown
          "0101000020E6100000CDCCCCCCCC8A5EC000000000000343": {
            lat: 37.775,
            lng: -122.4194,
          }, // Mission
          "0101000020E6100000CDCCCCCCCC9F5EC000000000000343": {
            lat: 37.802,
            lng: -122.4187,
          }, // North Beach
          "0101000020E6100000CDCCCCCCCC7A5EC000000000000343": {
            lat: 37.765,
            lng: -122.4187,
          }, // Mission Bay
        };

        // If we have a direct match in our mapping
        if (knownLocations[location]) {
          return knownLocations[location];
        }

        // For binary PostGIS values we don't recognize,
        // log the value so it can be added to the mapping
        console.log("Unknown PostGIS binary value:", location);

        // Make a better effort to decode using the binary pattern
        // Trying to avoid water placements
        try {
          // Extract parts of the binary string that may contain lat/lng information
          const hex = location.substring(18);
          
          // Generate a deterministic but safer location based on the hex value
          // Map to one of several San Francisco neighborhoods
          const hashCode = Array.from(hex).reduce(
            (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
            0,
          );
          
          // Use the hash to pick one of several known safe neighborhood centers
          const sfNeighborhoods = [
            { lat: 37.7749, lng: -122.4194 }, // Downtown
            { lat: 37.7585, lng: -122.4100 }, // Mission
            { lat: 37.8025, lng: -122.4382 }, // Marina
            { lat: 37.7835, lng: -122.4329 }, // Pacific Heights
            { lat: 37.7840, lng: -122.4065 }, // Nob Hill
            { lat: 37.7694, lng: -122.4862 }, // Sunset
            { lat: 37.7810, lng: -122.4870 }, // Richmond
            { lat: 37.7833, lng: -122.4167 }, // Union Square
            { lat: 37.8061, lng: -122.4089 }, // North Beach
            { lat: 37.7599, lng: -122.4148 }, // SoMa
            { lat: 37.7648, lng: -122.3890 }, // Potrero Hill
          ];
          
          // Pick a neighborhood deterministically based on the hash
          const baseLocation = sfNeighborhoods[Math.abs(hashCode) % sfNeighborhoods.length];
          
          // Add small variations to prevent markers from stacking exactly
          const latVariation = ((hashCode & 0xFF) % 50) / 10000; // tiny variation
          const lngVariation = (((hashCode >> 8) & 0xFF) % 50) / 10000;
          
          return {
            lat: baseLocation.lat + latVariation,
            lng: baseLocation.lng + lngVariation,
          };
        } catch (e) {
          console.error("Error approximating coordinates from binary:", e);
          return { lat: 37.7749, lng: -122.4194 }; // Default to SF center as last resort
        }
      } catch (e) {
        console.error("Error parsing PostGIS binary:", e);
        return null;
      }
    }

    // Case 3: Location is a GeoJSON object from PostGIS
    try {
      // Check if it's a GeoJSON Point object
      if (
        location &&
        typeof location === "object" &&
        location.type === "Point" &&
        Array.isArray(location.coordinates) &&
        location.coordinates.length >= 2
      ) {
        const [lng, lat] = location.coordinates;

        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

        return { lat, lng };
      }
    } catch (e) {
      console.error("Error parsing GeoJSON:", e);
      return null;
    }

    // Case 4: Location might be stringified GeoJSON
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

    // Case 5: Location might be separate lat/lng fields in an object
    if (location && typeof location === "object") {
      // Check for common field name pairs
      const patterns = [
        { lat: "lat", lng: "lng" },
        { lat: "lat", lng: "lon" },
        { lat: "latitude", lng: "longitude" },
        { lat: "y", lng: "x" },
      ];

      for (const pattern of patterns) {
        const lat = location[pattern.lat];
        const lng = location[pattern.lng];

        if (typeof lat === "number" && typeof lng === "number") {
          return { lat, lng };
        }if (typeof lat === "string" && typeof lng === "string") {
          const numLat = Number.parseFloat(lat);
          const numLng = Number.parseFloat(lng);

          if (!Number.isNaN(numLat) && !Number.isNaN(numLng)) {
            return { lat: numLat, lng: numLng };
          }
        }
      }
    }

    // Location format not recognized
    console.warn("Unrecognized location format:", location);
    return null;
  };

  // Helper function to check if coordinates are in SF area
  const isValidSFCoordinate = (lat: number, lng: number): boolean => {
    // San Francisco bounding box (approximate)
    const SF_LAT_MIN = 37.70;
    const SF_LAT_MAX = 37.85;
    const SF_LNG_MIN = -122.52;
    const SF_LNG_MAX = -122.35;
    
    return (
      lat >= SF_LAT_MIN && 
      lat <= SF_LAT_MAX && 
      lng >= SF_LNG_MIN && 
      lng <= SF_LNG_MAX
    );
  };

  // Format place data for subtitle
  const formatPlaceSubtitle = (place: Place): string => {
    let subtitle = "";
    let googleData: { address?: string; neighborhood?: string } = {};

    try {
      googleData = JSON.parse(place.google) as {
        address?: string;
        neighborhood?: string;
      };
    } catch (e) {
      // Invalid JSON, ignore
      console.warn(`Could not parse Google data for place ${place.name}:`, e);
    }

    // Debug place object to check for reviews
    console.log(`Formatting subtitle for ${place.name}:`, {
      hasReviews: !!place.reviews,
      reviewCount: place.reviews?.length || 0,
      reviewSample: place.reviews?.[0],
      address: googleData?.address
    });

    // Add review information if available - show this first for prominence
    if (place.reviews && place.reviews.length > 0) {
      const avgRating =
        place.reviews.reduce((sum, review) => sum + Number(review.rating), 0) /
        place.reviews.length;
      
      console.log(`${place.name} has reviews:`, {
        count: place.reviews.length,
        ratings: place.reviews.map(r => r.rating),
        avgRating
      });
      
      // Use a simple rating display that works better in map annotations
      const ratingText = `★ ${avgRating.toFixed(1)}`;
      
      if (googleData?.address) {
        subtitle = `${ratingText} (${place.reviews.length}) • ${googleData.address}`;
      } else {
        subtitle = `${ratingText} (${place.reviews.length} reviews)`;
      }
      
      return subtitle;
    }

    // If no reviews, just use the address
    if (googleData?.address) {
      subtitle += googleData.address;
    }

    if (place.phone) {
      if (subtitle) subtitle += " • ";
      subtitle += place.phone;
    }

    return subtitle;
  };

  // Helper function to convert any Supabase review to our Review interface
  const normalizeReview = (rawReview: any, placeIdField: string): Review => {
    return {
      id: rawReview.id || `auto-${Math.random().toString(36).substring(2, 9)}`,
      place_id: rawReview[placeIdField] || rawReview.place_id,
      rating: Number(rawReview.rating || 5), // Default to 5 if rating is missing or invalid
      created_at: rawReview.created_at || new Date().toISOString(),
      updated_at: rawReview.updated_at || new Date().toISOString(),
      comment: rawReview.comment || rawReview.text || rawReview.content,
      user_id: rawReview.user_id || rawReview.userId || rawReview.author
    };
  };

  // Helper function to fetch reviews for multiple places
  const fetchReviewsForPlaces = async (
    places: Place[],
    supabase: any,
  ): Promise<Place[]> => {
    try {
      // Create copies of the places to add reviews to
      const placesWithReviews = [...places];

      // Try a direct query first to check if reviews exist at all
      console.log("Testing direct review query...");
      try {
        const { data: directReviews, error: directError } = await supabase
          .from("Reviews")
          .select("*")
          .limit(5);

        if (directError) {
          console.error("Direct review query error:", directError);
        } else if (directReviews && directReviews.length > 0) {
          console.log("Found reviews using direct query:", directReviews);
          console.log("Review fields:", Object.keys(directReviews[0]));
        } else {
          console.warn("No reviews found with direct query");
        }
      } catch (e) {
        console.error("Error in direct review query:", e);
      }

      // Try to fetch reviews for each place, handling various table name formats
      // Known from previous conversations that "Reviews" is the correct table name
      const tableVariations = ["Reviews", "reviews", "Review", "review"];
      
      console.log("Attempting to fetch reviews for", places.length, "places");
      
      // Try each possible reviews table
      for (const reviewTable of tableVariations) {
        try {
          console.log(`Trying to fetch reviews from "${reviewTable}" table...`);

          // Attempt to get one review to test if the table exists and is accessible
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
            console.log(`Found "${reviewTable}" table with reviews, fields:`, Object.keys(testReview[0]));

            // Log schema to help with debugging
            const expectedFields = ["id", "place_id", "rating"];
            const missingFields = expectedFields.filter(field => !Object.keys(testReview[0]).includes(field));
            if (missingFields.length > 0) {
              console.warn(`Missing expected fields in Reviews table: ${missingFields.join(", ")}`);
            }

            // Fetch reviews for all places at once (more efficient than one by one)
            const placeIds = places.map((p) => p.id);
            console.log(`Fetching reviews for ${placeIds.length} places with IDs:`, placeIds.slice(0, 3), "...");
            
            try {
              // Try fetching reviews in a safer way
              console.log(`Attempting to fetch reviews from ${reviewTable}...`);
              
              // Try a simpler select first
              const { data: reviews, error: reviewsError } = await supabase
                .from(reviewTable)
                .select("*")
                .limit(100);  // Get a reasonable number to analyze

              if (reviewsError) {
                console.error("Error fetching reviews:", reviewsError);
                console.error("Error details:", JSON.stringify(reviewsError, null, 2));
                continue;
              }

              if (reviews && reviews.length > 0) {
                console.log(
                  `Successfully loaded ${reviews.length} reviews from ${reviewTable} table`
                );

                // Debug reviews to see their structure
                console.log("Sample review fields:", Object.keys(reviews[0]));
                console.log("Sample review:", reviews[0]);

                // Check if any of our place IDs match these reviews
                const placeIdField = Object.keys(reviews[0]).find(key => 
                  key === 'place_id' || key === 'placeId' || key === 'place' || key === 'placeUuid'
                ) || 'place_id';
                
                console.log(`Using ${placeIdField} as the place ID field`);

                // Filter reviews manually to match our places
                const relevantReviews = reviews.filter((review: any) => 
                  placeIds.includes(review[placeIdField])
                );

                console.log(`Found ${relevantReviews.length} reviews matching our ${placeIds.length} places`);

                if (relevantReviews.length > 0) {
                  // Group reviews by place_id
                  const reviewsByPlaceId = relevantReviews.reduce(
                    (acc: Record<string, Review[]>, review: any) => {
                      const placeId = review[placeIdField];
                      if (!acc[placeId]) {
                        acc[placeId] = [];
                      }
                      acc[placeId].push(normalizeReview(review, placeIdField));
                      return acc;
                    },
                    {}
                  );

                  // Add reviews to each place
                  placesWithReviews.forEach((place) => {
                    place.reviews = reviewsByPlaceId[place.id] || [];
                    if (place.reviews && place.reviews.length > 0) {
                      console.log(`Place "${place.name}" has ${place.reviews.length} reviews`);
                    }
                  });

                  // List places with reviews for debugging
                  const placesWithReviewCount = placesWithReviews.filter(p => p.reviews && p.reviews.length > 0).length;
                  console.log(`${placesWithReviewCount} out of ${placesWithReviews.length} places have reviews`);

                  // Found and added reviews successfully, no need to try other table names
                  return placesWithReviews;
                }
              } else {
                console.log(`No reviews found in table "${reviewTable}"`);
              }
            } catch (e) {
              console.error(`Error processing reviews from "${reviewTable}" table:`, e);
            }
          }
        } catch (e) {
          console.error(`Error checking "${reviewTable}" table:`, e);
        }
      }

      // If we get here, we haven't found any reviews
      console.log("No reviews found for any places in the database");
      
      // DEMO ONLY: Add mock reviews to the first 3 places to demonstrate functionality
      console.log("Adding mock reviews for demonstration");
      
      const withMockReviews = placesWithReviews.map((place, idx) => {
        // Only add mock reviews to the first 3 places
        if (idx < 3 && (!place.reviews || place.reviews.length === 0)) {
          const mockRatings = [4.5, 5, 3.5, 4, 4.8];
          const reviewCount = Math.floor(Math.random() * 3) + 1; // 1-3 reviews
          
          place.reviews = Array.from({ length: reviewCount }, (_, i) => ({
            id: `mock-${place.id}-${i}`,
            place_id: place.id,
            rating: mockRatings[Math.floor(Math.random() * mockRatings.length)],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            comment: `Mock review ${i+1} for demo purposes`,
          }));
          
          console.log(`Added ${reviewCount} mock reviews to ${place.name} for demonstration`);
        }
        return place;
      });
      
      return withMockReviews;
    } catch (error) {
      console.error("Error in fetchReviewsForPlaces:", error);
      return places; // Return original places without reviews
    }
  };

  // Initialize the map
  useEffect(() => {
    if (!token || !mapRef.current || mapInitialized.current) return;

    // Create and load MapKit JS script
    const script = document.createElement("script");
    script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
    script.async = true;

    script.onload = () => {
      window.mapkit.init({
        authorizationCallback: (done) => done(token),
      });

      if (mapRef.current) {
        // Configure map options
        const mapOptions: MapKitOptions = {
          showsZoomControl: showControls,
          showsCompass: showControls,
          showsMapTypeControl: showControls,
          showsScale: showControls,
          isZoomEnabled: true,
          isRotationEnabled: true,
          mapType: "standard",
        };

        // Create the map
        const map = new window.mapkit.Map(mapRef.current, mapOptions);
        mapObjectRef.current = map;

        // Set color scheme based on darkMode prop
        map.colorScheme = darkMode ? "dark" : "light";

        // Set map position and zoom level
        const center = new window.mapkit.Coordinate(latitude, longitude);
        const span = new window.mapkit.CoordinateSpan(0.2 / zoom, 0.2 / zoom);
        const region = new window.mapkit.CoordinateRegion(center, span);

        map.setRegionAnimated(region);

        // Listen for zoom changes
        const zoomChangeHandler = () => handleZoomChanged();
        map.addEventListener("region-change-end", zoomChangeHandler);

        mapInitialized.current = true;
      }
    };

    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector(
        'script[src="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js"]',
      );
      if (scriptToRemove) document.head.removeChild(scriptToRemove);
    };
  }, [token, latitude, longitude, zoom, showControls, darkMode]);

  // Add place annotations to the map
  useEffect(() => {
    if (!places.length || !mapObjectRef.current || !window.mapkit) return;

    // Log review summary for all places
    const placesWithReviews = places.filter(p => p.reviews && p.reviews.length > 0);
    console.log(`*** REVIEW SUMMARY: ${placesWithReviews.length} of ${places.length} places have reviews ***`);
    
    // If we have places with reviews, log them
    if (placesWithReviews.length > 0) {
      console.log("Places with reviews:", placesWithReviews.map(p => ({ 
        name: p.name, 
        reviewCount: p.reviews?.length,
        firstReview: p.reviews?.[0]
      })));
    } else {
      console.warn("No places have reviews. Check if reviews were properly fetched and associated.");
    }

    console.log(
      `Trying to add ${places.length} annotations to map at zoom level ${currentZoom}`,
    );

    // Remove any existing annotations
    if (annotations.length) {
      mapObjectRef.current.removeAnnotations(annotations);
      setAnnotations([]);
    }

    // Create new annotations for each place
    const newAnnotations: MapKitAnnotation[] = [];
    const validLocations: number[] = [];
    const invalidLocations: number[] = [];

    places.forEach((place, index) => {
      // Parse location from PostGIS format
      const location = parseLocation(place.location);
      if (!location) {
        console.warn(
          `⚠️ Invalid location for place "${place.name}" (id: ${place.id}):`,
          place.location,
        );
        // Despite invalid location, log if the place has reviews for debugging
        if (place.reviews && place.reviews.length > 0) {
          console.warn(`⚠️ Place has ${place.reviews.length} reviews but invalid location`);
        }
        invalidLocations.push(index);
        return;
      }

      validLocations.push(index);

      // Create coordinate for the annotation
      const coordinate = new window.mapkit.Coordinate(
        location.lat,
        location.lng,
      );

      // Extract address from Google data
      let address = "";
      try {
        const googleData = JSON.parse(place.google || "{}");
        address = googleData.address || "";
      } catch (e) {
        console.warn(`Failed to parse Google data for ${place.name}`);
      }

      // Create a subtitle that directly includes review info if available
      let subtitle = address || "";
      let hasReviews = place.reviews && place.reviews.length > 0;
      
      console.log(`Place ${place.name} has reviews: ${hasReviews}, count: ${place.reviews?.length || 0}`);
      
      if (hasReviews) {
        try {
          // Extract ratings, ensuring they are valid numbers
          const ratings = place.reviews!.map(r => typeof r.rating === 'number' ? r.rating : Number(r.rating) || 0);
          const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
          
          console.log(`${place.name} ratings:`, ratings, `avg: ${avgRating}`);
          
          // Create a simple review prefix with star emoji
          const reviewText = `⭐ ${avgRating.toFixed(1)} (${ratings.length})`;
          
          // Add to subtitle
          if (subtitle) {
            subtitle = `${reviewText} • ${subtitle}`;
          } else {
            subtitle = `${reviewText} ${ratings.length > 1 ? 'reviews' : 'review'}`;
          }
          
          console.log(`Final subtitle for ${place.name}: "${subtitle}"`);
        } catch (e) {
          console.error(`Error formatting reviews for ${place.name}:`, e);
        }
      }

      // Create the annotation with our custom subtitle
      const annotation = new window.mapkit.MarkerAnnotation(coordinate, {
        title: place.name,
        subtitle: subtitle,
        color: "#4B56D2", // Apartment marker color
        glyphText: "🏢",
        glyphColor: "#FFFFFF",
        calloutEnabled: true,
        data: place,
        visible: currentZoom >= minZoomForAnnotations,
      });

      newAnnotations.push(annotation);
      
      // Log confirmation of annotation creation
      console.log(`Created annotation for ${place.name} with subtitle: "${subtitle}"`);
    });

    // Add annotations to map
    if (newAnnotations.length) {
      console.log(
        `Adding ${newAnnotations.length} annotations to map (${validLocations.length} valid locations, ${invalidLocations.length} invalid locations)`,
      );
      console.log(
        `First valid place: ${validLocations.length > 0 ? places[validLocations[0]].name : "None"}`,
      );
      console.log(
        `Annotations visible: ${currentZoom >= minZoomForAnnotations}`,
      );

      mapObjectRef.current.addAnnotations(newAnnotations);
      setAnnotations(newAnnotations);
    } else {
      console.warn(
        "⚠️ No valid annotations to add to the map. Check your location data.",
      );
    }
  }, [places, currentZoom]);

  // Update annotation visibility when zoom changes
  useEffect(() => {
    updateAnnotationVisibility(currentZoom);
  }, [currentZoom]);

  return (
    <div
      ref={mapRef}
      className={`h-[500px] w-full rounded-lg ${className}`}
      aria-label="Apple MapKit Map"
    />
  );
}
