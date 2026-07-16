"use client";

import { useEffect, useState } from "react";
import { getStoredToken, loadCurrentUser, User } from "@/lib/api";

export function useCurrentUser() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (force = false) => {
      const token = getStoredToken();
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setAuthReady(true);
        }
        return;
      }
      try {
        const nextUser = await loadCurrentUser(force);
        if (!cancelled) setUser(nextUser);
      } catch {
        if (cancelled) return;
        setUser(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };

    void load();
    const onStorage = () => void load();
    const onAuthChange = () => void load();
    const onUserUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ force?: boolean }>).detail;
      void load(detail?.force === true);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("tourpie:auth", onAuthChange as EventListener);
    window.addEventListener("tourpie:user-updated", onUserUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tourpie:auth", onAuthChange as EventListener);
      window.removeEventListener("tourpie:user-updated", onUserUpdated as EventListener);
    };
  }, []);

  return {
    authReady,
    user,
    isLoggedIn: authReady && !!user,
  };
}
