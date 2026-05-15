"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "@/components/dashboard-shell";
import { OnboardingShell } from "@/components/onboarding-shell";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Profile = {
  id: string;
  nickname: string;
  clan_id: string;
  total_distance_km: number;
  total_duration_seconds: number;
};

export function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const initialClient = getSupabaseBrowserClient();

    if (initialClient === null) {
      setIsLoading(false);
      return;
    }

    const client = initialClient;

    let isMounted = true;

    async function bootstrap() {
      const {
        data: { session: initialSession }
      } = await client.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(initialSession);

      if (initialSession?.user) {
        await loadProfile(initialSession);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    }

    async function createMissingProfile(activeSession: Session) {
      const user = activeSession.user;
      const nickname =
        typeof user.user_metadata.nickname === "string" && user.user_metadata.nickname.length > 0
          ? user.user_metadata.nickname
          : (user.email?.split("@")[0] ?? "runner");
      const clanId =
        typeof user.user_metadata.clan_id === "string" && user.user_metadata.clan_id.length > 0
          ? user.user_metadata.clan_id
          : "centre";
      const newProfile: Profile = {
        id: user.id,
        nickname,
        clan_id: clanId,
        total_distance_km: 0,
        total_duration_seconds: 0
      };

      return client.from("profiles").insert([newProfile] as never[]);
    }

    async function loadProfile(activeSession: Session) {
      setLoadError(null);
      setIsLoading(true);

      const { data, error } = await client
        .from("profiles")
        .select("id, nickname, clan_id, total_distance_km, total_duration_seconds")
        .eq("id", activeSession.user.id)
        .single();

      if (!isMounted) {
        return;
      }

      if (error) {
        if (error.code === "PGRST116") {
          const { error: createError } = await createMissingProfile(activeSession);

          if (!isMounted) {
            return;
          }

          if (!createError) {
            await loadProfile(activeSession);
            return;
          }

          setProfile(null);
          setLoadError("Le compte est connecte mais le profil Supabase n'a pas pu etre cree.");
          setIsLoading(false);
          return;
        }

        setProfile(null);
        setLoadError("Impossible de charger ton profil. Verifie que le SQL Supabase a bien ete execute.");
        setIsLoading(false);
        return;
      }

      setProfile(data);
      setIsLoading(false);
    }

    void bootstrap();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        void loadProfile(nextSession);
        return;
      }

      setProfile(null);
      setLoadError(null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }

  async function handleSaveRun(payload: { distanceKm: number; durationSeconds: number }) {
    const supabase = getSupabaseBrowserClient();

    if (!supabase || !session?.user || !profile) {
      return { error: "Session introuvable. Reconnecte-toi puis reessaie." };
    }

    const { error: runError } = await supabase.from("runs").insert([
      {
        user_id: session.user.id,
        clan_id: profile.clan_id,
        distance_km: payload.distanceKm,
        duration_seconds: payload.durationSeconds
      }
    ] as never[]);

    if (runError) {
      return { error: "Impossible d'enregistrer la course dans Supabase." };
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({
        total_distance_km: Number((Number(profile.total_distance_km) + payload.distanceKm).toFixed(2)),
        total_duration_seconds: profile.total_duration_seconds + payload.durationSeconds
      } as never)
      .eq("id", profile.id)
      .select("id, nickname, clan_id, total_distance_km, total_duration_seconds")
      .single();

    if (profileError) {
      return { error: "La course a ete creee, mais le total du profil n'a pas pu etre mis a jour." };
    }

    setProfile(updatedProfile);
    return { error: null };
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-black/5 bg-white/70 px-8 py-10 text-center shadow-card backdrop-blur-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-ink/45">VilleOfClans</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Chargement du camp</h1>
          <p className="mt-3 text-sm text-ink/68">Connexion au profil joueur en cours.</p>
        </div>
      </main>
    );
  }

  if (session?.user && profile) {
    return (
      <DashboardShell
        email={session.user.email ?? ""}
        profile={profile}
        onLogout={handleLogout}
        onSaveRun={handleSaveRun}
      />
    );
  }

  return <OnboardingShell loadError={loadError} />;
}
