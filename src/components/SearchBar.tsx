"use client";

import type { CoordinateRegion } from "@/types/mapkit";
import { useCallback, useEffect, useRef, useState } from "react";

// Define our own SearchResult interface since we need to add an id field
interface SearchResult {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  displayLines: string[];
  id?: string; // Add id for better key handling
}

// Use a more specific type for the map instance using imported types
interface MapInstance {
  region: CoordinateRegion;
}

// Define simplified search results interface
interface SearchResults {
  results: SearchResult[];
}

interface SearchBarProps {
  onSearch: (searchResult: {
    coordinate: { latitude: number; longitude: number };
    displayLines: string[];
  }) => void;
  map?: MapInstance;
}

export function SearchBar({ onSearch, map }: SearchBarProps) {
  const [query, setQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to perform the search - memoized with useCallback
  const performSearch = useCallback(() => {
    if (!query || query.length <= 2 || !map || !window.mapkit) {
      return;
    }

    setIsSearching(true);

    try {
      // Create a new region from the map using proper types
      const centerCoord = map.region.center;
      const spanCoord = map.region.span;

      if (
        typeof centerCoord.latitude !== "number" ||
        typeof centerCoord.longitude !== "number" ||
        typeof spanCoord.latitudeDelta !== "number" ||
        typeof spanCoord.longitudeDelta !== "number"
      ) {
        setError("Invalid map region. Please try refreshing the page.");
        setIsSearching(false);
        return;
      }

      // Create proper MapKit objects using the API
      const newCenter = new window.mapkit.Coordinate(
        centerCoord.latitude,
        centerCoord.longitude,
      );

      const newSpan = new window.mapkit.CoordinateSpan(
        spanCoord.latitudeDelta,
        spanCoord.longitudeDelta,
      );

      const searchRegion = new window.mapkit.CoordinateRegion(
        newCenter,
        newSpan,
      );

      // Create a search instance with the proper region
      const search = new window.mapkit.Search({ region: searchRegion });

      // Perform the search using the autocomplete method
      search.autocomplete(
        query,
        (searchError: Error | null, data: SearchResults) => {
          setIsSearching(false);

          if (searchError) {
            console.error("Search error:", searchError);
            setError("An error occurred during search. Please try again.");
            return;
          }

          if (data?.results?.length > 0) {
            // Add IDs to the results for React list rendering
            const resultsWithIds = data.results.map(
              (result: SearchResult, index: number) => ({
                ...result,
                id: `result-${index}-${result.displayLines?.[0] || ""}`,
              }),
            );

            setSearchResults(resultsWithIds);
          } else {
            setSearchResults([]);
            if (query.length > 3) {
              setError("No results found. Try a different search term.");
            }
          }
        },
      );
    } catch (err) {
      console.error("MapKit search error:", err);
      setIsSearching(false);
      setError("Unable to perform search. Please try again later.");
    }
  }, [query, map]); // Only include query and map as dependencies

  // Effect to handle search when query changes
  useEffect(() => {
    // Reset error when query changes
    setError(null);

    // Clear results if query is too short
    if (query.length <= 2) {
      setSearchResults([]);
      return;
    }

    // Debounce search to avoid too many requests
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSearch = (result: SearchResult) => {
    if (result?.coordinate) {
      // Make sure we're passing the raw coordinate object with latitude and longitude
      onSearch({
        coordinate: {
          latitude: result.coordinate.latitude,
          longitude: result.coordinate.longitude,
        },
        // Pass through other properties if needed
        displayLines: result.displayLines,
      });

      setQuery("");
      setSearchResults([]);
    }
  };

  return (
    <div className="absolute top-4 left-0 right-0 z-10 mx-auto w-full max-w-md px-4">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a place..."
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search for locations"
        />

        {isSearching && (
          <div className="absolute right-3 top-2.5">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          </div>
        )}

        {error && query.length > 0 && (
          <div className="absolute mt-1 w-full rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-600 shadow-lg">
            {error}
          </div>
        )}

        {searchResults.length > 0 && !error && (
          <div className="absolute mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                className="w-full cursor-pointer p-3 text-left hover:bg-gray-100"
                onClick={() => handleSearch(result)}
              >
                <p className="font-medium">
                  {result.displayLines?.[0] || "Unknown place"}
                </p>
                {result.displayLines?.[1] && (
                  <p className="text-sm text-gray-600">
                    {result.displayLines[1]}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
