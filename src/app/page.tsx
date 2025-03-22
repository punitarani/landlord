"use client";

import { MapKit } from "@/components/MapKit";
import { useMapKitToken } from "@/hooks/use-mapkit-token";

export default function Home() {
  const { data, isPending, error } = useMapKitToken();

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
    <MapKit
      token={data.token}
      fullscreen={true}
      showControls={false}
      className="rounded-none"
    />
  );
}
