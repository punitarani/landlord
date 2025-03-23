"use client";

import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import type { Session, User } from "@supabase/supabase-js";
import { type ReactNode, createContext, useContext } from "react";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
  signInAnonymously: () => Promise<{
    user: User | null;
    session: Session | null;
  } | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useSupabaseAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
