import { useEffect, useId, useState, type ReactNode } from "react";

/** A hoverable tooltip for compact controls, aligned within the sidebar. */
export function Tooltip({ label, children }: { label: string; children: (descriptionId: string | undefined) => ReactNode }) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const visible = (hovered || focused) && !dismissed;

  useEffect(() => {
    if (!visible) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [visible]);

  return <span className="relative inline-flex shrink-0"
    onPointerEnter={event => {
      if (event.pointerType === "touch") return;
      setHovered(true);
      setDismissed(false);
    }}
    onPointerLeave={() => setHovered(false)}
    onFocus={() => { setFocused(true); setDismissed(false); }}
    onBlur={() => setFocused(false)}
    onClick={() => setDismissed(true)}>
    {children(visible ? id : undefined)}
    {visible && <span className="absolute top-full right-0 z-50 w-max max-w-[calc(100vw-16px)] pt-1.5">
      <span id={id} role="tooltip" className="block rounded-[5px] bg-black px-2.5 py-1.5 text-ui-control font-normal text-white">{label}</span>
    </span>}
  </span>;
}
