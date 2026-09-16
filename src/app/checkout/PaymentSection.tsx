"use client";

import { MastercardMark, VisaMark } from "@/components/ui/PaymentMarks";
import type { CheckoutErrors, CheckoutValues } from "./types";

interface Props {
  values: CheckoutValues;
  errors: CheckoutErrors;
  setValue: <K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) => void;
}

/**
 * Payment method selection and personal data processing consent checkbox.
 *
 * NOTE: (§3.1, §3.5) Highlights acquiring security without retaining card PAN/CVV within merchant systems.
 */
export function PaymentSection({ values, errors, setValue }: Props) {
  return (
    <div className="space-y-4">
      <div
        onClick={() => setValue("paymentMethod", "mono")}
        className={`flex w-full cursor-pointer items-center gap-3 border p-4 transition-all ${
          values.paymentMethod === "mono"
            ? "border-black bg-neutral-50"
            : "border-neutral-200 bg-white hover:border-black"
        }`}
      >
        <span
          className={`h-3.5 w-3.5 shrink-0 border ${
            values.paymentMethod === "mono" ? "border-black bg-black" : "border-neutral-400"
          }`}
        />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-bold tracking-wider text-black uppercase">
              Online payment
            </span>
            <span className="flex shrink-0 -translate-y-px items-center gap-1.5">
              <VisaMark />
              <MastercardMark />
            </span>
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-black">
            A card from any bank, Apple Pay or Google Pay.
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-2">
            Card details are entered on the bank&apos;s own secure page — the shop never sees
            or stores them.
          </span>
        </span>
      </div>

      <p className="border border-line bg-surface-2 p-3.5 text-[11px] leading-relaxed text-ink-2">
        Delivery is not part of the order total — you pay it on collection
        at the branch, at the carrier&apos;s rates.
      </p>

      {errors.paymentMethod && (
        <p className="text-[10px] text-red-500 font-semibold">{errors.paymentMethod}</p>
      )}

      <label className="flex items-start gap-3 pt-2 cursor-pointer">
        <input
          type="checkbox"
          checked={values.consent}
          aria-invalid={Boolean(errors.consent)}
          onChange={(e) => setValue("consent", e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-black"
        />
        <span className="text-[11px] text-ink-2 leading-relaxed">
          I consent to my personal data being processed to place and deliver the
          order.
        </span>
      </label>
      {errors.consent && (
        <p className="text-[10px] text-red-500 font-semibold">{errors.consent}</p>
      )}
    </div>
  );
}

