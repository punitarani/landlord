/// <reference path="./index.d.ts" />

// Export specific types from the mapkit namespace
export interface Annotation extends mapkit.Annotation {}
export interface Coordinate extends mapkit.Coordinate {}
export interface CoordinateRegion extends mapkit.CoordinateRegion {}
export interface CoordinateSpan extends mapkit.CoordinateSpan {}
export interface MapKit extends mapkit.MapKit {}
export interface MapKitInitOptions extends mapkit.MapKitInitOptions {}
export interface Padding extends mapkit.Padding {}
export type FeatureVisibility = typeof mapkit.FeatureVisibility;
export interface Place extends mapkit.Place {}
export interface SearchAutocompleteResult
  extends mapkit.SearchAutocompleteResult {}

// Define a simplified map constructor options interface
export interface SimpleMapConstructorOptions {
  showsZoomControl?: boolean;
  showsCompass?: string;
  showsMapTypeControl?: boolean;
  showsScale?: string;
  isZoomEnabled?: boolean;
  isRotationEnabled?: boolean;
  mapType?: string;
}

// Define a simplified marker annotation options interface
export interface SimpleMarkerAnnotationOptions {
  color?: string;
  glyphText?: string;
  title?: string;
  subtitle?: string;
  animates?: boolean;
}

// Define Window interface with properly typed mapkit
declare global {
  interface Window {
    mapkit: {
      init(options: MapKitInitOptions): void;
      Map: new (
        parent: string | Element,
        options?: SimpleMapConstructorOptions,
      ) => MapKit;
      Coordinate: new (latitude: number, longitude: number) => Coordinate;
      CoordinateSpan: new (
        latitudeDelta: number,
        longitudeDelta: number,
      ) => CoordinateSpan;
      CoordinateRegion: new (
        center: Coordinate,
        span: CoordinateSpan,
      ) => CoordinateRegion;
      Padding: new (
        top?: number,
        right?: number,
        bottom?: number,
        left?: number,
      ) => Padding;
      MarkerAnnotation: new (
        coordinate: Coordinate,
        options?: SimpleMarkerAnnotationOptions,
      ) => Annotation;
      FeatureVisibility: {
        Adaptive: string;
        Hidden: string;
        Visible: string;
      };
    };
  }
}
