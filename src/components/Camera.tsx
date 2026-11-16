import { useEffect, useRef, useState } from "preact/hooks";
import type { EditorStrings } from "../i18n/strings";
import { guideRect } from "../lib/capture";
import { browserSurface, type Surface } from "../lib/watermark";
import FileButton from "./FileButton";

interface Props {
  t: EditorStrings;
  onCapture: (s: Surface) => void;
  onClose: () => void;
  /** Camera not available: a picture from the phone's camera app, or a file on a computer. */
  onPicked: (f: File) => void;
  accept: string;
}

/** Live camera with a card-shaped guide. The picture is taken in this browser and never sent anywhere. */
export default function Camera({ t, onCapture, onClose, onPicked, accept }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const shoot = useRef<HTMLButtonElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"starting" | "live" | "error">("starting");
  const [reason, setReason] = useState<"denied" | "none" | "busy" | "other">("other");
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // A phone hands over to its camera app; a computer just opens the normal picture picker.
  const phone = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  const stop = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };

  useEffect(() => {
    let dead = false;
    setState("starting");
    setSize(null);
    const fail = (e: unknown) => {
      if (dead) return;
      stop();
      const n = (e as { name?: string })?.name;
      setReason(n === "NotAllowedError" || n === "SecurityError" ? "denied"
        : n === "NotFoundError" || n === "OverconstrainedError" ? "none"
        : n === "NotReadableError" || n === "AbortError" ? "busy" : "other");
      setState("error");
    };
    const open = (video: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video, audio: false });
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        let s: MediaStream;
        try {
          s = await open({ facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } });
        } catch (e) {
          // Some laptop webcams and older browsers refuse the size hints: ask for any camera at all.
          if ((e as { name?: string })?.name === "NotAllowedError") throw e;
          s = await open({});
        }
        if (dead) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream.current = s;
        const v = video.current!;
        // Safari and Firefox are strict about silent inline playback: set these as attributes too.
        v.muted = true;
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        v.setAttribute("autoplay", "");
        v.srcObject = s;
        await v.play().catch(() => { /* autoplay attribute takes over */ });
        // Wait until the picture has a size. Polling also covers browsers that fired loadedmetadata early.
        const t0 = performance.now();
        await new Promise<void>((res, rej) => {
          const tick = () => {
            if (dead) return res();
            if (v.videoWidth) return res();
            if (performance.now() - t0 > 12000) return rej(new Error("timeout"));
            requestAnimationFrame(tick);
          };
          tick();
        });
        if (dead) return;
        setSize({ w: v.videoWidth, h: v.videoHeight });
        setState("live");
      } catch (e) {
        fail(e);
      }
    })();
    return () => { dead = true; stop(); };
  }, [attempt]);

  useEffect(() => { if (state === "live") shoot.current?.focus(); }, [state]);

  const take = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const g = guideRect(v.videoWidth, v.videoHeight);
    const sx = Math.round(g.x * v.videoWidth), sy = Math.round(g.y * v.videoHeight);
    const sw = Math.round(g.w * v.videoWidth), sh = Math.round(g.h * v.videoHeight);
    const out = browserSurface(sw, sh);
    out.getContext("2d").drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
    stop();
    onCapture(out);
  };

  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key !== "Tab" || !box.current) return;
    const items = Array.from(box.current.querySelectorAll<HTMLElement>("button:not([disabled]), input"));
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const g = size ? guideRect(size.w, size.h) : null;
  const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

  return (
    <div class="overlay" onKeyDown={key}>
      <div ref={box} class="card modal cam" role="dialog" aria-modal="true" aria-labelledby="cam-h" aria-describedby="cam-hint">
        <h2 id="cam-h">{t.cameraTitle}</h2>
        {state !== "error" && (
          <>
            <div class="cam-view" style={size ? { aspectRatio: `${size.w} / ${size.h}`, maxWidth: `min(100%, ${(60 * size.w) / size.h}vh)` } : undefined}>
              <video ref={video} playsInline muted aria-label={t.cameraPreview} />
              {g && (
                <div class="cam-guide" data-testid="camera-guide" aria-hidden="true"
                  style={{ left: pct(g.x), top: pct(g.y), width: pct(g.w), height: pct(g.h) }} />
              )}
            </div>
            <p id="cam-hint" class="muted" role="status">{state === "starting" ? t.cameraStarting : t.cameraHint}</p>
            <div class="row">
              <button ref={shoot} type="button" class="btn primary lg" disabled={state !== "live"} onClick={take}>{t.cameraCapture}</button>
              <button type="button" class="btn secondary" onClick={onClose}>{t.cameraCancel}</button>
            </div>
          </>
        )}
        {state === "error" && (
          <>
            <p id="cam-hint" class="notice bad" role="alert">
              {t.cameraError}{" "}
              {reason === "denied" ? t.cameraDenied : reason === "none" ? t.cameraNone : reason === "busy" ? t.cameraBusy : t.cameraOther}
            </p>
            <div class="row">
              <FileButton label={phone ? t.cameraFallback : t.cameraFallbackDesktop} accept={phone ? "image/*" : accept}
                capture={phone ? "environment" : undefined} onFile={(f) => { stop(); onPicked(f); }} />
              {reason !== "none" && (
                <button type="button" class="btn secondary" onClick={() => setAttempt((n) => n + 1)}>{t.cameraRetry}</button>
              )}
              <button type="button" class="btn secondary" onClick={onClose}>{t.cameraCancel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
