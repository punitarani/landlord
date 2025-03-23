"use client";

import type { MapKit as MapKitMapType } from "@/types/mapkit";
import { useCallback, useEffect, useRef } from "react";

type MapKitProps = {
  token: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  className?: string;
  showControls?: boolean;
  darkMode?: boolean;
  fullscreen?: boolean;
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  onMapInitialized?: (map: MapKitMapType) => void;
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
  padding = { top: 0, right: 0, bottom: 0, left: 0 },
  onMapInitialized,
}: MapKitProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);
  const scriptLoaded = useRef(false);
  const mapInstance = useRef<MapKitMapType | null>(null);

  // Create the initializeMap function with useCallback
  const initializeMap = useCallback(() => {
    if (!mapRef.current || !token || !window.mapkit || mapInitialized.current)
      return;

    try {
      window.mapkit.init({
        authorizationCallback: (done: (token: string) => void) => done(token),
        language: "en",
      });

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
      (map as MapKitMapType & { colorScheme: string }).colorScheme = darkMode
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
      const scriptToRemove = document.querySelector(
        'script[src="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js"]',
      );
      if (scriptToRemove) document.head.removeChild(scriptToRemove);
    };
  }, [token, initializeMap]);

  // Handle property updates by resetting the map when props change
  useEffect(() => {
    if (mapInitialized.current && window.mapkit && mapRef.current) {
      mapInitialized.current = false;
      initializeMap();
    }
  }, [initializeMap]);

  return (
    <div
      ref={mapRef}
      className={`${fullscreen ? "h-screen w-screen" : "h-[500px] w-full"} ${className}`}
      aria-label="Apple MapKit Map"
    />
  );
}
