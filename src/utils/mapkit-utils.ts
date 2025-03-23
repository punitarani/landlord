/**
 * Utility functions for Apple MapKit JS
 */

/**
 * Creates fresh MapKit objects using the current window.mapkit instance
 */
export function createFreshMapKitObjects(
  latitude: number,
  longitude: number,
  zoomLevel = 0.01,
) {
  if (!window.mapkit) return null;

  try {
    // Create objects using the current mapkit instance
    const coordinate = new window.mapkit.Coordinate(latitude, longitude);
    const span = new window.mapkit.CoordinateSpan(zoomLevel, zoomLevel);
    const region = new window.mapkit.CoordinateRegion(coordinate, span);

    return { coordinate, span, region };
  } catch (error) {
    return null;
  }
}

/**
 * Validates that an object is a valid MapKit Map instance
 */
export function isValidMapInstance(obj: unknown): obj is mapkit.Map {
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
    const region = mapObj.region as mapkit.CoordinateRegion;
    if (!region.center || !region.span) {
      return false;
    }

    // Validate center has required latitude and longitude properties
    const center = region.center as mapkit.Coordinate;
    if (
      typeof center.latitude !== "number" ||
      typeof center.longitude !== "number"
    ) {
      return false;
    }

    // Validate span has required latitudeDelta and longitudeDelta properties
    const span = region.span as mapkit.CoordinateSpan;
    if (
      typeof span.latitudeDelta !== "number" ||
      typeof span.longitudeDelta !== "number"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Determines if a search result is a place with a name rather than just coordinates
 */
export function isPlace(displayLines?: string[]): boolean {
  // If no display lines or empty first line, it's not a named place
  if (!displayLines || !displayLines.length || !displayLines[0]?.trim()) {
    return false;
  }

  // If the first line contains something that looks like coordinates, it's probably not a named place
  const firstLine = displayLines[0];
  const coordRegex = /^\s*[\d.-]+\s*[,°]\s*[\d.-]+\s*$/;
  if (coordRegex.test(firstLine)) {
    return false;
  }

  return true;
}

/**
 * Adds an annotation to a MapKit map at the specified coordinates
 */
export function addAnnotationToMap(
  mapInstance: mapkit.Map,
  latitude: number,
  longitude: number,
  options?: {
    color?: string;
    title?: string;
    subtitle?: string;
    animates?: boolean;
    displayLines?: string[];
  },
) {
  if (!window.mapkit) return false;

  try {
    const defaultOptions = {
      color: "#c969e0",
      title: "Search Result",
      animates: true,
    };

    // Determine if this is a place with a name
    const displayLines = options?.displayLines;
    const hasPlaceName = isPlace(displayLines);

    // If it's not a place with a name and no title was explicitly provided, return without adding annotation
    if (!hasPlaceName && !options?.title) {
      return false;
    }

    // Clear existing annotations first
    if (mapInstance.annotations && mapInstance.annotations.length > 0) {
      if (typeof mapInstance.removeAnnotations === "function") {
        mapInstance.removeAnnotations(mapInstance.annotations);
      }
    }

    // Create fresh coordinate for the marker
    const mapKitObjects = createFreshMapKitObjects(latitude, longitude);
    if (!mapKitObjects) return false;

    // Use the first line of displayLines as the title if available and not explicitly provided
    const title =
      options?.title ||
      (hasPlaceName ? displayLines?.[0] : defaultOptions.title);

    // Use the second line of displayLines as subtitle if available
    const subtitle =
      options?.subtitle ||
      (displayLines && displayLines.length > 1 ? displayLines[1] : undefined);

    // Create marker annotation with dynamically determined properties
    const markerOptions = {
      ...defaultOptions,
      ...options,
      title,
      subtitle,
    };

    // Create the annotation using the native MapKit API
    const annotation = new window.mapkit.MarkerAnnotation(
      mapKitObjects.coordinate,
      markerOptions,
    );

    // First try using showItems method (preferred by Apple examples)
    if (typeof mapInstance.showItems === "function") {
      try {
        mapInstance.showItems([annotation]);
        return true;
      } catch {
        // Fall back to addAnnotation if needed
        if (typeof mapInstance.addAnnotation === "function") {
          mapInstance.addAnnotation(annotation);
          return true;
        }
      }
    }
    // Fallback directly to addAnnotation
    else if (typeof mapInstance.addAnnotation === "function") {
      mapInstance.addAnnotation(annotation);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
