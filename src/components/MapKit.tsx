"use client";

import { useCallback, useEffect, useRef } from "react";

// Define minimal MapKit types
declare global {
  interface Window {
    mapkit: {
      init: (options: {
        authorizationCallback: (done: (token: string) => void) => void;
        language?: string;
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
      Padding: new (
        top: number,
        right: number,
        bottom: number,
        left: number,
      ) => MapKitPadding;
      FeatureVisibility: {
        hidden: string;
        visible: string;
        adaptive: string;
      };
    };
  }

  interface MapKitOptions {
    showsZoomControl?: string;
    showsCompass?: string;
    showsMapTypeControl?: string;
    showsScale?: string;
    isZoomEnabled?: boolean;
    isRotationEnabled?: boolean;
    mapType?: string;
    padding?: MapKitPadding;
  }

  interface MapKitPadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }

  interface MapKitMap {
    setCenterAnimated: (center: MapKitCoordinate) => void;
    setRegionAnimated: (region: MapKitCoordinateRegion) => void;
    showsZoomControl: string;
    showsCompass: string;
    showsMapTypeControl: string;
    colorScheme: string;
    padding: MapKitPadding;
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
}

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
}: MapKitProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);
  const scriptLoaded = useRef(false);

  // Create the initializeMap function with useCallback
  const initializeMap = useCallback(() => {
    if (!mapRef.current || !token || !window.mapkit || mapInitialized.current)
      return;

    try {
      window.mapkit.init({
        authorizationCallback: (done) => done(token),
        language: "en",
      });

      // Configure map options with proper enums
      const featureVisibility = showControls
        ? window.mapkit.FeatureVisibility.visible
        : window.mapkit.FeatureVisibility.hidden;

      const mapOptions: MapKitOptions = {
        showsZoomControl: featureVisibility,
        showsCompass: featureVisibility,
        showsMapTypeControl: featureVisibility,
        showsScale: featureVisibility,
        isZoomEnabled: true,
        isRotationEnabled: true,
        mapType: "standard",
      };

      // Create map
      const map = new window.mapkit.Map(mapRef.current, mapOptions);

      // Set color scheme based on darkMode prop
      map.colorScheme = darkMode ? "dark" : "light";

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

      map.setRegionAnimated(region);
      mapInitialized.current = true;
    } catch (error) {
      console.error("Error initializing MapKit:", error);
    }
  }, [token, latitude, longitude, zoom, showControls, darkMode, padding]);

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
