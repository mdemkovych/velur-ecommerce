"use client";

import { useRef, useState } from "react";
import { Autocomplete } from "@/components/ui/Autocomplete";
import { useCitySearch, useWarehouseSearch } from "@/hooks/useNovaPoshta";
import { fieldErrorsFrom, orderCustomerPatchSchema, type FieldErrors } from "@/lib/validation";
import type { OrderCustomer } from "@/lib/types";
import { inputCls, labelCls, Notice, Select } from "../../ui";

/**
 * Inline customer contact and Nova Poshta delivery editor component.
 *
 * NOTE: (§5.1, §8.4) Re-validates postal refs and fields matching checkout validation constraints.
 */
export function CustomerEditor({
  customer,
  disabled,
  onSave,
  onCancel,
  onInvalid,
}: {
  customer: OrderCustomer;
  disabled: boolean;
  onSave: (next: Record<string, unknown>) => void;
  onCancel: () => void;
  onInvalid: (message: string) => void;
}) {
  const [values, setValues] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email,
    city: customer.city,
    cityRef: customer.cityRef,
    deliveryMethod: customer.deliveryMethod,
    branch: customer.branch ?? "",
    branchRef: customer.branchRef ?? "",
    address: customer.address ?? "",
    comment: customer.comment ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLDivElement>(null);

  const cities = useCitySearch(values.city);
  const warehouses = useWarehouseSearch(values.cityRef, values.branch);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    const parsed = orderCustomerPatchSchema.safeParse({
      ...values,
      branch: values.branch || undefined,
      branchRef: values.branchRef || undefined,
      address: values.address || undefined,
      comment: values.comment || undefined,
    });

    if (!parsed.success) {
      const fieldErrors = fieldErrorsFrom(parsed.error);
      setErrors(fieldErrors);
      onInvalid("Not saved: check the highlighted fields.");
      requestAnimationFrame(() => {
        const first = formRef.current?.querySelector<HTMLElement>('[data-invalid="true"]');
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setErrors({});
    onSave({ customer: parsed.data });
  }

  return (
    <div ref={formRef} className="space-y-4">
      <Notice kind="info">
        Change these while the order has not shipped. It moves neither money nor stock —
        only the contact details and the address.
      </Notice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Text label="First name" value={values.firstName} error={errors.firstName}
          disabled={disabled} onChange={(v) => set("firstName", v)} />
        <Text label="Last name" value={values.lastName} error={errors.lastName}
          disabled={disabled} onChange={(v) => set("lastName", v)} />
        <Text label="Telephone" value={values.phone} error={errors.phone}
          disabled={disabled} onChange={(v) => set("phone", v)} />
        <Text label="Email" value={values.email} error={errors.email}
          disabled={disabled} onChange={(v) => set("email", v)} />
      </div>

      <label className="block space-y-1.5">
        <span className={labelCls}>Delivery method</span>
        <Select
          value={values.deliveryMethod}
          disabled={disabled}
          onChange={(e) => set("deliveryMethod", e.target.value as OrderCustomer["deliveryMethod"])}
          aria-label="Delivery method"
        >
          <option value="branch">Branch or parcel locker</option>
          <option value="courier">Courier to an address</option>
        </Select>
      </label>

      <Autocomplete<{ ref: string; name: string; area: string }>
        label="City"
        value={values.city}
        onChange={(v) => setValues((p) => ({ ...p, city: v, cityRef: "", branch: "", branchRef: "" }))}
        onSelect={(c) =>
          setValues((p) => ({ ...p, city: c.name, cityRef: c.ref, branch: "", branchRef: "" }))
        }
        options={cities.options}
        isLoading={cities.isLoading}
        getOptionKey={(c) => c.ref}
        renderOption={(c) => `${c.name}, ${c.area}`}
        error={errors.city}
        disabled={disabled}
        emptyMessage="Nothing found — you can leave the name as typed"
        maxLength={100}
      />

      {values.deliveryMethod === "branch" ? (
        <Autocomplete<{ ref: string; description: string }>
          label="Branch"
          value={values.branch}
          onChange={(v) => setValues((p) => ({ ...p, branch: v, branchRef: "" }))}
          onSelect={(w) => setValues((p) => ({ ...p, branch: w.description, branchRef: w.ref }))}
          options={warehouses.options}
          isLoading={warehouses.isLoading}
          getOptionKey={(w) => w.ref}
          renderOption={(w) => w.description}
          error={errors.branch}
          disabled={disabled || !values.cityRef}
          emptyMessage="Choose a city from the list to see its branches"
          maxLength={250}
        />
      ) : (
        <Text label="Address" value={values.address} error={errors.address}
          disabled={disabled} onChange={(v) => set("address", v)} />
      )}

      <Text label="Notes for the order" value={values.comment} error={errors.comment}
        disabled={disabled} onChange={(v) => set("comment", v)} />

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={submit}
          className="cursor-pointer border border-black bg-black px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-ink-3"
        >
          Save
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="cursor-pointer text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase transition-colors hover:text-black"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Form text input field with error feedback. */
function Text({
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={labelCls}>{label}</span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        data-invalid={Boolean(error)}
        className={inputCls}
      />
      {error && <span className="block text-[11px] text-red-700">{error}</span>}
    </label>
  );
}

