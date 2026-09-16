/**
 * Inline card scheme brand marks (Visa, Mastercard) for checkout payment options.
 *
 * NOTE: (§3.1) Rendered inline as vector/text without external asset dependencies for CSP compliance.
 */

/** Consistent container plate matching heading line height. */
function Plate({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-5 w-[38px] shrink-0 items-center justify-center border border-line-2 bg-white">
      {children}
    </span>
  );
}

/** Visa brand mark rendered as styled text. */
export function VisaMark() {
  return (
    <Plate>
      <span
        aria-hidden="true"
        className="font-sans text-[10px] leading-none font-bold tracking-tight text-[#1A1F71] italic"
      >
        VISA
      </span>
    </Plate>
  );
}

/** Mastercard brand mark rendered as inline SVG geometry. */
export function MastercardMark() {
  return (
    <Plate>
      <svg viewBox="0 0 32 20" className="h-3 w-auto" aria-hidden="true" focusable="false">
        <circle cx="12" cy="10" r="8" fill="#EB001B" />
        <circle cx="20" cy="10" r="8" fill="#F79E1B" />
        {/*
          The lens where the circles meet, drawn rather than blended:
          `mix-blend-multiply` renders differently once the SVG sits on a tinted
          panel, and this row is tinted when selected.

          The points are the geometry — circles of r=8 whose centres are 8 apart
          meet at x=16, y=10±√48.
        */}
        <path d="M16 3.072a8 8 0 0 1 0 13.856 8 8 0 0 1 0-13.856Z" fill="#FF5F00" />
      </svg>
    </Plate>
  );
}

