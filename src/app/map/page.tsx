"use client";

import { MapKit } from "@/components/MapKit";
import { useMapKitToken } from "@/hooks/use-mapkit-token";
import { useState } from "react";

export default function MapPage() {
  const { data, isPending, error } = useMapKitToken();
  const [darkMode, setDarkMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [location, setLocation] = useState<{
    name: string;
    lat: number;
    lng: number;
  }>({
    name: "San Francisco",
    lat: 37.7749,
    lng: -122.4194,
  });

  // List of predefined locations
  const locations = [
    { name: "San Francisco", lat: 37.7749, lng: -122.4194 },
    { name: "New York", lat: 40.7128, lng: -74.006 },
    { name: "London", lat: 51.5074, lng: -0.1278 },
    { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
    { name: "Sydney", lat: -33.8688, lng: 151.2093 },
  ];

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">MapKit JS Demo</h1>

      {isPending ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900" />
        </div>
      ) : error || !data?.token ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            MapKit Token Required
          </h2>
          <p className="text-amber-700 mb-4">
            {data?.error || "Please add your MapKit JS token to continue."}
          </p>
          <div className="bg-white rounded p-4 text-left overflow-auto font-mono text-sm">
            <p className="mb-2 font-medium">Setup Instructions:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Sign in to your{" "}
                <a
                  href="https://developer.apple.com/account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Apple Developer account
                </a>
              </li>
              <li>
                Go to <strong>Certificates, Identifiers & Profiles</strong> →{" "}
                <strong>Services</strong> → <strong>Maps</strong>
              </li>
              <li>
                Create a <strong>MapKit JS</strong> token (or use an existing
                one)
              </li>
              <li>
                Copy the token and add it to your{" "}
                <code className="bg-gray-100 px-1">.env.local</code> file:
                <pre className="mt-2 bg-gray-100 p-2 rounded text-xs">
                  NEXT_PUBLIC_MAPKIT_TOKEN="your_token_here"
                </pre>
              </li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-gray-50 p-4 rounded-lg flex flex-wrap gap-4">
            <div>
              <label
                htmlFor="location-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Location
              </label>
              <select
                id="location-select"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={location.name}
                onChange={(e) => {
                  const selected = locations.find(
                    (loc) => loc.name === e.target.value,
                  );
                  if (selected) setLocation(selected);
                }}
              >
                {locations.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end space-x-4">
              <div className="flex items-center">
                <input
                  id="dark-mode"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                />
                <label
                  htmlFor="dark-mode"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Dark Mode
                </label>
              </div>

              <div className="flex items-center">
                <input
                  id="show-controls"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={showControls}
                  onChange={(e) => setShowControls(e.target.checked)}
                />
                <label
                  htmlFor="show-controls"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Show Controls
                </label>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <MapKit
              token={data.token}
              latitude={location.lat}
              longitude={location.lng}
              zoom={12}
              darkMode={darkMode}
              showControls={showControls}
              className="h-[600px]"
            />
          </div>

          {/* Usage Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
            <h2 className="text-lg font-semibold mb-2">
              Current Configuration
            </h2>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
              {`<MapKit 
  token={mapkitToken}
  latitude={${location.lat}}
  longitude={${location.lng}}
  zoom={12}
  darkMode={${darkMode}}
  showControls={${showControls}}
/>`}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
