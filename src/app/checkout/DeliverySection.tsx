"use client";

import { useEffect, useState } from "react";
import { Autocomplete } from "@/components/ui/Autocomplete";
import { TextField } from "@/components/ui/TextField";
import { useCitySearch, useWarehouseSearch } from "@/hooks/useNovaPoshta";
import type { DeliveryMethod } from "@/lib/types";
import type { CheckoutErrors, CheckoutValues } from "./types";

interface Props {
  values: CheckoutValues;
  errors: CheckoutErrors;
  setValue: <K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) => void;
  setValues: (patch: Partial<CheckoutValues>) => void;
  onDirectoryStatus: (isDown: boolean) => void;
  onBlurField: (field: keyof CheckoutValues) => void;
}

const METHODS: { id: DeliveryMethod; label: string }[] = [
  { id: "branch", label: "To a branch or parcel locker" },
  { id: "courier", label: "By courier to an address" },
];

/**
 * Nova Poshta delivery selector for branch/postomat and courier addresses.
 *
 * NOTE: (§5.1, §5.2) Integrates debounced settlement and warehouse search with offline manual fallback.
 */
export function DeliverySection({ values, errors, setValue, setValues, onDirectoryStatus, onBlurField }: Props) {
  const cities = useCitySearch(values.cityRef ? "" : values.city);
  const warehouses = useWarehouseSearch(values.cityRef, values.branch);

  const directoryDown = !cities.isDirectoryAvailable;
  const isCitySettled = Boolean(values.cityRef) || directoryDown;

  const [isCommentOpen, setIsCommentOpen] = useState(() => values.comment.length > 0);

  useEffect(() => {
    onDirectoryStatus(directoryDown);
  }, [directoryDown, onDirectoryStatus]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="block text-[11px] sm:text-xs font-medium text-black font-montserrat">
          Delivery type *
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {METHODS.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() =>
                setValues({
                  deliveryMethod: method.id,
                  branch: "",
                  branchRef: "",
                  street: "",
                  house: "",
                  apartment: "",
                })
              }
              className={`p-3.5 border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                values.deliveryMethod === method.id
                  ? "border-black bg-neutral-50"
                  : "border-neutral-200 hover:border-black bg-white"
              }`}
            >
              <span
                className={`w-3.5 h-3.5 border shrink-0 ${
                  values.deliveryMethod === method.id ? "border-black bg-black" : "border-neutral-400"
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-black">
                {method.label}
              </span>
            </button>
          ))}
        </div>
        {errors.deliveryMethod && (
          <p className="text-[10px] text-red-500 font-semibold">{errors.deliveryMethod}</p>
        )}
      </div>

      {values.deliveryMethod && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {directoryDown && (
            <p className="bg-neutral-50 border border-neutral-200 text-ink-2 text-[11px] leading-relaxed p-3">
              Suggestions are unavailable. Enter{" "}
              {values.deliveryMethod === "courier" ? "a city and an address" : "a city and a branch"}{" "}
              by hand — check the spelling carefully.
            </p>
          )}

          <Autocomplete
            label="City *"
            value={values.city}
            placeholder="Enter the city name"
            error={errors.city}
            isLoading={cities.isLoading}
            options={cities.options}
            getOptionKey={(city) => city.ref}
            renderOption={(city) => (
              <>
                <span className="font-medium text-black">{city.name}</span>
                {city.area && <span className="text-ink-2 text-xs"> ({city.area} region)</span>}
              </>
            )}
            onChange={(value) => setValues({ city: value, cityRef: "", branch: "", branchRef: "" })}
            onSelect={(city) => setValues({ city: city.name, cityRef: city.ref, branch: "", branchRef: "" })}
            onBlur={() => onBlurField("city")}
            emptyMessage={directoryDown ? undefined : "City not found. Check the spelling."}
          />

          {values.deliveryMethod === "branch" ? (
            <Autocomplete
              label="Branch or parcel locker *"
              value={values.branch}
              placeholder={isCitySettled ? "Branch number or address" : "Choose a city from the list first"}
              disabled={!isCitySettled}
              error={errors.branch}
              isLoading={warehouses.isLoading}
              options={warehouses.options}
              getOptionKey={(warehouse) => warehouse.ref}
              renderOption={(warehouse) => (
                <span className="text-xs text-black leading-snug">{warehouse.description}</span>
              )}
              onChange={(value) => setValues({ branch: value, branchRef: "" })}
              onSelect={(warehouse) =>
                setValues({ branch: warehouse.description, branchRef: warehouse.ref })
              }
              onBlur={() => onBlurField("branch")}
              maxLength={250}
              emptyMessage={directoryDown ? undefined : "No branches found. Try another search."}
            />
          ) : (
            <div className="space-y-4">
              {!isCitySettled && (
                <p className="border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-ink-2">
                  Choose a city from the list first — the street is checked within
                  the chosen city.
                </p>
              )}
              <TextField
                label="Street *"
                value={values.street}
                maxLength={150}
                disabled={!isCitySettled}
                placeholder="Khreshchatyk"
                error={errors.street}
                onChange={(e) => setValue("street", e.target.value)}
                onBlur={() => onBlurField("street")}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="House *"
                  value={values.house}
                  maxLength={10}
                  disabled={!isCitySettled}
                  placeholder="1A"
                  error={errors.house}
                  onChange={(e) => setValue("house", e.target.value)}
                  onBlur={() => onBlurField("house")}
                />
                <TextField
                  label="Flat or office"
                  value={values.apartment}
                  maxLength={10}
                  disabled={!isCitySettled}
                  placeholder="10"
                  onChange={(e) => setValue("apartment", e.target.value)}
                />
              </div>
              {errors.address && (
                <p className="text-[10px] text-red-500 font-semibold">{errors.address}</p>
              )}
            </div>
          )}

          {isCommentOpen ? (
            <div className="space-y-2">
              <TextField
                label="Notes for the order"
                value={values.comment}
                maxLength={500}
                placeholder="A good time to call, for instance"
                onChange={(e) => setValue("comment", e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  setValue("comment", "");
                  setIsCommentOpen(false);
                }}
                className="link-underline font-montserrat inline-flex min-h-11 cursor-pointer items-center text-[11px] font-bold tracking-[0.18em] text-ink-3 uppercase transition-colors hover:text-black"
              >
                Remove the note
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCommentOpen(true)}
              className="link-underline font-montserrat inline-flex min-h-11 cursor-pointer items-center text-[11px] font-bold tracking-[0.18em] text-black uppercase transition-colors hover:text-ink-2"
            >
              + Add a note to the order
            </button>
          )}
        </div>
      )}
    </div>
  );
}

