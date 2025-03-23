import { MapKit } from "@/components/MapKit";
import { SearchBar } from "@/components/SearchBar";
import { useAuth } from "@/contexts/auth-context";
import { useCachedPlaces } from "@/hooks/use-cached-places";
import { useMapKitToken } from "@/hooks/use-mapkit-token";
import {
  addAnnotationToMap,
  createFreshMapKitObjects,
  isPlace,
  isValidMapInstance,
} from "@/utils/mapkit-utils";
import type { FC } from "react";
import { useEffect, useRef, useState } from "react";

// Add a declaration for window.mapkit
declare global {
  interface Window {
    mapkit: typeof mapkit;
  }
}

// SearchResult interface matching the one in SearchBar
interface SearchResult {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  displayLines: string[];
  id?: string;
  name?: string;
  phone?: string;
  url?: string;
  formattedAddress?: string;
  postalCode?: string;
  countryCode?: string;
}

const HomeView: FC = () => {
  const { data, isPending, error: mapKitError } = useMapKitToken();
  const [mapInstance, setMapInstance] = useState<mapkit.Map | null>(null);
  const mapInitializedRef = useRef(false);
  const { user, isLoading: isAuthLoading } = useAuth();

  // Fetch cached places data
  const {
    places,
    loading: placesLoading,
    error: placesError,
    refreshData,
    isCached,
    isFetchingFresh,
  } = useCachedPlaces();

  // Function to handle search and move the map to the result
  const handleSearch = (searchResult: SearchResult) => {
    if (!mapInstance || !window.mapkit) return;

    try {
      const { latitude, longitude } = searchResult.coordinate;

      // Create fresh MapKit objects
      const mapKitObjects = createFreshMapKitObjects(latitude, longitude);

      if (!mapKitObjects) return;

      // Use the freshly created objects to update the map
      try {
        // Update the map to center on the selected location
        mapInstance.setRegionAnimated(mapKitObjects.region);

        // Only add annotation if it's a place with a name, not just coordinates
        if (isPlace(searchResult.displayLines)) {
          // Prepare additional annotation options
          const annotationOptions = {
            displayLines: searchResult.displayLines,
            // Use the name property if available, otherwise fall back to first display line
            title: searchResult.name || searchResult.displayLines[0],
            // Use formatted address or second display line as subtitle
            subtitle:
              searchResult.formattedAddress ||
              (searchResult.displayLines.length > 1
                ? searchResult.displayLines[1]
                : undefined),
          };

          addAnnotationToMap(
            mapInstance,
            latitude,
            longitude,
            annotationOptions,
          );
        }
      } catch (err) {
        // As a fallback, try direct property access
        try {
          // Access the map's internal region property directly
          const mapRegion = mapInstance.region;
          if (mapRegion?.center) {
            // Update center properties directly
            mapRegion.center.latitude = latitude;
            mapRegion.center.longitude = longitude;

            // Force a region update
            mapInstance.region = mapRegion;

            // Try to add annotation again if it's a place
            if (isPlace(searchResult.displayLines)) {
              addAnnotationToMap(mapInstance, latitude, longitude, {
                displayLines: searchResult.displayLines,
                title: searchResult.name || searchResult.displayLines[0],
              });
            }
          }
        } catch {
          // Silently fail - we've tried our best
        }
      }
    } catch {
      // Silently fail - we've tried our best
    }
  };

  // Handler for map initialization that prevents multiple initializations
  const handleMapInitialized = (map: mapkit.Map) => {
    if (!mapInitializedRef.current) {
      if (isValidMapInstance(map)) {
        mapInitializedRef.current = true;
        setMapInstance(map);
      }
    }
  };

  // Handle refresh data click
  const handleRefreshData = () => {
    refreshData();
  };

  // Log when places change to aid debugging
  useEffect(() => {
    if (places && places.length > 0) {
      console.log(
        `HomeView: Received ${places.length} places to display on map`,
      );
      console.log("Sample place data:", places[0]);
    } else {
      console.log("HomeView: No places data received");
    }
  }, [places]);

  // Show loading state for map
  if (isPending || isAuthLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-zinc-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-100" />
      </div>
    );
  }

  // Show error state for map
  if (mapKitError || !data?.token) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center max-w-md">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            Error Loading Map
          </h2>
          <p className="text-amber-700">
            {mapKitError?.message || "Failed to load MapKit token"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      <MapKit
        token={data.token}
        fullscreen={true}
        showControls={true}
        className="rounded-none"
        onMapInitialized={handleMapInitialized}
        showPlaces={true}
        cachedPlaces={places}
        latitude={37.7749} // Default to San Francisco
        longitude={-122.4194}
        zoom={10} // Slightly zoomed out to see more of the city
      />

      {/* Custom SearchBar - positioned to match original spacing on non-mobile */}
      <div className="absolute top-6 left-0 right-0 z-20 mx-auto w-full max-w-md px-4">
        {mapInstance && <SearchBar map={mapInstance} onSearch={handleSearch} />}
      </div>

      {/* Places loading indicator */}
      {placesLoading && (
        <div className="absolute top-16 right-4 z-20 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg">
          <span className="flex items-center text-sm text-gray-700">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-labelledby="loadingSpinnerTitle"
            >
              <title id="loadingSpinnerTitle">Loading...</title>
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading places...
          </span>
        </div>
      )}
    </div>
  );
};

export default HomeView;
