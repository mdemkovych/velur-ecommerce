"use client";

import Image from "next/image";
import { Card, digitsOnly, fieldCls, hintCls, Icon, Select, wholeNumberInput } from "@/app/admin/ui";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";
import { cn } from "@/lib/cn";

export interface ComponentDraft {
  productId: string;
  quantity: string;
}

interface Props {
  components: ComponentDraft[];
  onChange: (components: ComponentDraft[]) => void;
  /** Available catalogue items to select from. */
  catalogue: { id: string; nameUk: string; image: string }[];
  error?: string;
}

/**
 * Product set composition editor for attaching component products and quantities.
 *
 * NOTE: (§2.3, §8.1) Manages relation rows for bundle products shown in storefront sets.
 */
export function SetComposition({ components, onChange, catalogue, error }: Props) {
  const add = (productId: string) => {
    if (!productId || components.some((c) => c.productId === productId)) return;
    onChange([...components, { productId, quantity: "1" }]);
  };

  const update = (productId: string, quantity: string) =>
    onChange(components.map((c) => (c.productId === productId ? { ...c, quantity } : c)));

  const remove = (productId: string) =>
    onChange(components.filter((c) => c.productId !== productId));

  const available = catalogue.filter((p) => !components.some((c) => c.productId === p.id));

  return (
    <Card
      title="Set contents"
      hint="Filled in for sets only. The contents appear on the product page in place of the specifications, as links to the products themselves."
    >
      <div className="space-y-3">
        <ul className="border border-neutral-200 divide-y divide-neutral-100">
          {components.map((c) => {
            const product = catalogue.find((p) => p.id === c.productId);
            return (
              <li key={c.productId} className="flex items-center gap-3 p-2.5">
                <span className="relative h-10 w-8 shrink-0 overflow-hidden border border-neutral-200 bg-neutral-50">
                  <Image
                    src={primaryMedia(product?.image ?? "")}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="32px"
                    quality={IMAGE_QUALITY}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-black">
                  {product?.nameUk ?? "Product deleted"}
                </span>
                <label className="flex items-center gap-1.5">
                  <input
                    {...wholeNumberInput}
                    value={c.quantity}
                    onChange={(e) => update(c.productId, digitsOnly(e.target.value))}
                    className={cn(fieldCls(), "h-9 w-14 px-2 text-center")}
                  />
                  <span className="text-xs text-ink-3">pcs</span>
                </label>
                <button
                  type="button"
                  onClick={() => remove(c.productId)}
                  title="Remove from the set"
                  aria-label={`Remove «${product?.nameUk ?? "product"}» from the set`}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-ink-3 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>

        {error && <p className="text-[11px] font-semibold text-red-600">{error}</p>}

        {available.length > 0 ? (
          <Select
            value=""
            onChange={(e) => add(e.target.value)}
            aria-label="Add a product to the set"
          >
            <option value="">+ Add a product to the set…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameUk}
              </option>
            ))}
          </Select>
        ) : (
          <p className={hintCls}>Every available product is already in the set.</p>
        )}
      </div>
    </Card>
  );
}

