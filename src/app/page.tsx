"use client";

import HomeView from "@/components/views/HomeView";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";

export default function Home() {
  const { user, isLoading: authLoading, signInAnonymously } = useAuth();

  // Handle anonymous authentication on component mount
  useEffect(() => {
    // Auto sign in if no user is logged in
    const handleAnonymousAuth = async () => {
      if (!user && !authLoading) {
        try {
          const authData = await signInAnonymously();
          if (authData?.user) {
            console.log("Anonymous user signed in:", authData.user.id);
          }
        } catch (error) {
          console.error("Failed to sign in anonymously:", error);
        }
      } else if (user) {
        console.log("User already authenticated:", user.id);
      }
    };

    handleAnonymousAuth();
  }, [user, authLoading, signInAnonymously]);

  return <HomeView />;
}
