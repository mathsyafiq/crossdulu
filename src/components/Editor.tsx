import { useEffect, useRef, useState } from "preact/hooks";
import type { EditorStrings, Lang } from "../i18n/strings";
import Camera from "./Camera";
import { importPdf, isPdf, preloadPdfReader } from "../lib/pdfimport";
import {
  type Surface, type Settings, type Warning,
  loadImage, LoadFailure, renderCard, checkSettings, exportPng, exportPdf, download, preloadPdf,
  WATERMARK_COLORS, DEFAULT_ANGLE, DEFAULT_OPACITY, DEFAULT_SCALE, MIN_SCALE, DEFAULT_POSITION, type Position,
} from "../lib/watermark";

const CONSENT_KEY = "palang-consent-v1";
const CORNER_SCALE = 0.75; // starting size for the corner band: clear of most card details, still readable

interface Props {
  lang: Lang;
  homeHref: string;
  privacyHref: string;
  t: EditorStrings;
}

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function Canvas({ source, settings, label }: { source: Surface; settings: Settings | null; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const shown = settings ? renderCard(source, settings) : source;
      el.width = shown.width;
      el.height = shown.height;
      el.getContext("2d")!.drawImage(shown as CanvasImageSource, 0, 0);
      const b = (shown as any).bleed;
      el.dataset.pad = b ? `${b.l},${b.t},${b.r},${b.b}` : "0,0,0,0"; // room around the card for a band that runs out past it
    });
    return () => cancelAnimationFrame(id);
  }, [source, settings]);
  return <canvas ref={ref} class="preview-canvas" role="img" aria-label={label} />;
}

function Slot(props: {
  id: string;
  label: string;
  t: EditorStrings;
  value: Surface | null;
  settings: Settings | null;
  error: string | null;
  onFile: (f: File) => void;
  onCamera: () => void;
  captureRef: { current: HTMLInputElement | null };
  onRemove: () => void;
  previewLabel: string;
}) {
  const { t, value } = props;
  const [drag, setDrag] = useState(false);
  const pick = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) props.onFile(f);
    (e.target as HTMLInputElement).value = "";
  };
  // Browsers differ on whether Enter opens a file input (Space always does): make both work.
  const enterOpens = (e: KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); const i = e.currentTarget as HTMLInputElement; try { i.showPicker(); } catch { i.click(); } }
  };
  return (
    <section
      class={`slot${drag ? " is-drag" : ""}`}
      aria-labelledby={`${props.id}-h`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer?.files?.[0];
        if (f) props.onFile(f);
      }}
    >
      <h2 id={`${props.id}-h`} class="slot-title">{props.label}</h2>
      {value ? (
        <Canvas source={value} settings={props.settings} label={props.previewLabel} />
      ) : (
        <p class="muted slot-empty">{t.drop}</p>
      )}
      <div class="row">
        <label class={`btn ${value ? "secondary" : "primary"}`}>
          {value ? t.replace : t.choose}
          <input class="visually-hidden" type="file" accept="image/*,application/pdf,.pdf" onChange={pick} onKeyDown={enterOpens} />
        </label>
        {!value && <button type="button" class="btn secondary" onClick={props.onCamera}>{t.camera}</button>}
        {/* Fallback when the live camera is unavailable: the phone's own camera app. */}
        <input ref={props.captureRef} class="visually-hidden" type="file" accept="image/*" capture="environment"
          tabIndex={-1} aria-hidden="true" onChange={pick} />
        {value && (
          <button type="button" class="btn ghost" onClick={props.onRemove}>{t.remove}</button>
        )}
      </div>
      {props.error && <p class="notice bad" role="alert">{props.error}</p>}
    </section>
  );
}

function ConsentModal({ t, homeHref, privacyHref, onAccept }: { t: EditorStrings; homeHref: string; privacyHref: string; onAccept: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { ok.current?.focus(); }, []);
  // Escape is intentionally ignored: this is a consent step. Tab is trapped inside the dialog.
  const trap = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !box.current) return;
    const items = Array.from(box.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
    const first = items[0];
    const last = items[items.length - 1];
    const a = document.activeElement;
    if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div class="overlay" onKeyDown={trap}>
      <div ref={box} class="card modal" role="dialog" aria-modal="true" aria-labelledby="consent-h" aria-describedby="consent-b">
        <h2 id="consent-h">{t.consentTitle}</h2>
        <p id="consent-b">{t.consentBody}</p>
        <ul class="plain-list">
          {t.consentPoints.map((p) => <li>{p}</li>)}
        </ul>
        <p><a href={privacyHref}>{t.consentMore}</a></p>
        <div class="stack">
          <button ref={ok} type="button" class="btn primary" onClick={onAccept}>{t.consentOk}</button>
          <a class="btn secondary" href={homeHref}>{t.consentBack}</a>
        </div>
      </div>
    </div>
  );
}

export default function Editor({ lang, homeHref, privacyHref, t }: Props) {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [front, setFront] = useState<Surface | null>(null);
  const [back, setBack] = useState<Surface | null>(null);
  const [errFront, setErrFront] = useState<string | null>(null);
  const [errBack, setErrBack] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [addDate, setAddDate] = useState(true);
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [angle, setAngle] = useState(DEFAULT_ANGLE);
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [scale, setScale] = useState(CORNER_SCALE);
  const [hx, setHx] = useState(0);
  const [vy, setVy] = useState(0);
  const [colour, setColour] = useState<string>(WATERMARK_COLORS[0]);
  const [busy, setBusy] = useState<null | "png" | "pdf">(null);
  const [cameraFor, setCameraFor] = useState<null | "front" | "back">(null);
  const captureFront = useRef<HTMLInputElement | null>(null);
  const captureBack = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  useEffect(() => {
    let ok = false;
    try { ok = localStorage.getItem(CONSENT_KEY) === "1"; } catch { /* private mode: ask each time */ }
    setConsent(ok);
  }, []);

  useEffect(() => { if (consent) preloadPdf(); }, [consent]);

  const accept = () => {
    try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* ignore */ }
    setConsent(true);
  };

  const setters = {
    front: { set: setFront, err: setErrFront },
    back: { set: setBack, err: setErrBack },
  };
  const failMsg = (e: unknown) => {
    const code = e instanceof LoadFailure ? e.code : "decode";
    return code === "type" ? t.errType : code === "size" ? t.errSize : code === "pdf" ? t.errPdf : code === "password" ? t.errPdfPassword : t.errDecode;
  };

  /** A picture file, or a PDF of an ID copy. `side` null means: put it in the first empty slot. */
  const handleFile = async (file: File, side: "front" | "back" | null) => {
    setErrFront(null);
    setErrBack(null);
    setStatus(null);
    const target = side ?? (!front ? "front" : !back ? "back" : "front");
    try {
      if (isPdf(file)) {
        setStatus({ kind: "ok", msg: t.pdfWorking });
        const cards = await importPdf(file);
        if (cards.length >= 2) {
          setFront(cards[0]);
          setBack(cards[1]);
          setStatus({ kind: "ok", msg: t.pdfSplit });
        } else {
          setters[target].set(cards[0]);
          setStatus({ kind: "ok", msg: t.pdfOne });
        }
      } else {
        setters[target].set(await loadImage(file));
      }
      preloadPdf();
    } catch (e) {
      setStatus(null);
      setters[target].err(failMsg(e));
    }
  };

  const captured = (side: "front" | "back", s: Surface) => {
    setters[side].set(s);
    setErrFront(null);
    setErrBack(null);
    setStatus(null);
    setCameraFor(null);
  };

  const swap = () => {
    const f = front;
    setFront(back);
    setBack(f);
  };

  const trimmed = text.trim();
  const full = trimmed ? (addDate ? `${trimmed} ${today()}` : trimmed) : "";
  const settings: Settings = { text: full, opacity, angle, color: colour, scale, position, hx, vy };
  const warnings: Warning[] = checkSettings(settings);
  const both = !!front && !!back;
  const canExport = both && !warnings.includes("empty") && busy === null;

  const warnText = (w: Warning) =>
    w === "empty" ? t.warnEmpty : w === "faint" ? t.warnFaint : w === "small" ? t.warnSmall : t.warnHeavy;

  const run = async (kind: "png" | "pdf") => {
    if (!front || !back) return;
    setBusy(kind);
    setStatus({ kind: "ok", msg: t.working });
    try {
      const f = renderCard(front, settings);
      const b = renderCard(back, settings);
      if (kind === "png") download(await exportPng(f, b), `${t.fileName}.png`, "image/png");
      else download(await exportPdf(f, b), `${t.fileName}.pdf`, "application/pdf");
      setStatus({ kind: "ok", msg: t.done });
    } catch {
      setStatus({ kind: "bad", msg: t.failed });
    } finally {
      setBusy(null);
    }
  };

  if (consent === null) return null;

  return (
    <div class="editor" lang={lang}>
      {cameraFor && consent && (
        <Camera t={t} onCapture={(sf) => captured(cameraFor, sf)} onClose={() => setCameraFor(null)}
          onFallback={() => { const r = cameraFor === "front" ? captureFront : captureBack; setCameraFor(null); r.current?.click(); }} />
      )}
      {!consent && <ConsentModal t={t} homeHref={homeHref} privacyHref={privacyHref} onAccept={accept} />}
      <div class="editor-grid" aria-hidden={!consent} inert={!consent}>
        <div class="slots">
          <div class="pdf-pick">
            <label class="btn secondary" onPointerEnter={preloadPdfReader} onTouchStart={preloadPdfReader}>
              {t.pdfChoose}
              <input class="visually-hidden" type="file" accept="application/pdf,.pdf" onFocus={preloadPdfReader} onChange={(e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleFile(f, null);
                (e.target as HTMLInputElement).value = "";
              }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).click(); } }} />
            </label>
            <span class="muted small">{t.pdfHint}</span>
          </div>
          <Slot id="front" label={t.front} t={t} value={front} settings={both ? settings : null}
            error={errFront} onFile={(f) => handleFile(f, "front")}
            onCamera={() => setCameraFor("front")} captureRef={captureFront}
            onRemove={() => setFront(null)} previewLabel={t.previewFront} />
          <Slot id="back" label={t.back} t={t} value={back} settings={both ? settings : null}
            error={errBack} onFile={(f) => handleFile(f, "back")}
            onCamera={() => setCameraFor("back")} captureRef={captureBack}
            onRemove={() => setBack(null)} previewLabel={t.previewBack} />
          {both && <div class="row"><button type="button" class="btn ghost" onClick={swap}>{t.swap}</button></div>}
          <p class="muted small">{t.staysHere}</p>
        </div>

        <div class="panel card">
          {!both ? (
            <p class="notice info">{t.needBoth}</p>
          ) : (
            <>
              <div class="field">
                <label for="wm-text">{t.textLabel}</label>
                <input id="wm-text" type="text" value={text} maxLength={90} autocomplete="off"
                  aria-describedby="wm-hint" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
                <div id="wm-hint" class="hint">{t.textHint}</div>
              </div>

              <div class="field" role="group" aria-label={t.presetsLabel}>
                <span class="label">{t.presetsLabel}</span>
                <div class="row">
                  {t.presets.map((p) => (
                    <button type="button" class="chip" aria-pressed={text === p} onClick={() => setText(p)}>{p}</button>
                  ))}
                </div>
              </div>

              <label class="check">
                <input type="checkbox" checked={addDate} onChange={(e) => setAddDate((e.target as HTMLInputElement).checked)} />
                {t.addDate}
              </label>

              <div class="field" role="radiogroup" aria-label={t.position}>
                <span class="label">{t.position}</span>
                <div class="row">
                  {(["corner", "middle"] as Position[]).map((pos) => (
                    <button type="button" class="chip" role="radio" aria-checked={position === pos}
                      onClick={() => { setPosition(pos); setScale(pos === "corner" ? CORNER_SCALE : DEFAULT_SCALE); }}>
                      {pos === "corner" ? t.positionCorner : t.positionMiddle}
                    </button>
                  ))}
                </div>
              </div>
              {position === "corner" && <p class="notice info">{t.cornerNote}</p>}
              {position === "corner" && (
                <>
                  <div class="field">
                    <label for="wm-hx">{t.moveX}: {Math.round(hx * 100)}%</label>
                    <input id="wm-hx" type="range" min="0" max="100" step="1" value={Math.round(hx * 100)}
                      aria-valuetext={`${Math.round(hx * 100)}%`}
                      onInput={(e) => setHx(Number((e.target as HTMLInputElement).value) / 100)} />
                  </div>
                  <div class="field">
                    <label for="wm-vy">{t.moveY}: {Math.round(vy * 100)}%</label>
                    <input id="wm-vy" type="range" min="0" max="100" step="1" value={Math.round(vy * 100)}
                      aria-valuetext={`${Math.round(vy * 100)}%`}
                      onInput={(e) => setVy(Number((e.target as HTMLInputElement).value) / 100)} />
                  </div>
                </>
              )}

              <div class="field">
                <label for="wm-op">{t.opacity}: {Math.round(opacity * 100)}%</label>
                <input id="wm-op" type="range" min="10" max="100" step="5" value={Math.round(opacity * 100)}
                  aria-valuetext={`${Math.round(opacity * 100)}%`}
                  onInput={(e) => setOpacity(Number((e.target as HTMLInputElement).value) / 100)} />
              </div>

              <div class="field">
                <label for="wm-an">{t.angle}: {angle}°</label>
                <input id="wm-an" type="range" min="-80" max="-10" step="1" value={angle}
                  aria-valuetext={`${angle} degrees`}
                  onInput={(e) => setAngle(Number((e.target as HTMLInputElement).value))} />
              </div>

              <div class="field">
                <label for="wm-sz">{t.size}: {Math.round(scale * 100)}%</label>
                <input id="wm-sz" type="range" min={Math.round(MIN_SCALE * 100)} max="100" step="5" value={Math.round(scale * 100)}
                  aria-valuetext={`${Math.round(scale * 100)}%`}
                  onInput={(e) => setScale(Number((e.target as HTMLInputElement).value) / 100)} />
              </div>

              <div class="field" role="radiogroup" aria-label={t.colour}>
                <span class="label">{t.colour}</span>
                <div class="row">
                  {WATERMARK_COLORS.map((c, i) => (
                    <button type="button" class="swatch" role="radio" aria-checked={colour === c}
                      aria-label={t.colourNames[i]} onClick={() => setColour(c)}>
                      <i style={{ background: c }} />
                    </button>
                  ))}
                </div>
              </div>

              {warnings.map((w) => (
                <p class={`notice ${w === "empty" ? "info" : "warn"}`}>{warnText(w)}</p>
              ))}

              <div class="row">
                <button type="button" class="btn primary lg" disabled={!canExport} aria-busy={busy === "png"}
                  onClick={() => run("png")}>{t.exportPng}</button>
                <button type="button" class="btn primary lg" disabled={!canExport} aria-busy={busy === "pdf"}
                  onClick={() => run("pdf")}>{t.exportPdf}</button>
              </div>
            </>
          )}
          <div role="status" aria-live="polite">
            {status && <p class={`notice ${status.kind === "ok" ? "ok" : "bad"}`}>{status.msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
