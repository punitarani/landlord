# MapKit JS Integration

This project includes a simple Apple MapKit JS integration using React and TanStack Query.

## Components

- `MapKit.tsx` - A React component that renders an Apple MapKit map
- `useMapKitToken.ts` - A TanStack Query hook for fetching the MapKit token
- `/map` - A page demonstrating the MapKit implementation

## Setup Instructions

### Option 1: Direct Token (Recommended)

1. Sign in to your [Apple Developer account](https://developer.apple.com/account)
2. Go to **Certificates, Identifiers & Profiles** → **Services** → **Maps**
3. Select or create a new MapKit JS token
4. Copy the token value
5. Create a `.env.local` file in your project root using `.env.example`

### Option 2: Dynamic Token Generation (Advanced)

If you need to generate tokens dynamically (for production use):

1. Install required packages:
   ```bash
   bun add jsonwebtoken @types/jsonwebtoken
   ```

2. Generate a private key for MapKit JS in your Apple Developer account

3. Create a `.env.local` file using

4. Uncomment the implementation in `src/app/api/mapkit-token/route.ts`

## Usage

The MapKit component accepts the following props:

```typescript
type MapKitProps = {
  token: string;         // JWT token from Apple
  latitude?: number;     // Default: 37.7749 (San Francisco)
  longitude?: number;    // Default: -122.4194
  className?: string;    // Additional CSS classes
};
```

Example usage:

```jsx
import { MapKit } from "@/components/MapKit";
import { useMapKitToken } from "@/hooks/use-mapkit-token";

export default function MyMap() {
  const { data } = useMapKitToken();
  
  if (!data?.token) return <div>Loading map...</div>;
  
  return (
    <MapKit 
      token={data.token}
      latitude={40.7128}  // New York City
      longitude={-74.0060}
      className="my-8 shadow-lg"
    />
  );
}
``` 