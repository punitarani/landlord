"use client";

import { MapKit } from "@/components/MapKit";
import { SearchBar } from "@/components/SearchBar";
import { useMapKitToken } from "@/hooks/use-mapkit-token";
import type {
  Annotation,
  Coordinate,
  CoordinateRegion,
  CoordinateSpan,
  MapKit as MapKitType,
} from "@/types/mapkit";
import { useRef, useState } from "react";

// Define more specific types for our MapKit implementation
// We use simplified interfaces that match what our component expects

// Use a simplified interface for the map instance that includes only the methods we need
interface MapInstance {
  setCenterAnimated: (coordinate: Coordinate) => void;
  setRegionAnimated: (region: CoordinateRegion) => void;
  removeAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  showItems?: (items: Array<Annotation>) => void;
  annotations: Annotation[];
  region: CoordinateRegion;
  center: Coordinate;
}

export default function Home() {
  const { data, isPending, error } = useMapKitToken();
  const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
  const mapInitializedRef = useRef(false);

  // Function to handle search and move the map to the result
  const handleSearch = (searchResult: {
    coordinate: { latitude: number; longitude: number };
    displayLines: string[];
  }) => {
    if (!mapInstance || !window.mapkit) return;

    try {
      const { latitude, longitude } = searchResult.coordinate;

      // Create coordinates and region similar to how it's done in MapKit.tsx
      try {
        // Create a proper Coordinate object using the MapKit API
        const center = new window.mapkit.Coordinate(latitude, longitude);

        // Use a smaller span value for closer zoom on search results
        const span = new window.mapkit.CoordinateSpan(0.01, 0.01);
        const region = new window.mapkit.CoordinateRegion(center, span);

        // Set the map region using the properly created region object
        mapInstance.setRegionAnimated(region);

        // Only add annotation after successfully centering the map
        addAnnotationToMap(latitude, longitude);
      } catch (err) {
        console.error("Failed to set region:", err);

        try {
          // Create a proper Coordinate object for setting the center directly
          const coordinate = new window.mapkit.Coordinate(latitude, longitude);

          // Set the center directly using the coordinate
          mapInstance.setCenterAnimated(coordinate);

          // Only add annotation after successfully centering the map
          addAnnotationToMap(latitude, longitude);
        } catch (centerErr) {
          console.error("Failed to set center:", centerErr);
        }
      }
    } catch (error) {
      console.error("Error handling search result:", error);
    }
  };

  // Helper function to add an annotation to the map
  const addAnnotationToMap = (latitude: number, longitude: number) => {
    if (!mapInstance || !window.mapkit) return;

    try {
      // Clear existing annotations first
      if (mapInstance.annotations && mapInstance.annotations.length > 0) {
        if (typeof mapInstance.removeAnnotations === "function") {
          mapInstance.removeAnnotations(mapInstance.annotations);
        }
      }

      // Create coordinate for the marker
      const coordinate = new window.mapkit.Coordinate(latitude, longitude);

      // Create a simple marker annotation with minimal properties
      const markerOptions = {
        color: "#c969e0",
        title: "Search Result",
        // Add a property that might help the annotation be recognized properly
        animates: true,
      };

      // Create the annotation using the native MapKit API
      const annotation = new window.mapkit.MarkerAnnotation(
        coordinate,
        markerOptions,
      );

      // First try using showItems method (preferred by Apple examples)
      if (typeof mapInstance.showItems === "function") {
        // Use a wrapper that should cast the object properly
        const wrapForShowItems = (items: Array<Annotation>) => {
          // Just forward the array but let MapKit handle the type conversions
          return mapInstance.showItems?.(items);
        };

        try {
          wrapForShowItems([annotation]);
          console.log("Successfully added annotation using showItems");
        } catch (showErr) {
          console.error("Error using showItems:", showErr);

          // Fall back to addAnnotation if needed
          if (typeof mapInstance.addAnnotation === "function") {
            mapInstance.addAnnotation(annotation);
            console.log("Successfully added annotation using addAnnotation");
          }
        }
      }
      // Fallback directly to addAnnotation
      else if (typeof mapInstance.addAnnotation === "function") {
        mapInstance.addAnnotation(annotation);
        console.log("Successfully added annotation using addAnnotation");
      } else {
        console.error("No method available to add annotations to the map");
        console.log(
          "Available methods:",
          Object.getOwnPropertyNames(mapInstance),
        );
      }
    } catch (err) {
      console.error("Failed to add annotation:", err);
    }
  };

  // Helper function to validate the structure of a map object
  const isValidMapInstance = (obj: unknown): obj is MapInstance => {
    if (!obj || typeof obj !== "object") return false;

    const mapObj = obj as Record<string, unknown>;

    // Check for required methods and properties
    if (
      typeof mapObj.setCenterAnimated !== "function" ||
      typeof mapObj.setRegionAnimated !== "function" ||
      !mapObj.region
    ) {
      return false;
    }

    try {
      // Validate region is a CoordinateRegion
      const region = mapObj.region as CoordinateRegion;
      if (!region.center || !region.span) {
        return false;
      }

      // Validate center has required latitude and longitude properties
      const center = region.center as Coordinate;
      if (
        typeof center.latitude !== "number" ||
        typeof center.longitude !== "number"
      ) {
        return false;
      }

      // Validate span has required latitudeDelta and longitudeDelta properties
      const span = region.span as CoordinateSpan;
      if (
        typeof span.latitudeDelta !== "number" ||
        typeof span.longitudeDelta !== "number"
      ) {
        return false;
      }

      return true;
    } catch (e) {
      console.error("Error validating map instance:", e);
      return false;
    }
  };

  // Handler for map initialization that prevents multiple initializations
  const handleMapInitialized = (map: unknown) => {
    if (!mapInitializedRef.current) {
      if (isValidMapInstance(map)) {
        mapInitializedRef.current = true;

        // Log the map region for debugging
        console.log("Map initialized with region:", map.region);

        // Set the map instance
        setMapInstance(map);
      } else {
        console.error(
          "Map initialized with invalid instance or missing region properties",
        );
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
            MapKit Token Required
          </h2>
          <p className="text-amber-700">
            {data?.error || "Please add your MapKit JS token to continue."}
          </p>
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
}
