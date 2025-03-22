# MapKit JS Maps App

This project is a fullscreen maps application using Apple MapKit JS with React and Next.js.

## Components

- `MapKit.tsx` - A React component that renders an Apple MapKit map with fullscreen support
- `useMapKitToken.ts` - A TanStack Query hook for fetching the MapKit token
- `/` - The main application page showing a fullscreen map

## Setup Instructions

### Option 1: Direct Token (Recommended for Development)

1. Sign in to your [Apple Developer account](https://developer.apple.com/account)
2. Go to **Certificates, Identifiers & Profiles** → **Services** → **Maps**
3. Select or create a new MapKit JS token
4. Copy the token value
5. Create a `.env.local` file in your project root using `.env.example`

> **Note:** Using a direct token without origin restriction will show a warning in the browser console: "[MapKit] Authorization token without origin restriction is not recommended in production environments". This is fine for development but for production, use Option 2 below.

### Option 2: Dynamic Token Generation (Required for Production)

For production environments, you should restrict your MapKit JS token to specific domains and generate tokens dynamically:

1. Install required packages:
   ```bash
   bun add jsonwebtoken @types/jsonwebtoken
   ```

2. In your Apple Developer account:
   - Generate a private key for MapKit JS
   - Configure Maps IDs with specific domains
   - Download your private key

3. Create a `.env.local` file using `.env.example` and add your Maps ID and private key

4. Set up the token generation API route in `src/app/api/mapkit-token/route.ts`

## Technical Details

### Fixing Common MapKit JS Issues

1. **Feature Visibility Errors:**
   - MapKit requires specific enum values for feature visibility (not boolean values)
   - Use `mapkit.FeatureVisibility.visible` or `mapkit.FeatureVisibility.hidden`

2. **Padding Issues:**
   - Padding must be created using `new mapkit.Padding(top, right, bottom, left)`
   - Don't pass plain JavaScript objects for padding

3. **Initialization Errors:**
   - Only initialize MapKit once after the script loads
   - Clean up script element on component unmount

## Usage

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
  padding?: {            // Optional map padding
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
};
```

Example usage for a fullscreen map:

```jsx
import { MapKit } from "@/components/MapKit";
import { useMapKitToken } from "@/hooks/use-mapkit-token";

export default function MapApp() {
  const { data } = useMapKitToken();
  
  if (!data?.token) return <div>Loading map...</div>;
  
  return (
    <MapKit 
      token={data.token}
      fullscreen={true}
      showControls={false}
      className="rounded-none"
    />
  );
}
``` 