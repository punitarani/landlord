"use client";

import { createSupabaseClient } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

type AuthState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
};

export function useSupabaseAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  });

  // Initialize Supabase client
  const supabase = createSupabaseClient();

  // Sign in anonymously
  const signInAnonymously = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Sign in anonymously
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        throw error;
      }

      setAuthState({
        user: data?.user || null,
        session: data?.session || null,
        isLoading: false,
        error: null,
      });

      return data;
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return null;
    }
  }, [supabase]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setAuthState({
        user: null,
        session: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [supabase]);

  // Get current session
  const getSession = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      setAuthState({
        user: data?.session?.user || null,
        session: data?.session || null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [supabase]);

  // Setup auth state listener
  useEffect(() => {
    // Get initial session
    getSession();

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthState({
        user: session?.user || null,
        session: session,
        isLoading: false,
        error: null,
      });
    });

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, getSession]);

  return {
    user: authState.user,
    session: authState.session,
    isLoading: authState.isLoading,
    error: authState.error,
    signInAnonymously,
    signOut,
    getSession,
  };
}
