"use client";

import { useEffect, useState } from "react";
import { api, clearSessionToken, getStoredToken, isAuthErrorMessage, User } from "@/lib/api";

export function useCurrentUser() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = getStoredToken();
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setAuthReady(true);
        }
        return;
      }

      if (!cancelled) setAuthReady(true);

      try {
        const nextUser = await api.auth.me();
        if (!cancelled) setUser(nextUser);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "";
        if (isAuthErrorMessage(message)) {
          clearSessionToken();
        }
        setUser(null);
      }
    };

    void load();
    const onChange = () => void load();
    window.addEventListener("storage", onChange);
    window.addEventListener("tourpie:auth", onChange as EventListener);
    window.addEventListener("tourpie:user-updated", onChange as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onChange);
      window.removeEventListener("tourpie:auth", onChange as EventListener);
      window.removeEventListener("tourpie:user-updated", onChange as EventListener);
    };
  }, []);

  return {
    authReady,
    user,
    isLoggedIn: authReady && !!user,
  };
}
