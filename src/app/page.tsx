"use client";

import { MapKit } from "@/components/MapKit";
import { SearchBar } from "@/components/SearchBar";
import HomeView from "@/components/views/HomeView";
import { useMapKitToken } from "@/hooks/use-mapkit-token";
import { useRef, useState } from "react";

export default function Home() {
  return <HomeView />;
}
