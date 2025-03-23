import { MapKit } from "@/components/MapKit";
import { SearchBar } from "@/components/SearchBar";
import { useMapKitToken } from "@/hooks/use-mapkit-token";
import {
  addAnnotationToMap,
  createFreshMapKitObjects,
  isPlace,
  isValidMapInstance,
} from "@/utils/mapkit-utils";
import type { FC } from "react";
import { useRef, useState } from "react";

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
  const { data, isPending, error } = useMapKitToken();
  const [mapInstance, setMapInstance] = useState<mapkit.Map | null>(null);
  const mapInitializedRef = useRef(false);

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

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error || !data?.token) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center max-w-md">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            Error Loading Map
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <MapKit
        token={data.token}
        fullscreen={true}
        showControls={true}
        className="rounded-none"
        onMapInitialized={handleMapInitialized}
      />
      {mapInstance && <SearchBar map={mapInstance} onSearch={handleSearch} />}
    </div>
  );
};

export default HomeView;
