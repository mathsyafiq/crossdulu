import type { JSX } from "preact";

interface Props {
  label: string;
  accept: string;
  /** Phones: open the camera app straight away. */
  capture?: "environment" | "user";
  variant?: "primary" | "secondary";
  onFile: (f: File) => void;
  /** Called when the user is about to pick (hover, focus): lets slow readers start loading early. */
  onIntent?: () => void;
}

/**
 * A button that IS the file input: the real <input type="file"> is laid invisibly over the whole button,
 * so the click or tap lands on it directly. No script has to open the picker on the user's behalf,
 * which some browsers (in-app browsers, locked-down desktops, older Safari) refuse to do.
 */
export default function FileButton({ label, accept, capture, variant = "primary", onFile, onIntent }: Props) {
  const change = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const i = e.currentTarget;
    const f = i.files?.[0];
    i.value = ""; // so choosing the same file again still counts
    if (f) onFile(f);
  };
  // Space opens a file input everywhere; Enter does not in every browser.
  const key = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const i = e.currentTarget;
    try { i.showPicker(); } catch { i.click(); }
  };
  return (
    <span class={`btn ${variant} file-btn`} onPointerEnter={onIntent}>
      <span aria-hidden="true">{label}</span>
      <input class="file-hit" type="file" accept={accept} capture={capture} aria-label={label} title=""
        onChange={change} onKeyDown={key} onFocus={onIntent} />
    </span>
  );
}
