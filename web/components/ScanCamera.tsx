"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Square } from "lucide-react";

interface Props {
  onCapture: (file: File) => void;
  busy?: boolean;
}

export default function ScanCamera({ onCapture, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e: any) {
      setError(e.message || "Camera unavailable");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }
  useEffect(() => () => stop(), []);

  function snap() {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (b) onCapture(new File([b], `note-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="card space-y-4">
      {/* Viewport */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-gov-navy-deep">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

        {/* Idle placeholder */}
        {!active && !busy && (
          <div className="absolute inset-0 grid place-items-center text-fg-tertiary text-sm">
            <div className="rounded-md bg-canvas px-4 py-3 border border-token shadow-sm">
              Camera off — start preview, or upload an image
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {busy && <ScanningOverlay />}

        {/* Frame guide */}
        <div className="pointer-events-none absolute inset-6 rounded-sm border-2 border-dashed border-white/30" />

        {/* Corner brackets */}
        <CornerBrackets active={!!busy} />
      </div>

      {error && <p className="help error">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!active ? (
          <button className="btn btn-primary" onClick={start} disabled={busy}>
            <Camera className="h-4 w-4" /> Start camera
          </button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={snap} disabled={busy}>
              <Camera className="h-4 w-4" />
              {busy ? "Analysing…" : "Capture"}
            </button>
            <button className="btn btn-secondary" onClick={stop} disabled={busy}>
              <Square className="h-4 w-4" /> Stop
            </button>
          </>
        )}

        <label className={`btn btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          <Upload className="h-4 w-4" /> Upload image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCapture(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

/* ── Scanning overlay — minimal, professional ────────────────────────────── */
function ScanningOverlay() {
  const [step, setStep] = useState(0);
  const steps = ["Reading text & symbols", "Analyzing color profile", "Checking texture & print", "Computing verdict"];

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % steps.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @keyframes vc-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes vc-step-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vc-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .vc-spinner      { animation: vc-spin 1s linear infinite; }
        .vc-step-label   { animation: vc-step-in 0.25s ease-out both; }
        .vc-shimmer-bar  { animation: vc-shimmer 1.8s ease-in-out infinite; }
      `}</style>

      {/* Clean dark overlay — no blur */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,24,52,0.82)" }} />

      {/* Centre content */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 18, pointerEvents: "none",
      }}>

        {/* Thin arc spinner — like iOS activity indicator */}
        <svg className="vc-spinner" width="44" height="44" viewBox="0 0 44 44" fill="none">
          {/* Track */}
          <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
          {/* Arc — 240° of the circle */}
          <circle
            cx="22" cy="22" r="18"
            stroke="rgba(255,188,120,0.95)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="75 38"
            strokeDashoffset="0"
          />
        </svg>

        {/* Step label — fades in on each step */}
        <div style={{ textAlign: "center", width: 200 }}>
          <p style={{
            color: "rgba(255,255,255,0.88)",
            fontSize: 12, fontWeight: 600,
            letterSpacing: "0.07em", textTransform: "uppercase",
            fontFamily: "var(--font-sans, system-ui)",
            marginBottom: 5,
          }}>
            Processing
          </p>
          <p
            key={step}
            className="vc-step-label"
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
              letterSpacing: "0.02em",
              fontFamily: "var(--font-sans, system-ui)",
              whiteSpace: "nowrap",
            }}
          >
            {steps[step]}
          </p>
        </div>

        {/* Step dots */}
        <div style={{ display: "flex", gap: 6 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: "50%",
              background: i === step
                ? "rgba(255,188,120,0.9)"
                : "rgba(255,255,255,0.18)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
      </div>

      {/* Bottom shimmer line */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden",
      }}>
        <div className="vc-shimmer-bar" style={{
          height: "100%", width: "25%",
          background: "linear-gradient(90deg, transparent, rgba(255,188,120,0.7), transparent)",
        }} />
      </div>
    </>
  );
}

/* ── Corner bracket decorations ─────────────────────────────────────────────── */
function CornerBrackets({ active }: { active: boolean }) {
  const color = active ? "rgba(255,188,120,0.85)" : "rgba(255,255,255,0.35)";
  const size = 18;
  const thickness = 2;
  const corners: { top?: number; bottom?: number; left?: number; right?: number; deg: number }[] = [
    { top: 12, left: 12,  deg: 0   },
    { top: 12, right: 12, deg: 90  },
    { bottom: 12, right: 12, deg: 180 },
    { bottom: 12, left: 12,  deg: 270 },
  ];
  return (
    <>
      {corners.map(({ deg, ...pos }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...pos,
            width: size,
            height: size,
            borderTop: `${thickness}px solid ${color}`,
            borderLeft: `${thickness}px solid ${color}`,
            borderRadius: "2px 0 0 0",
            transform: `rotate(${deg}deg)`,
            pointerEvents: "none",
            transition: "border-color 0.3s",
          }}
        />
      ))}
    </>
  );
}
