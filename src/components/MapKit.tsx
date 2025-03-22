"use client";

import { useEffect, useRef } from "react";

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
    showsZoomControl: boolean;
    showsCompass: boolean;
    showsMapTypeControl: boolean;
    colorScheme: string;
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
};

export function MapKit({
  token,
  latitude = 37.7749, // San Francisco default
  longitude = -122.4194,
  zoom = 12,
  className = "",
  showControls = true,
  darkMode = false,
}: MapKitProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);

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

        // Set color scheme based on darkMode prop
        map.colorScheme = darkMode ? "dark" : "light";

        // Set map position and zoom level
        const center = new window.mapkit.Coordinate(latitude, longitude);
        const span = new window.mapkit.CoordinateSpan(0.2 / zoom, 0.2 / zoom);
        const region = new window.mapkit.CoordinateRegion(center, span);

        map.setRegionAnimated(region);
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

  return (
    <div
      ref={mapRef}
      className={`h-[500px] w-full rounded-lg ${className}`}
      aria-label="Apple MapKit Map"
    />
  );
}
