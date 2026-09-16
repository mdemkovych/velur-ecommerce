import { cn } from "@/lib/cn";

interface OverlineProps {
  children: React.ReactNode;
  /** Light variant for dark backgrounds */
  theme?: "dark" | "light";
  className?: string;
}

/**
 * Uppercase section overline badge component.
 */
export default function Overline({ children, theme = "dark", className }: OverlineProps) {
  return (
    <p
      className={cn(
        "font-montserrat text-[10px] font-bold tracking-[0.3em] uppercase mb-4 sm:mb-5",
        theme === "dark" ? "text-ink-3" : "text-white/70",
        className
      )}
    >
      {children}
    </p>
  );
}

