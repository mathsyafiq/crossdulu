import { useEffect, useRef, useState } from "preact/hooks";
import type { EditorStrings } from "../i18n/strings";
import { guideRect } from "../lib/capture";
import { browserSurface, type Surface } from "../lib/watermark";

interface Props {
  t: EditorStrings;
  onCapture: (s: Surface) => void;
  onClose: () => void;
  /** Camera not available: hand over to the phone's own camera app instead. */
  onFallback: () => void;
}

/** Live camera with a card-shaped guide. The picture is taken in this browser and never sent anywhere. */
export default function Camera({ t, onCapture, onClose, onFallback }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const shoot = useRef<HTMLButtonElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"starting" | "live" | "error">("starting");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (dead) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream.current = s;
        const v = video.current!;
        v.srcObject = s;
        await v.play();
        const ready = () => {
          if (!v.videoWidth) return;
          setSize({ w: v.videoWidth, h: v.videoHeight });
          setState("live");
        };
        if (v.videoWidth) ready(); else v.addEventListener("loadedmetadata", ready, { once: true });
      } catch {
        if (!dead) setState("error");
      }
    })();
    return () => { dead = true; stop(); };
  }, []);

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
    const items = Array.from(box.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
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
            <p id="cam-hint" class="notice bad" role="alert">{t.cameraError}</p>
            <div class="row">
              <button type="button" class="btn primary" onClick={onFallback}>{t.cameraFallback}</button>
              <button type="button" class="btn secondary" onClick={onClose}>{t.cameraCancel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
