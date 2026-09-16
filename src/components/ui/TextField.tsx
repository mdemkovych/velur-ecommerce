import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The storefront's text input.
 *
 * NOTE: (§8.2) Not the panel's; `fieldCls` in `admin/ui.tsx` is that one.
 */

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  error?: string;
  /** Rendered on the right of the label row — e.g. a "change" shortcut. */
  action?: ReactNode;
  /** Rendered inside the field on the right — e.g. a loading spinner. */
  adornment?: ReactNode;
}

/**
 * Shared storefront text input component with focus, error, and adornment states.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, action, adornment, ...inputProps },
  ref,
) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="block text-[11px] sm:text-xs font-medium text-black font-montserrat">
          {label}
        </label>
        {action}
      </div>

      <div className="relative">
        <input
          ref={ref}
          {...inputProps}
          aria-invalid={Boolean(error)}
          className={cn(
            "w-full border px-4 py-2.5 h-[46px] text-sm text-black bg-white transition-colors",
            "disabled:bg-neutral-100 disabled:cursor-not-allowed",
            error ? "border-red-500" : "border-neutral-300 focus:border-black",
            adornment && "pr-10",
          )}
        />
        {adornment && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{adornment}</div>
        )}
      </div>

      {error && <p className="text-[10px] text-red-500 mt-1 font-semibold">{error}</p>}
    </div>
  );
});

export function Spinner() {
  return <div className="w-4 h-4 border-2 border-neutral-300 border-t-black animate-spin" />;
}

