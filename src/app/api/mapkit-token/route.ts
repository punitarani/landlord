import { NextResponse } from "next/server";

/**
 * Simple API route for MapKit JWT token generation
 *
 * To make this work, you need to:
 * 1. Run: `bun add jsonwebtoken @types/jsonwebtoken`
 * 2. Set up environment variables:
 *    - APPLE_TEAM_ID
 *    - MAPKIT_KEY_ID
 *    - MAPKIT_PRIVATE_KEY
 */
export async function GET() {
  // Currently returns a placeholder response
  // This would be replaced with actual token generation when you set up credentials
  return NextResponse.json(
    {
      message: "MapKit token service not configured yet",
      setup: [
        "Run: bun add jsonwebtoken @types/jsonwebtoken",
        "Add your Apple Developer credentials to .env",
      ],
    },
    {
      status: 501, // Not Implemented
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/* 
// Working implementation (uncomment when ready):

import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";

export async function GET() {
  try {
    // Get credentials from environment variables
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.MAPKIT_KEY_ID;
    const privateKey = process.env.MAPKIT_PRIVATE_KEY;
    
    if (!teamId || !keyId || !privateKey) {
      return NextResponse.json(
        { error: "MapKit credentials missing" }, 
        { status: 500 }
      );
    }
    
    // Generate JWT token
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        iss: teamId,
        iat: now,
        exp: now + 3600, // 1 hour expiration
        origin: [process.env.NEXT_PUBLIC_SITE_URL || "localhost"]
      },
      privateKey,
      {
        algorithm: "ES256",
        header: {
          alg: "ES256",
          kid: keyId,
          typ: "JWT"
        }
      }
    );
    
    return NextResponse.json(
      { token },
      { 
        status: 200,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Error generating MapKit token:", error);
    return NextResponse.json(
      { error: "Token generation failed" },
      { status: 500 }
    );
  }
}
*/
