import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import type { AppRole } from "@/lib/uz";

type Profile = {
  id: string;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  agency_name: string | null;
  bio: string | null;
  rating: number;
  reviews_count: number;
  deals_count: number;
  is_verified_agent: boolean;
  is_blocked: boolean;
  premium_until: string | null;
  device_id: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  roles: AppRole[];
  isAgent: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  isPremium: boolean;
  refresh: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const until = (query.state.data as Profile | null | undefined)?.premium_until;
      return until && new Date(until).getTime() > Date.now() ? false : 10000;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, phone, full_name, avatar_url, agency_name, bio, rating, reviews_count, deals_count, is_verified_agent, is_blocked, premium_until, device_id",
        )
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.role as AppRole);
    },
  });

  // Bitta hisob — bitta qurilma: boshqa qurilmada ochilgan sessiya darhol yopiladi.
  useEffect(() => {
    if (!profile?.device_id) return;
    const deviceId = getDeviceId();
    if (!deviceId || deviceId === profile.device_id) return;
    void supabase.auth.signOut().then(() => {
      queryClient.clear();
      if (typeof window !== "undefined") window.location.replace("/auth?device=blocked");
    });
  }, [profile?.device_id, queryClient]);

  const roleList = roles ?? [];
  const isStaff = roleList.includes("admin") || roleList.includes("super_admin");
  const premiumUntil = profile?.premium_until ? new Date(profile.premium_until).getTime() : 0;

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    profile: profile ?? null,
    roles: roleList,
    isAgent: roleList.includes("agent") || isStaff,
    isStaff,
    isSuperAdmin: roleList.includes("super_admin"),
    isPremium: premiumUntil > Date.now(),
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["roles", userId] });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return context;
}
