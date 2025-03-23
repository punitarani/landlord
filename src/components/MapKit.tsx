"use client";

import { useCachedPlaces } from "@/hooks/use-cached-places";
import { useCallback, useEffect, useRef, useState } from "react";

// Define minimal types for Place and Review
interface Review {
  id: string;
  place_id: string;
  rating: number;
  created_at?: string;
  updated_at?: string;
  comment?: string;
  user_id?: string;
}

interface Place {
  id: string;
  name: string;
  location: unknown;
  google: string | null;
  website?: string | null;
  phone?: string | null;
  reviews?: Review[];
}

// Define a type for MapKit annotations
type MapKitAnnotation = mapkit.MarkerAnnotation;

type MapKitProps = {
  token: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  className?: string;
  showControls?: boolean;
  darkMode?: boolean;
  fullscreen?: boolean;
  showPlaces?: boolean;
  cachedPlaces?: Place[];
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  onMapInitialized?: (map: mapkit.Map) => void;
};

export function MapKit({
  token,
  latitude = 37.7749, // San Francisco default
  longitude = -122.4194,
  zoom = 12,
  className = "",
  showControls = false,
  darkMode = true,
  fullscreen = false,
  showPlaces = true,
  cachedPlaces = [],
  padding = { top: 0, right: 0, bottom: 0, left: 0 },
  onMapInitialized,
}: MapKitProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);
  const scriptLoaded = useRef(false);
  const mapInstance = useRef<mapkit.Map | null>(null);
  const annotationsRef = useRef<MapKitAnnotation[]>([]);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const minZoomForAnnotations = 5; // Show annotations at most zoom levels
  const processedPlacesRef = useRef<string>("");

  // Use the hook to get fetchPlacesWithinBounds
  const { fetchPlacesWithinBounds } = useCachedPlaces();

  // Create the initializeMap function with useCallback
  const initializeMap = useCallback(() => {
    if (!mapRef.current || !token || !window.mapkit || mapInitialized.current)
      return;

    try {
      // Only initialize if not already initialized
      // Use a custom property on window to track initialization
      const mapkitWithCustomProps = window.mapkit as typeof window.mapkit & {
        _jsAPIInitialized?: boolean;
      };

      if (!mapkitWithCustomProps._jsAPIInitialized) {
        window.mapkit.init({
          authorizationCallback: (done: (token: string) => void) => done(token),
          language: "en",
        });

        // Mark as initialized
        mapkitWithCustomProps._jsAPIInitialized = true;
      }

      // Configure map options with proper enums
      const mapOptions = {
        showsZoomControl: showControls,
        showsCompass: showControls
          ? window.mapkit.FeatureVisibility.Visible
          : window.mapkit.FeatureVisibility.Hidden,
        showsMapTypeControl: showControls,
        showsScale: showControls
          ? window.mapkit.FeatureVisibility.Visible
          : window.mapkit.FeatureVisibility.Hidden,
        isZoomEnabled: true,
        isRotationEnabled: true,
        mapType: "standard",
      };

      // Create map
      const map = new window.mapkit.Map(mapRef.current, mapOptions);
      mapInstance.current = map;

      // Set color scheme based on darkMode prop
      (map as mapkit.Map & { colorScheme: string }).colorScheme = darkMode
        ? "dark"
        : "light";

      // Set map position and zoom level
      const center = new window.mapkit.Coordinate(latitude, longitude);
      const span = new window.mapkit.CoordinateSpan(0.2 / zoom, 0.2 / zoom);
      const region = new window.mapkit.CoordinateRegion(center, span);

      // Apply padding if specified
      if (padding) {
        map.padding = new window.mapkit.Padding(
          padding.top || 0,
          padding.right || 0,
          padding.bottom || 0,
          padding.left || 0,
        );
      }

      // Add event listener for zoom changes
      map.addEventListener("region-change-end", () => {
        handleZoomChanged();
      });

      // Set the region - this is important for the Search API to work correctly
      map.setRegionAnimated(region);
      mapInitialized.current = true;

      // Call onMapInitialized callback if provided
      if (onMapInitialized && mapInstance.current) {
        onMapInitialized(mapInstance.current);
      }
    } catch (error) {
      console.error("Error initializing MapKit:", error);
    }
  }, [
    token,
    latitude,
    longitude,
    zoom,
    showControls,
    darkMode,
    padding,
    onMapInitialized,
  ]);

  // Track zoom level changes
  const handleZoomChanged = useCallback(() => {
    if (!mapInstance.current) return;

    // Calculate approximate zoom level from span
    const span = mapInstance.current.region.span;
    const newZoom = Math.log2(360 / span.longitudeDelta) - 1;

    // Only update if zoom has actually changed to avoid infinite loops
    if (Math.abs(currentZoom - newZoom) > 0.1) {
      setCurrentZoom(newZoom);
    }
  }, [currentZoom]);

  // Parse location from either PostGIS format "0101000020E6100000{hex coordinates}" or GeoJSON object
  const parseLocation = useCallback(
    (location: unknown): { lat: number; lng: number } | null => {
      if (!location) return null;

      if (typeof location === "string") {
        // Handle PostGIS WKB format
        if (location.startsWith("0101000020E6100000")) {
          try {
            // Convert hex to binary
            const hex = location.slice(18);
            const buffer = Buffer.from(hex, "hex");

            // Read double values for lng and lat
            const lng = buffer.readDoubleLE(0);
            const lat = buffer.readDoubleLE(8);

            return { lat, lng };
          } catch (e) {
            console.error("Error parsing WKB location:", e);
            return null;
          }
        }

        // Handle POINT(lng lat) format
        if (location.startsWith("POINT(")) {
          const coordsStr = location.substring(6, location.length - 1);
          const [lng, lat] = coordsStr.split(" ").map(Number);
          return Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng };
        }

        // Handle GeoJSON string
        try {
          const parsedLocation = JSON.parse(location);
          if (
            parsedLocation &&
            parsedLocation.type === "Point" &&
            Array.isArray(parsedLocation.coordinates) &&
            parsedLocation.coordinates.length >= 2
          ) {
            const [lng, lat] = parsedLocation.coordinates;
            return Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng };
          }
        } catch (e) {
          // Not valid JSON, ignore
        }
      }

      // Handle GeoJSON object
      if (
        typeof location === "object" &&
        location !== null &&
        "type" in location &&
        location.type === "Point" &&
        "coordinates" in location &&
        Array.isArray(location.coordinates) &&
        location.coordinates.length >= 2
      ) {
        const [lng, lat] = location.coordinates;
        return Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng };
      }

      console.warn("Unrecognized location format:", location);
      return null;
    },
    [],
  );

  // Format place data for subtitle with review info
  const formatPlaceSubtitle = useCallback((place: Place): string => {
    let subtitle = "";
    let googleData: { address?: string; neighborhood?: string } = {};

    try {
      if (place.google) {
        googleData = JSON.parse(place.google) as {
          address?: string;
          neighborhood?: string;
        };
      }
    } catch (e) {
      // Invalid JSON, ignore
    }

    // Add review information if available - show this first for prominence
    if (place.reviews && place.reviews.length > 0) {
      const avgRating =
        place.reviews.reduce((sum, review) => sum + Number(review.rating), 0) /
        place.reviews.length;

      // Use a more elegant rating display
      const ratingText = `★ ${avgRating.toFixed(1)}`;

      if (googleData?.address) {
        subtitle = `${ratingText} · ${googleData.address}`;
      } else {
        subtitle = `${ratingText} · ${place.reviews.length} ${place.reviews.length === 1 ? "review" : "reviews"}`;
      }

      return subtitle;
    }

    // If no reviews, just use the address
    if (googleData?.address) {
      subtitle += googleData.address;
    }

    if (place.phone) {
      if (subtitle) subtitle += " · ";
      subtitle += place.phone;
    }

    return subtitle;
  }, []);

  // Load the MapKit script
  useEffect(() => {
    if (!token || !mapRef.current) return;

    // If script is already loaded, initialize the map
    if (scriptLoaded.current) {
      if (!mapInitialized.current) {
        initializeMap();
      }
      return;
    }

    // Check if script already exists in the DOM
    const existingScript = document.querySelector(
      'script[src="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js"]',
    );

    if (existingScript) {
      scriptLoaded.current = true;
      initializeMap();
      return;
    }

    // Create and load MapKit JS script if not already loaded
    const script = document.createElement("script");
    script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
    script.async = true;

    script.onload = () => {
      scriptLoaded.current = true;
      initializeMap();
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script on unmount to prevent multiple script loads
      // This helps maintain a single MapKit instance throughout the app
    };
  }, [token, initializeMap]);

  // Handle property updates for dark mode
  useEffect(() => {
    if (
      mapInitialized.current &&
      window.mapkit &&
      mapRef.current &&
      mapInstance.current
    ) {
      try {
        const map = mapInstance.current;

        // Update color scheme
        (map as mapkit.Map & { colorScheme: string }).colorScheme = darkMode
          ? "dark"
          : "light";
      } catch (error) {
        console.error("Error updating map color scheme:", error);
      }
    }
  }, [darkMode]);

  // Add place annotations to the map
  useEffect(() => {
    if (!mapInstance.current || !window.mapkit || !showPlaces) {
      console.log("Map not ready or places not enabled");
      return;
    }

    if (!cachedPlaces || cachedPlaces.length === 0) {
      console.log("No places to show on map");
      return;
    }

    const placesKey = cachedPlaces.map((p) => p.id).join(",");
    if (placesKey === processedPlacesRef.current) {
      console.log("Places already processed, skipping annotation update");
      return;
    }

    processedPlacesRef.current = placesKey;
    console.log(`Adding ${cachedPlaces.length} places as annotations to map`);

    try {
      if (annotationsRef.current.length > 0) {
        console.log("Removing existing annotations");
        mapInstance.current.removeAnnotations(annotationsRef.current);
        annotationsRef.current = [];
      }

      const newAnnotations: MapKitAnnotation[] = cachedPlaces
        .map((place) => {
          const location = parseLocation(place.location);
          if (!location) {
            console.warn(
              `Invalid location for place "${place.name}":`,
              place.location,
            );
            return null;
          }

          console.log(`Creating annotation for place: ${place.name}`);
          const coordinate = new window.mapkit.Coordinate(
            location.lat,
            location.lng,
          );
          const subtitle = formatPlaceSubtitle(place);
          const hasReviews = place.reviews && place.reviews.length > 0;
          const avgRating = hasReviews
            ? (place.reviews || []).reduce(
                (sum, review) => sum + Number(review.rating),
                0,
              ) / (place.reviews?.length || 1)
            : 0;

          const markerColor = hasReviews
            ? avgRating >= 4.5
              ? "#4CAF50"
              : avgRating >= 3.5
                ? "#4361EE"
                : avgRating >= 2.5
                  ? "#FF9800"
                  : "#F44336"
            : "#00B4D8";

          const annotation = new window.mapkit.MarkerAnnotation(coordinate, {
            title: place.name,
            subtitle: subtitle || "Apartment",
            color: markerColor,
            glyphText: hasReviews ? "★" : "•",
            glyphColor: "#FFFFFF",
            selectedGlyphColor: "#FFFFFF",
            calloutEnabled: true,
            animates: true,
            data: place,
            visible: true,
            size: { width: 40, height: 50 },
            displayPriority: hasReviews ? 1000 : 900,
          });

          annotation.addEventListener("select", () => {
            console.log(`Selected place: ${place.name}`);
          });

          return annotation;
        })
        .filter(Boolean) as MapKitAnnotation[];

      if (newAnnotations.length > 0) {
        console.log(`Adding ${newAnnotations.length} new annotations to map`);
        mapInstance.current.addAnnotations(newAnnotations);
        annotationsRef.current = newAnnotations;
        console.log(
          `Successfully added ${newAnnotations.length} annotations to map`,
        );
      } else {
        console.warn("No valid places to add to map");
      }
    } catch (e) {
      console.error("Error adding places to map:", e);
    }
  }, [cachedPlaces, showPlaces, parseLocation, formatPlaceSubtitle]);

  // Function to fetch places based on current map bounds
  const fetchPlacesForCurrentBounds = useCallback(() => {
    if (!mapInstance.current) return;

    const region = mapInstance.current.region;
    const { center, span } = region;

    // Calculate the bounding box
    const northEast = {
      lat: center.latitude + span.latitudeDelta / 2,
      lng: center.longitude + span.longitudeDelta / 2,
    };
    const southWest = {
      lat: center.latitude - span.latitudeDelta / 2,
      lng: center.longitude - span.longitudeDelta / 2,
    };

    // Log the current zoom level and map bounds for debugging
    console.log(`Current zoom level: ${currentZoom}`);
    console.log(
      `Map viewport: NE(${northEast.lat.toFixed(5)}, ${northEast.lng.toFixed(5)}) SW(${southWest.lat.toFixed(5)}, ${southWest.lng.toFixed(5)})`,
    );

    // Call a function to fetch places within these bounds
    try {
      fetchPlacesWithinBounds(northEast, southWest, currentZoom);
    } catch (error) {
      console.error("Error in fetchPlacesForCurrentBounds:", error);
    }
  }, [fetchPlacesWithinBounds, currentZoom]);

  // Add event listener for region changes to fetch new places with improved handling
  useEffect(() => {
    if (!mapInstance.current) return;

    console.log("Setting up map region change listeners");

    // Using a throttled version of the handler
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttleDelay = 1000; // 1 second delay between fetches

    // Track map movements
    const handleRegionChangeEnd = () => {
      console.log("Map region changed - updating places");

      // Calculate approximate zoom level from span
      if (mapInstance.current) {
        const span = mapInstance.current.region.span;
        const newZoom = Math.log2(360 / span.longitudeDelta) - 1;
        setCurrentZoom(newZoom);
      }

      // Clear any pending timeout
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }

      // Set a new timeout to fetch places
      throttleTimeout = setTimeout(() => {
        fetchPlacesForCurrentBounds();
        throttleTimeout = null;
      }, throttleDelay);
    };

    // Add standard MapKit event listener for region changes
    try {
      mapInstance.current.addEventListener(
        "region-change-end",
        handleRegionChangeEnd,
      );
    } catch (e) {
      console.log("Standard region-change-end event listener not working:", e);

      // As a fallback, attempt to use a different approach to detect map movements
      const checkForMapMovement = () => {
        if (mapInstance.current) {
          // Periodically check if the map has moved and update if needed
          handleRegionChangeEnd();
          setTimeout(checkForMapMovement, 3000); // Check every 3 seconds as fallback
        }
      };

      // Start the fallback mechanism
      checkForMapMovement();
    }

    // Fetch places for the initial map view
    console.log("Initial map load - fetching places");
    fetchPlacesForCurrentBounds();

    return () => {
      if (mapInstance.current) {
        try {
          mapInstance.current.removeEventListener(
            "region-change-end",
            handleRegionChangeEnd,
          );
        } catch (e) {
          // Ignore errors from unsupported events
          console.log("Error removing event listener:", e);
        }
      }

      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [fetchPlacesForCurrentBounds]);

  // Toggle visibility of annotations based on zoom level
  useEffect(() => {
    if (!mapInstance.current || annotationsRef.current.length === 0) return;

    // Set visibility based on zoom level
    const isZoomedIn = currentZoom >= minZoomForAnnotations;

    try {
      // Log the zoom-based filtering
      console.log(
        `Zoom level ${currentZoom.toFixed(2)} - ${isZoomedIn ? "showing" : "hiding"} annotation details`,
      );

      // Apply different styles based on zoom level
      for (const annotation of annotationsRef.current) {
        // Always show the annotation but adjust details based on zoom
        if (isZoomedIn) {
          // At higher zoom levels, show full details
          // Keep the annotation's current subtitle - no change needed
          annotation.animates = true;
        } else {
          // At lower zoom levels, simplify for performance
          annotation.subtitle = "";
          annotation.animates = false;
        }
      }
    } catch (e) {
      console.error("Error updating annotations based on zoom:", e);
    }
  }, [currentZoom]);

  return (
    <div
      ref={mapRef}
      className={`${fullscreen ? "h-screen w-screen" : "h-[500px] w-full"} ${className}`}
      aria-label="Apple MapKit Map"
    />
  );
}
