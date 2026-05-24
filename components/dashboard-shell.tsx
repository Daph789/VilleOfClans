"use client";

import { useEffect, useRef, useState } from "react";
import { lilleClans } from "@/lib/clans";

type Profile = {
  id: string;
  nickname: string;
  clan_id: string;
  total_distance_km: number;
  total_duration_seconds: number;
};

type DashboardShellProps = {
  email: string;
  profile: Profile;
  onLogout: () => Promise<void>;
  onSaveRun: (payload: { distanceKm: number; durationSeconds: number }) => Promise<{
    error: string | null;
  }>;
};

type GeoPoint = {
  latitude: number;
  longitude: number;
};

type GeoSample = GeoPoint & {
  timestamp: number;
  accuracy: number;
};

type OverlayState = {
  title: string;
  message: string;
  tone: "warning" | "error" | "success";
  countdownSeconds?: number;
  dismissible?: boolean;
};

type ToastState = {
  title: string;
  message: string;
};

type TrackingPhase = "idle" | "arming" | "active" | "paused";
type SegmentKind = "valid" | "short" | "slow" | "overspeed" | "bad_accuracy";

const GPS_ACCURACY_THRESHOLD_METERS = 20;
const MIN_VALID_SPEED_KMH = 4;
const MAX_VALID_SPEED_KMH = 25;
const MIN_SEGMENT_DISTANCE_METERS = 7;
const INVALID_GRACE_PERIOD_SECONDS = 60;
const START_CONFIRMATION_SEGMENTS = 2;
const INVALID_CONFIRMATION_SEGMENTS = 2;
const OVERSPEED_CONFIRMATION_SEGMENTS = 2;
const GPS_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000
};

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes} min`;
}

function formatTimer(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceInKm(start: GeoPoint, end: GeoPoint) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(end.latitude - start.latitude);
  const deltaLon = toRadians(end.longitude - start.longitude);
  const startLat = toRadians(start.latitude);
  const endLat = toRadians(end.latitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function buildInvalidMessage(reason: string, remaining: number) {
  return `${reason} La course sera annulee dans ${remaining} seconde${remaining > 1 ? "s" : ""} si aucun mouvement valide n'est detecte.`;
}

export function DashboardShell({ email, profile, onLogout, onSaveRun }: DashboardShellProps) {
  const clan = lilleClans.find((item) => item.id === profile.clan_id);
  const [isRunning, setIsRunning] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveDistanceKm, setLiveDistanceKm] = useState(0);
  const [isSavingRun, setIsSavingRun] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("Pret a lancer le suivi GPS.");
  const [runFeedback, setRunFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [resumeToast, setResumeToast] = useState<ToastState | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSampleRef = useRef<GeoSample | null>(null);
  const phaseRef = useRef<TrackingPhase>("idle");
  const invalidReasonRef = useRef<string | null>(null);
  const invalidSinceRef = useRef<number | null>(null);
  const invalidTimeoutRef = useRef<number | null>(null);
  const invalidCountdownIntervalRef = useRef<number | null>(null);
  const consecutiveValidSegmentsRef = useRef(0);
  const consecutiveInvalidSegmentsRef = useRef(0);
  const consecutiveOverspeedSegmentsRef = useRef(0);
  const cancelRunRef = useRef<(message: string) => Promise<void>>(async () => {});

  useEffect(() => {
    if (!isTimerActive) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isTimerActive]);

  useEffect(() => {
    if (!resumeToast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setResumeToast(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [resumeToast]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      if (invalidTimeoutRef.current !== null) {
        window.clearTimeout(invalidTimeoutRef.current);
      }

      if (invalidCountdownIntervalRef.current !== null) {
        window.clearInterval(invalidCountdownIntervalRef.current);
      }
    };
  }, []);

  function clearInvalidTimers() {
    if (invalidTimeoutRef.current !== null) {
      window.clearTimeout(invalidTimeoutRef.current);
      invalidTimeoutRef.current = null;
    }

    if (invalidCountdownIntervalRef.current !== null) {
      window.clearInterval(invalidCountdownIntervalRef.current);
      invalidCountdownIntervalRef.current = null;
    }
  }

  function resetTrackingState() {
    setIsRunning(false);
    setIsTimerActive(false);
    setElapsedSeconds(0);
    setLiveDistanceKm(0);
    setGpsStatus("Pret a lancer le suivi GPS.");
    setIsSavingRun(false);
    setOverlay(null);
    setResumeToast(null);
    phaseRef.current = "idle";
    lastSampleRef.current = null;
    invalidReasonRef.current = null;
    invalidSinceRef.current = null;
    consecutiveValidSegmentsRef.current = 0;
    consecutiveInvalidSegmentsRef.current = 0;
    consecutiveOverspeedSegmentsRef.current = 0;
    clearInvalidTimers();

    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  function clearInvalidWindow() {
    const hadInvalidWindow = invalidSinceRef.current !== null || invalidReasonRef.current !== null;

    invalidReasonRef.current = null;
    invalidSinceRef.current = null;
    consecutiveInvalidSegmentsRef.current = 0;
    clearInvalidTimers();
    setOverlay((current) => (current?.tone === "warning" ? null : current));

    if (hadInvalidWindow) {
      setResumeToast({
        title: "Signal GPS retrouve",
        message: "Chrono relance"
      });
    }
  }

  function startInvalidWindow(reason: string, status: string) {
    invalidReasonRef.current = reason;
    setIsTimerActive(false);
    phaseRef.current = "paused";
    setGpsStatus(status);

    if (invalidSinceRef.current !== null) {
      return;
    }

    invalidSinceRef.current = Date.now();
    setOverlay({
      title: "Mouvement invalide detecte",
      message: buildInvalidMessage(reason, INVALID_GRACE_PERIOD_SECONDS),
      tone: "warning",
      countdownSeconds: INVALID_GRACE_PERIOD_SECONDS,
      dismissible: false
    });

    invalidTimeoutRef.current = window.setTimeout(() => {
      invalidTimeoutRef.current = null;
      void cancelRunRef.current(
        "Course annulee automatiquement : trop longtemps sans mouvement valide ou avec un signal GPS invalide."
      );
    }, INVALID_GRACE_PERIOD_SECONDS * 1000);

    invalidCountdownIntervalRef.current = window.setInterval(() => {
      if (invalidSinceRef.current === null || invalidReasonRef.current === null) {
        return;
      }

      const elapsed = Math.floor((Date.now() - invalidSinceRef.current) / 1000);
      const remaining = Math.max(0, INVALID_GRACE_PERIOD_SECONDS - elapsed);

      setOverlay({
        title: "Mouvement invalide detecte",
        message: buildInvalidMessage(invalidReasonRef.current, remaining),
        tone: "warning",
        countdownSeconds: remaining,
        dismissible: false
      });

      if (remaining === 0 && invalidCountdownIntervalRef.current !== null) {
        window.clearInterval(invalidCountdownIntervalRef.current);
        invalidCountdownIntervalRef.current = null;
      }
    }, 1000);
  }

  async function cancelRun(message: string) {
    resetTrackingState();
    setRunFeedback({
      tone: "error",
      message
    });
    setOverlay({
      title: "Course coupee",
      message,
      tone: "error",
      dismissible: true
    });
  }

  cancelRunRef.current = cancelRun;

  function classifySegment(sample: GeoSample, previous: GeoSample) {
    const elapsedBetweenSamplesSeconds = (sample.timestamp - previous.timestamp) / 1000;

    if (sample.accuracy > GPS_ACCURACY_THRESHOLD_METERS) {
      return {
        kind: "bad_accuracy" as SegmentKind,
        distanceKm: 0,
        distanceMeters: 0,
        speedKmh: 0
      };
    }

    if (elapsedBetweenSamplesSeconds <= 0) {
      return {
        kind: "short" as SegmentKind,
        distanceKm: 0,
        distanceMeters: 0,
        speedKmh: 0
      };
    }

    const distanceKm = haversineDistanceInKm(previous, sample);
    const distanceMeters = distanceKm * 1000;
    const speedKmh = distanceKm / (elapsedBetweenSamplesSeconds / 3600);

    if (distanceMeters <= MIN_SEGMENT_DISTANCE_METERS) {
      return {
        kind: "short" as SegmentKind,
        distanceKm,
        distanceMeters,
        speedKmh
      };
    }

    if (speedKmh < MIN_VALID_SPEED_KMH) {
      return {
        kind: "slow" as SegmentKind,
        distanceKm,
        distanceMeters,
        speedKmh
      };
    }

    if (speedKmh > MAX_VALID_SPEED_KMH) {
      return {
        kind: "overspeed" as SegmentKind,
        distanceKm,
        distanceMeters,
        speedKmh
      };
    }

    return {
      kind: "valid" as SegmentKind,
      distanceKm,
      distanceMeters,
      speedKmh
    };
  }

  function handleValidSegment(sample: GeoSample, speedKmh: number, distanceKm: number) {
    consecutiveInvalidSegmentsRef.current = 0;
    consecutiveOverspeedSegmentsRef.current = 0;
    lastSampleRef.current = sample;

    if (phaseRef.current === "active") {
      setIsTimerActive(true);
      setGpsStatus(
        `GPS actif • precision ${Math.round(sample.accuracy)} m • ${speedKmh.toFixed(1)} km/h`
      );
      setLiveDistanceKm((current) => Number((current + distanceKm).toFixed(4)));
      return;
    }

    consecutiveValidSegmentsRef.current += 1;

    if (phaseRef.current === "paused") {
      if (consecutiveValidSegmentsRef.current === 1) {
        setGpsStatus("Mouvement valide detecte • confirmation en cours...");
        return;
      }

      clearInvalidWindow();
    } else if (phaseRef.current === "arming" && consecutiveValidSegmentsRef.current === 1) {
      setGpsStatus("Mouvement detecte • confirmation GPS en cours...");
      return;
    }

    phaseRef.current = "active";
    setIsTimerActive(true);
    setGpsStatus(
      `GPS actif • precision ${Math.round(sample.accuracy)} m • ${speedKmh.toFixed(1)} km/h`
    );

    if (phaseRef.current === "active" && consecutiveValidSegmentsRef.current >= START_CONFIRMATION_SEGMENTS) {
      setLiveDistanceKm((current) => Number((current + distanceKm).toFixed(4)));
    }
  }

  function handleInvalidSegment(sample: GeoSample, kind: SegmentKind, speedKmh: number, distanceMeters: number) {
    lastSampleRef.current = sample;
    consecutiveValidSegmentsRef.current = 0;

    if (kind === "overspeed") {
      consecutiveOverspeedSegmentsRef.current += 1;
      if (consecutiveOverspeedSegmentsRef.current >= OVERSPEED_CONFIRMATION_SEGMENTS) {
        void cancelRun(
          `Vitesse anormale detectee (${speedKmh.toFixed(1)} km/h). L'enregistrement est bloque pour eviter la triche en vehicule.`
        );
        return;
      }

      setGpsStatus(`Pic GPS suspect ignore • ${speedKmh.toFixed(1)} km/h`);
      return;
    }

    consecutiveOverspeedSegmentsRef.current = 0;

    if (kind === "short" && phaseRef.current === "active") {
      setGpsStatus(
        `GPS actif • segment court ignore (${Math.round(distanceMeters)} m) • precision ${Math.round(sample.accuracy)} m`
      );
      return;
    }

    consecutiveInvalidSegmentsRef.current += 1;

    if (consecutiveInvalidSegmentsRef.current < INVALID_CONFIRMATION_SEGMENTS) {
      setGpsStatus("Verification du mouvement...");
      return;
    }

    if (kind === "bad_accuracy") {
      startInvalidWindow(
        `Signal GPS trop imprecis (${Math.round(sample.accuracy)} m).`,
        `Signal GPS faible • precision ${Math.round(sample.accuracy)} m`
      );
      return;
    }

    if (kind === "short") {
      startInvalidWindow(
        "Aucun deplacement reel n'a ete detecte.",
        `Surplace detecte • segment trop court (${Math.round(distanceMeters)} m)`
      );
      return;
    }

    if (kind === "slow") {
      startInvalidWindow(
        `Vitesse trop faible (${speedKmh.toFixed(1)} km/h).`,
        `Chrono en pause • vitesse ${speedKmh.toFixed(1)} km/h`
      );
    }
  }

  function handleStartRun() {
    if (!("geolocation" in navigator)) {
      setOverlay({
        title: "Geolocalisation indisponible",
        message: "La geolocalisation n'est pas disponible sur cet appareil.",
        tone: "error",
        dismissible: true
      });
      return;
    }

    resetTrackingState();
    setRunFeedback(null);
    setOverlay(null);
    setIsRunning(true);
    phaseRef.current = "arming";
    setGpsStatus("Recherche du signal GPS haute precision...");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const sample: GeoSample = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy
        };

        if (!lastSampleRef.current) {
          if (sample.accuracy > GPS_ACCURACY_THRESHOLD_METERS) {
            setGpsStatus(`Signal GPS faible • precision ${Math.round(sample.accuracy)} m`);
            return;
          }

          lastSampleRef.current = sample;
          setGpsStatus(`Premier point GPS valide • precision ${Math.round(sample.accuracy)} m`);
          return;
        }

        const segment = classifySegment(sample, lastSampleRef.current);

        if (segment.kind === "valid") {
          handleValidSegment(sample, segment.speedKmh, segment.distanceKm);
          return;
        }

        handleInvalidSegment(sample, segment.kind, segment.speedKmh, segment.distanceMeters);
      },
      (error) => {
        void cancelRun(
          error.code === error.PERMISSION_DENIED
            ? "Autorise la localisation dans ton navigateur pour lancer une course."
            : "Le suivi GPS a echoue. Verifie ton signal puis reessaie."
        );
      },
      GPS_WATCH_OPTIONS
    );
  }

  async function handleStopRun() {
    if (!isRunning) {
      return;
    }

    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsRunning(false);
    setIsTimerActive(false);
    clearInvalidWindow();
    phaseRef.current = "idle";
    setGpsStatus("Course arretee.");

    if (liveDistanceKm <= 0) {
      setRunFeedback({
        tone: "error",
        message: "Aucune distance valide n'a ete mesuree par le GPS."
      });
      return;
    }

    if (elapsedSeconds <= 0) {
      setRunFeedback({
        tone: "error",
        message: "Aucun temps de course valide n'a ete mesure."
      });
      return;
    }

    setIsSavingRun(true);
    setRunFeedback(null);
    setOverlay(null);

    const { error } = await onSaveRun({
      distanceKm: Number(liveDistanceKm.toFixed(2)),
      durationSeconds: elapsedSeconds
    });

    if (error) {
      setRunFeedback({
        tone: "error",
        message: error
      });
      setIsSavingRun(false);
      return;
    }

    setRunFeedback({
      tone: "success",
      message: "Course enregistree. Les kilometres ont ete ajoutes a ton profil et a ton clan."
    });
    setOverlay({
      title: "Course validee",
      message: "La course a ete sauvegardee avec les filtres anti-triche actifs.",
      tone: "success",
      dismissible: true
    });
    resetTrackingState();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      {overlay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-black/10 bg-paper p-6 text-ink shadow-card sm:p-7">
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
            {typeof overlay.countdownSeconds === "number" ? (
              <p className="mt-4 text-3xl font-semibold text-ink">{overlay.countdownSeconds}s</p>
            ) : null}
            {overlay.dismissible ? (
              <button
                type="button"
                onClick={() => setOverlay(null)}
                className="mt-6 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:opacity-92"
              >
                Fermer
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {resumeToast ? (
        <div className="fixed right-4 top-4 z-50 w-[min(92vw,420px)] rounded-[24px] border border-[#1f5c4b33] bg-paper p-4 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">{resumeToast.title}</p>
              <p className="mt-2 text-sm leading-6 text-ink/72">{resumeToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setResumeToast(null)}
              className="rounded-full border border-black/10 px-3 py-1 text-sm text-ink/72 transition hover:border-black/25"
              aria-label="Fermer la notification"
            >
              x
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[32px] bg-ink px-6 py-8 text-paper shadow-card sm:px-8 sm:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(242,106,46,0.30),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(216,183,136,0.24),_transparent_32%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-paper/70">
                Dashboard joueur
              </div>
              <div className="space-y-3">
                <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
                  {profile.nickname}, ton clan pousse pour prendre Lille.
                </h1>
                <p className="max-w-xl text-base leading-7 text-paper/78 sm:text-lg">
                  Ton prochain run renforcera directement <span className="font-semibold text-white">{clan?.name ?? "ton quartier"}</span>.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/12 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-paper/55">Clan</p>
                <p className="mt-2 text-2xl font-semibold">{clan?.name ?? profile.clan_id}</p>
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-paper/55">Distance totale</p>
                <p className="mt-2 text-2xl font-semibold">{Number(profile.total_distance_km).toFixed(1)} km</p>
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-paper/55">Temps cumule</p>
                <p className="mt-2 text-2xl font-semibold">{formatDuration(profile.total_duration_seconds)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-black/5 bg-white/70 p-6 shadow-card backdrop-blur-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-ink/45">Profil</p>
                <h2 className="mt-2 text-3xl font-semibold text-ink">Pret a courir</h2>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-ink transition hover:border-black/25"
              >
                Deconnexion
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-3xl bg-black/[0.04] p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-ink/45">Pseudo</p>
                <p className="mt-2 text-lg font-semibold text-ink">{profile.nickname}</p>
              </div>
              <div className="rounded-3xl bg-black/[0.04] p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-ink/45">Email</p>
                <p className="mt-2 text-lg font-semibold text-ink">{email}</p>
              </div>
              <div
                className="rounded-3xl p-4"
                style={{
                  backgroundColor: `${clan?.accent ?? "#111111"}18`,
                  border: `1px solid ${(clan?.accent ?? "#111111")}40`
                }}
              >
                <p className="text-sm uppercase tracking-[0.2em] text-ink/45">Clan actif</p>
                <p className="mt-2 text-lg font-semibold text-ink">{clan?.name ?? profile.clan_id}</p>
                <p className="mt-1 text-sm text-ink/68">{clan?.tagline ?? "Ton quartier est pret pour la semaine."}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-black/5 bg-white/70 p-6 shadow-card backdrop-blur-sm sm:p-7">
            <p className="text-sm uppercase tracking-[0.2em] text-ink/45">Course</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Lancer un run GPS</h3>

            <div className="mt-5 rounded-[28px] bg-ink p-5 text-paper">
              <p className="text-sm uppercase tracking-[0.2em] text-paper/55">Chrono valide</p>
              <p className="mt-3 text-5xl font-semibold tracking-tight">{formatTimer(elapsedSeconds)}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{liveDistanceKm.toFixed(2)} km</p>
              <p className="mt-3 text-sm leading-6 text-paper/72">
                Le chrono ne demarre qu&apos;apres confirmation du mouvement et se met en pause si le signal ou le rythme deviennent invalides.
              </p>
              <p className="mt-3 text-sm leading-6 text-paper/60">{gpsStatus}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-paper/45">
                Haute precision activee • cache interdit • vitesse valide entre {MIN_VALID_SPEED_KMH} et {MAX_VALID_SPEED_KMH} km/h • segment minimum {MIN_SEGMENT_DISTANCE_METERS} m
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={handleStartRun}
                  disabled={isRunning || isSavingRun}
                  className="flex-1 rounded-2xl bg-ember px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => void handleStopRun()}
                  disabled={!isRunning || isSavingRun}
                  className="flex-1 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-paper transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingRun ? "Enregistrement..." : "Stop"}
                </button>
              </div>
            </div>

            {runFeedback ? (
              <div
                className={`mt-5 rounded-3xl px-4 py-3 text-sm leading-6 ${
                  runFeedback.tone === "success"
                    ? "border border-[#1f5c4b33] bg-[#1f5c4b12] text-ink"
                    : "border border-[#11111112] bg-[#11111108] text-ink"
                }`}
              >
                {runFeedback.message}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
