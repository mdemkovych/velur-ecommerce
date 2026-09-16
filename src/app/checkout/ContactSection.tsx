"use client";

import { TextField } from "@/components/ui/TextField";
import {
  capitalizeName,
  formatSubscriberDigits,
  sanitizeEmail,
  toSubscriberDigits,
  UA_PHONE_CODE,
  validateEmail,
  validateName,
  validatePhone,
} from "@/lib/validation";
import type { CheckoutErrors, CheckoutValues } from "./types";

interface Props {
  values: CheckoutValues;
  errors: CheckoutErrors;
  setValue: <K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) => void;
  setError: (key: keyof CheckoutValues, message: string | null) => void;
}

/**
 * Customer contact information form fields (first name, last name, phone, email).
 *
 * NOTE: (§3.1, §5.1) Formats Ukrainian phone prefix (+380) and performs client validation.
 */
export function ContactSection({ values, errors, setValue, setError }: Props) {
  return (
    <div className="space-y-6">
      <div className="border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-black flex items-center gap-2 font-medium text-sm">
          <span className="text-lg">🇺🇦</span>
          Delivery across Ukraine
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-2 bg-neutral-200 px-2.5 py-1">
          Nova Poshta
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField
          label="First name *"
          value={values.firstName}
          maxLength={50}
          placeholder="Olena"
          error={errors.firstName}
          onChange={(e) => setValue("firstName", e.target.value)}
          onBlur={() => {
            const capitalized = capitalizeName(values.firstName.trim());
            setValue("firstName", capitalized);
            setError("firstName", validateName(capitalized, "First name"));
          }}
        />
        <TextField
          label="Last name *"
          value={values.lastName}
          maxLength={50}
          placeholder="Koval"
          error={errors.lastName}
          onChange={(e) => setValue("lastName", e.target.value)}
          onBlur={() => {
            const capitalized = capitalizeName(values.lastName.trim());
            setValue("lastName", capitalized);
            setError("lastName", validateName(capitalized, "Last name"));
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] sm:text-xs font-medium text-black mb-1.5 font-montserrat">
            Telephone *
          </label>
          <div
            className={`flex items-stretch border bg-white h-[46px] transition-colors ${
              errors.phone ? "border-red-500" : "border-neutral-300 focus-within:border-black"
            }`}
          >
            <span className="flex items-center gap-1.5 px-3.5 border-r border-neutral-300 text-sm text-black select-none shrink-0">
              <span className="text-lg leading-none">🇺🇦</span>
              {UA_PHONE_CODE}
            </span>
            <input
              type="tel"
              inputMode="numeric"
              aria-invalid={Boolean(errors.phone)}
              value={formatSubscriberDigits(values.phone)}
              placeholder="99 123 45 67"
              className="w-full border-0 bg-transparent px-3.5 text-sm text-black"
              onChange={(e) => setValue("phone", toSubscriberDigits(e.target.value))}
              onBlur={() => setError("phone", validatePhone(values.phone))}
            />
          </div>
          {errors.phone && (
            <p className="text-[10px] text-red-500 mt-1 font-semibold">{errors.phone}</p>
          )}
        </div>

        <TextField
          label="Email *"
          type="email"
          value={values.email}
          maxLength={254}
          placeholder="yuliia@example.com"
          error={errors.email}
          onChange={(e) => setValue("email", sanitizeEmail(e.target.value))}
          onBlur={() => setError("email", validateEmail(values.email))}
        />
      </div>
    </div>
  );
}

