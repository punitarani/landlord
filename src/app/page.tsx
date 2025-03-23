"use client";

import { MapKit } from "@/components/MapKit";
import { useState } from "react";

export default function HomePage() {
  const [showApartments, setShowApartments] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // San Francisco city center coordinates
  const latitude = 37.7749; // Centered on San Francisco
  const longitude = -122.4194; // Centered on San Francisco

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">San Francisco Apartments</h1>

      <div className="w-full max-w-4xl mb-4 flex justify-between">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showApartments}
              onChange={(e) => setShowApartments(e.target.checked)}
              className="rounded"
            />
            <span>Show Apartments</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="rounded"
            />
            <span>Dark Mode</span>
          </label>
        </div>

        <div className="text-sm text-gray-500">Zoom in to see apartments</div>
      </div>

      <div className="w-full max-w-4xl">
        <MapKit
          token={process.env.NEXT_PUBLIC_MAPKIT_TOKEN || ""}
          latitude={latitude}
          longitude={longitude}
          zoom={12} // Reduced zoom to show more of the city
          showControls={true}
          darkMode={darkMode}
          showPlaces={showApartments}
          className="rounded-lg shadow-lg h-[70vh]"
        />
      </div>

      <p className="mt-4 text-center text-gray-600 text-sm">
        Zoom in and click on apartment markers to see details
      </p>
    </main>
  );
}
