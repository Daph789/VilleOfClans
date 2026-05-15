"use client";

import { useMemo, useState } from "react";
import { lilleClans } from "@/lib/clans";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Mode = "signup" | "login";
type OverlayTone = "info" | "success" | "error";

const initialForm = {
  email: "",
  password: "",
  nickname: "",
  clanId: lilleClans[0].id
};

type OnboardingShellProps = {
  loadError?: string | null;
};

export function OnboardingShell({ loadError = null }: OnboardingShellProps) {
  const [mode, setMode] = useState<Mode>("signup");
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlay, setOverlay] = useState<{
    title: string;
    message: string;
    tone: OverlayTone;
  } | null>(null);

  const selectedClan = useMemo(
    () => lilleClans.find((clan) => clan.id === form.clanId) ?? lilleClans[0],
    [form.clanId]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOverlay(null);
    setIsSubmitting(true);

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setOverlay({
        title: "Configuration requise",
        message: "Ajoute tes cles Supabase dans .env.local pour activer l'authentification.",
        tone: "error"
      });
      setIsSubmitting(false);
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nickname: form.nickname,
            clan_id: form.clanId
          }
        }
      });

      const accountAlreadyExists = Boolean(
        data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
      );
      const isInstantlyConnected = Boolean(data.session);

      setOverlay(
        error
          ? {
              title: "Creation impossible",
              message:
                error.message === "email rate limit exceeded"
                  ? "Trop de demandes ont ete envoyees. Desactive la confirmation email dans Supabase pour passer en connexion rapide, ou attends avant de reessayer."
                  : error.message,
              tone: "error"
            }
          : isInstantlyConnected
            ? {
                title: "Compte cree",
                message: "Compte cree et connexion immediate activee.",
                tone: "success"
              }
          : accountAlreadyExists
            ? {
                title: "Compte deja existant",
                message: "Ce compte existe deja. Veuillez vous connecter.",
                tone: "info"
              }
          : {
              title: "Compte cree",
              message:
                "Verifie le mail envoye par Supabase, clique sur le lien de confirmation, puis reviens te connecter.",
              tone: "success"
            }
      );
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password
    });

    if (error?.message === "Email not confirmed") {
      setOverlay({
        title: "Confirmation requise",
        message: `Ouvre le mail envoye par Supabase a l'adresse ${form.email}, puis clique sur le lien de confirmation avant de revenir te connecter.`,
        tone: "info"
      });
      setIsSubmitting(false);
      return;
    }

    setOverlay(
      error
        ? {
            title: "Connexion impossible",
            message: error.message,
            tone: "error"
          }
        : {
            title: "Connexion reussie",
            message: "L'etape suivante sera le dashboard.",
            tone: "success"
          }
    );
    setIsSubmitting(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      {overlay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-black/10 bg-paper p-6 text-ink shadow-card sm:p-7">
            <div
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white ${
                overlay.tone === "success"
                  ? "bg-moss"
                  : overlay.tone === "error"
                    ? "bg-ink"
                    : "bg-ember"
              }`}
            >
              {overlay.title}
            </div>
            <h3 className="mt-4 text-2xl font-semibold">{overlay.title}</h3>
            <p className="mt-3 text-sm leading-7 text-ink/72">{overlay.message}</p>
            <button
              type="button"
              onClick={() => setOverlay(null)}
              className="mt-6 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:opacity-92"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid flex-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden rounded-[32px] bg-ink px-6 py-8 text-paper shadow-card sm:px-8 sm:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(242,106,46,0.36),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(216,183,136,0.22),_transparent_30%)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-paper/70">
                Lille saison 01
              </div>
              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
                  VilleOfClans transforme tes runs en guerre de quartiers.
                </h1>
                <p className="max-w-lg text-base leading-7 text-paper/78 sm:text-lg">
                  Choisis ton clan, accumule des kilomètres et fais grimper ton quartier en tête du classement hebdomadaire.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/12 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-paper/55">Objectif</p>
                <p className="mt-2 text-2xl font-semibold">Dominer Lille</p>
                <p className="mt-2 text-sm leading-6 text-paper/70">
                  Chaque run compte pour toi et pour ton quartier.
                </p>
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-paper/55">Format</p>
                <p className="mt-2 text-2xl font-semibold">10 clans</p>
                <p className="mt-2 text-sm leading-6 text-paper/70">
                  Classement hebdomadaire, reset régulier, rivalité locale.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-black/5 bg-white/70 p-5 shadow-card backdrop-blur-sm sm:p-7">
          {loadError ? (
            <div className="mb-5 rounded-3xl border border-[#11111112] bg-[#11111108] px-4 py-3 text-sm leading-6 text-ink/72">
              {loadError}
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-ink/45">Onboarding</p>
              <h2 className="mt-2 text-3xl font-semibold text-ink">Rejoins ton clan</h2>
            </div>
            <div className="rounded-full bg-moss px-3 py-1 text-xs font-medium text-white">
              {mode === "signup" ? "Création" : "Connexion"}
            </div>
          </div>

          <div className="mt-6 inline-flex rounded-full bg-black/5 p-1">
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "signup" ? "bg-ink text-paper" : "text-ink/65"
              }`}
              type="button"
              onClick={() => setMode("signup")}
            >
              S&apos;inscrire
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "login" ? "bg-ink text-paper" : "text-ink/65"
              }`}
              type="button"
              onClick={() => setMode("login")}
            >
              Se connecter
            </button>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5">
              {mode === "signup" ? (
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">Pseudo</span>
                  <input
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-ink"
                    placeholder="Ex: NonoDuVieuxLille"
                    value={form.nickname}
                    onChange={(event) => setForm({ ...form, nickname: event.target.value })}
                    required
                  />
                </label>
              ) : null}

              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Email</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-ink"
                  type="email"
                  placeholder="toi@villeofclans.com"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Mot de passe</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-ink"
                  type="password"
                  placeholder="Minimum 6 caractères"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                />
              </label>
            </div>

            {mode === "signup" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">Choisis ton quartier</span>
                  <span className="text-sm text-ink/55">Obligatoire</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {lilleClans.map((clan) => {
                    const isActive = clan.id === form.clanId;

                    return (
                      <button
                        key={clan.id}
                        type="button"
                        onClick={() => setForm({ ...form, clanId: clan.id })}
                        className={`rounded-3xl border p-4 text-left transition ${
                          isActive
                            ? "border-transparent bg-ink text-paper shadow-lg"
                            : "border-black/10 bg-white hover:border-black/25"
                        }`}
                        style={{
                          boxShadow: isActive ? `inset 0 0 0 1px ${clan.accent}` : undefined
                        }}
                      >
                        <div
                          className="mb-4 h-2 w-16 rounded-full"
                          style={{ backgroundColor: clan.accent }}
                        />
                        <p className="font-semibold">{clan.name}</p>
                        <p className={`mt-1 text-sm ${isActive ? "text-paper/72" : "text-ink/62"}`}>
                          {clan.tagline}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div
              className="rounded-3xl p-4"
              style={{ backgroundColor: `${selectedClan.accent}18`, border: `1px solid ${selectedClan.accent}50` }}
            >
              <p className="text-sm uppercase tracking-[0.2em] text-ink/50">Clan sélectionné</p>
              <div className="mt-2 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold text-ink">{selectedClan.name}</p>
                  <p className="text-sm text-ink/68">{selectedClan.tagline}</p>
                </div>
                <div
                  className="h-12 w-12 rounded-2xl"
                  style={{ backgroundColor: selectedClan.accent }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-ember px-4 py-4 text-base font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Envoi en cours..."
                : mode === "signup"
                  ? "Créer mon compte"
                  : "Accéder à mon espace"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
