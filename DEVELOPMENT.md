# Development Guide

This document provides development guidelines and technical details for the Landlord application, a maps-based application built with Next.js, MapKit and Supabase.

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Authentication](#authentication)
- [MapKit Integration](#mapkit-integration)
- [Data Management](#data-management)
- [UI Components](#ui-components)
- [Performance Optimizations](#performance-optimizations)
- [Known Issues and Solutions](#known-issues-and-solutions)

## Project Overview

This is a Next.js application with App Router written in TypeScript using Bun as the package manager. It features a fullscreen map interface with authentication and dynamic data loading capabilities.

### Key Features

- Fullscreen map interface with MapKit JS
- Anonymous authentication with Supabase
- Dynamic place loading and annotation
- Data caching with IndexedDB
- Responsive UI with Tailwind CSS and shadcn components

## Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Package Manager**: Bun
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL with PostGIS
- **Map Service**: Apple MapKit JS
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Query (TanStack Query)
- **Local Storage**: IndexedDB

## Authentication

The application uses Supabase for anonymous authentication, allowing users to interact with the application without explicitly signing up.

### Authentication Flow

1. `AuthProvider` wraps the application in `providers.tsx`
2. On page load, `page.tsx` checks for existing user session
3. If no session exists, anonymous sign-in is triggered automatically
4. User ID is maintained across page reloads and used for data operations

### Implementation Details

- `useSupabaseAuth` hook handles authentication state and operations
- `AuthContext` provides authentication state to the entire application
- Anonymous sign-in is performed on initial page load
- Session management is handled through Supabase cookies

### Setup Instructions

1. Create a Supabase project
2. Set up the following environment variables in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## MapKit Integration

The application uses Apple MapKit JS for interactive map functionality with dynamic place annotations.

### Features

- Fullscreen MapKit JS integration
- Dynamic fetching of places based on map viewport
- Intelligent caching of map data using IndexedDB
- Annotations for places with rating-based coloring
- Zoom-dependent annotation density and details

### Components

- `MapKit.tsx` - A React component that renders an Apple MapKit map with fullscreen support
- `useMapKitToken.ts` - A TanStack Query hook for fetching the MapKit token

### Setup Options

#### Option 1: Direct Token (Recommended for Development)

1. Sign in to your [Apple Developer account](https://developer.apple.com/account)
2. Go to **Certificates, Identifiers & Profiles** → **Services** → **Maps**
3. Select or create a new MapKit JS token
4. Copy the token value
5. Add to your `.env.local` file

> **Note:** Using a direct token without origin restriction will show a warning in the browser console. This is fine for development but not for production.

#### Option 2: Dynamic Token Generation (Required for Production)

For production environments:

1. Install required packages:
   ```bash
   bun add jsonwebtoken @types/jsonwebtoken
   ```

2. In your Apple Developer account:
   - Generate a private key for MapKit JS
   - Configure Maps IDs with specific domains
   - Download your private key

3. Create a `.env.local` file with your Maps ID and private key

4. Set up the token generation API route in `src/app/api/mapkit-token/route.ts`

### Usage

The MapKit component accepts the following props:

```typescript
type MapKitProps = {
  token: string;         // JWT token from Apple
  latitude?: number;     // Default: 37.7749 (San Francisco)
  longitude?: number;    // Default: -122.4194
  zoom?: number;         // Default: 12
  className?: string;    // Additional CSS classes
  showControls?: boolean; // Default: false
  darkMode?: boolean;    // Default: true
  fullscreen?: boolean;  // Default: false - when true, map takes up the entire viewport
  showPlaces?: boolean;  // Default: true - show place annotations on the map
  cachedPlaces?: Place[]; // Places to show as annotations
  onMapInitialized?: (map: mapkit.Map) => void; // Callback when map is initialized
  padding?: {            // Optional map padding
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
};
```

## Data Management

The application uses Supabase as its primary data source and implements a caching layer with IndexedDB for improved performance.

### Data Models

- **Places**: Geographical locations with associated metadata
  - Table: `Place`
  - Columns: id, name, location (PostGIS), google, website, phone
  
- **Reviews**: User reviews for places
  - Table: `Reviews`
  - Columns: id, place_id, rating, created_at, updated_at, comment, user_id

### Data Flow

1. `useCachedPlaces` hook manages the data layer
2. First fetch attempts to retrieve data from IndexedDB cache
3. If cache is invalid or empty, data is fetched from Supabase
4. As the map viewport changes, new data is loaded for the visible area
5. Optimization logic limits the number of places shown based on zoom level

### Location Data Handling

- Supports multiple PostGIS geometry formats
- Parses and normalizes points, coordinates, and GeoJSON structures
- Converts database geometries to MapKit coordinates

### Map Annotation Features

1. Places are displayed as annotations on the map
2. Color-coding based on average review ratings:
   - 4.5+ stars: Green
   - 3.5-4.4 stars: Blue
   - 2.5-3.4 stars: Orange
   - Below 2.5: Red
   - No reviews: Light blue
3. Annotation detail level adjusts based on zoom level
4. Dynamic loading as user pans around the map

## UI Components

The application uses a combination of Tailwind CSS and shadcn/ui for styling and components.

### Layout Structure

- `layout.tsx` - Main application layout with font loading and providers
- `providers.tsx` - React Query and Auth providers
- `page.tsx` - Home page with authentication check

### Key Components

- `HomeView` - Main view component that renders the map and search interface
- `MapKit` - Core map component with annotation support
- Various shadcn/ui components for UI elements

## Performance Optimizations

### Caching Strategy

- Map data is cached in IndexedDB for offline access and performance
- Cache invalidation based on configurable timeout (default: 60 minutes)
- Background data refreshing while showing cached data

### Map Rendering Optimizations

- Dynamic annotation loading based on map viewport
- Throttled viewport change events to prevent excessive network requests
- Prioritization of places with reviews on lower zoom levels
- Limitation of total annotations based on zoom level

## Known Issues and Solutions

### MapKit JS Issues

1. **Feature Visibility Errors:**
   - MapKit requires specific enum values for feature visibility (not boolean values)
   - Use `mapkit.FeatureVisibility.visible` or `mapkit.FeatureVisibility.hidden`

2. **Padding Issues:**
   - Padding must be created using `new mapkit.Padding(top, right, bottom, left)`
   - Don't pass plain JavaScript objects for padding

3. **Initialization Errors:**
   - Only initialize MapKit once after the script loads
   - Clean up script element on component unmount

4. **Location Parsing:**
   - Handle multiple PostGIS geometry formats
   - Support for point, coordinates, and GeoJSON structures
