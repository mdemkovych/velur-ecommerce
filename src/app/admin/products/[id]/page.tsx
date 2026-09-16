"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Field,
  fieldCls,
  HelpTip,
  PAGE_GUTTER,
  Select,
  textareaClsFor,
  wholeNumberInput,
  digitsOnly,
} from "../../ui";
import {
  MANUAL_BADGE_LABELS,
  MANUAL_BADGES,
  MAX_PRODUCT_IMAGES,
  type ManualBadge,
  type Product,
} from "@/lib/types";
import { fieldErrorsFrom, productSchema, type FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { slugSuggestion } from "@/lib/slug";
import { MediaUploader } from "../../MediaUploader";
import { Toast } from "@/components/ui/Toast";
import { useConfirm } from "../../useConfirm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { emptySpec, SpecificationsEditor, type SpecDraft } from "./SpecificationsEditor";
import { SetComposition, type ComponentDraft } from "./SetComposition";
import { CategoryCard } from "./CategoryCard";
import { moneyChanges, moneySnapshot, type MoneyChange, type MoneySnapshot } from "@/lib/priceDiff";

/**
 * Product editor page handling creation and updates for products and product sets.
 *
 * NOTE: (§2.3, §2.4, §8.1, §8.4) Manages media, pricing, specifications, set composition, and unsaved guards.
 */
export default function AdminProductEditorPage() {
  const { confirm, dialog } = useConfirm();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const isNew = id === "new";

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [baseline, setBaseline] = useState<MoneySnapshot | null>(null);
  const [pendingChanges, setPendingChanges] = useState<MoneyChange[] | null>(null);
  const [cleanState, setCleanState] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);

  const clearError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const [images, setImages] = useState<string[]>([]);

  // Product Basic Fields
  const [nameUk, setNameUk] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [promotionalPrice, setPromotionalPrice] = useState("");
  const [stock, setStock] = useState("");
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [isSet, setIsSet] = useState(false);
  const [catalogue, setCatalogue] = useState<{ id: string; nameUk: string; image: string }[]>([]);

  // Advanced Custom Badge State
  const [badgeText, setBadgeText] = useState<ManualBadge | "">("");

  const [category, setCategory] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const priceRef = useRef<HTMLInputElement>(null);
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");

  const [customDetails, setCustomDetails] = useState<SpecDraft[]>([emptySpec("Volume")]);

  const [usage, setUsage] = useState("");
  const [packaging, setPackaging] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((rows: Product[]) =>
        setCatalogue(
          rows
            .filter((p) => p.id !== id)
            .map((p) => ({ id: p.id, nameUk: p.nameUk, image: p.media[0] ?? "" })),
        ),
      )
      .catch(() => setCatalogue([]));
  }, [id]);

  useEffect(() => {
    if (isNew) return;

    fetch(`/api/products/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`GET /api/products/${id} answered ${r.status}`);
        return (await r.json()) as Product;
      })
      .then((product) => {
        setNameUk(product.nameUk);
        setName(product.name);
        setBadgeText(product.badge ?? "");
        setCategory(product.category);
        setTagline(product.tagline || "");
        setDescription(product.description || "");


        setSlug(product.slug);
        setPrice(String(product.price));
        setPromotionalPrice(product.promotionalPrice ? String(product.promotionalPrice) : "");
        setStock(String(product.stock));
        setBaseline(
          moneySnapshot(
            String(product.price),
            product.promotionalPrice ? String(product.promotionalPrice) : "",
            String(product.stock),
          ),
        );
        setCleanState(null);
        setUsage(product.usage ?? "");
        setPackaging(product.packaging);

        if (product.specifications?.length) {
          setCustomDetails(
            product.specifications.map((pair) => ({
              ...emptySpec(),
              key: pair.key,
              value: pair.value,
            })),
          );
        }

        setImages(product.media ?? []);
        setComponents(
          (product.components ?? []).map((c) => ({
            productId: c.productId,
            quantity: String(c.quantity),
          })),
        );
        setIsSet((product.components ?? []).length > 0);
      })
      .catch(() => router.push("/admin"))
      .finally(() => setLoading(false));
  }, [id, isNew, router]);


  const formState = JSON.stringify({
    nameUk,
    name,
    slug,
    tagline,
    description,
    usage,
    packaging,
    category,
    badgeText,
    images,
    customDetails,
    price,
    promotionalPrice,
    stock,
  });
  if (!loading && cleanState === null) setCleanState(formState);

  const isDirty = cleanState !== null && cleanState !== formState;

  useUnsavedChangesGuard(isDirty, "The changes are not saved. Leave the page?");

  const buildPayload = useCallback(
    () => ({
      slug: slug.trim(),
      nameUk,
      name: name || nameUk,
      tagline,
      description,
      usage: usage.trim(),
      specifications: customDetails
        .filter(({ key, value }) => key.trim() && value.trim())
        .map(({ key, value }) => ({ key: key.trim(), value: value.trim() })),
      media: images,
      categorySlug: category,
      badge: badgeText || undefined,
      packaging: packaging.trim(),
      components: isSet
        ? components
            .map((c) => ({ productId: c.productId, quantity: Number(c.quantity) }))
            .filter((c) => c.quantity > 0)
        : [],
      price: Number(price),
      promotionalPrice: promotionalPrice === "" ? undefined : Number(promotionalPrice),
      stock: Math.max(0, Number(stock)),
    }),
    [slug, nameUk, name, tagline, description, usage, customDetails, images, category,
     badgeText, packaging, isSet, components, price, promotionalPrice, stock],
  );

  const shownErrors = useMemo<FieldErrors>(() => {
    const raised = Object.keys(errors);
    if (raised.length === 0) return errors;

    const parsed = productSchema.safeParse(buildPayload());
    if (parsed.success) return {};

    const failing = new Set(Object.keys(fieldErrorsFrom(parsed.error)));
    return Object.fromEntries(
      raised.filter((key) => failing.has(key)).map((key) => [key, errors[key as keyof FieldErrors]]),
    ) as FieldErrors;
  }, [errors, buildPayload]);

  const handleSave = async (confirmed = false) => {
    const payload = buildPayload();

    const parsed = productSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = fieldErrorsFrom(parsed.error);
      setErrors(fieldErrors);
      setNotice("Not saved: check the highlighted fields.");
      requestAnimationFrame(() => {
        document
          .querySelector('[data-invalid="true"]')
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    if (!isNew && !confirmed) {
      const changes = moneyChanges(moneySnapshot(price, promotionalPrice, stock), baseline);
      if (changes.length > 0) {
        setErrors({});
        setNotice(null);
        setPendingChanges(changes);
        return;
      }
    }

    setPendingChanges(null);
    setSaving(true);
    setErrors({});
    setNotice(null);

    try {
      const res = await fetch(isNew ? "/api/products" : `/api/products/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { id?: string; error?: string };

      if (!res.ok) {
        setNotice(data.error ?? "The product could not be saved.");
        return;
      }

      setBaseline(moneySnapshot(price, promotionalPrice, stock));
      setCleanState(formState);
      setSaved(true);
      router.push("/admin/products");
    } catch {
      setNotice("Connection failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      {dialog}
      {pendingChanges && (
        <div className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="max-h-[85svh] w-full max-w-md space-y-5 overflow-y-auto border border-neutral-200 bg-white p-6">
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-black">
                Confirm the change to prices and stock
              </h2>
              <p className="text-xs text-ink-2 leading-relaxed">
                These fields decide what the shopper pays and how much can be sold.
                Check that this is what you meant to change.
              </p>
            </div>

            <ul className="border border-neutral-200 divide-y divide-neutral-100">
              {pendingChanges.map((change, index) => (
                <li key={index} className="flex items-baseline justify-between gap-3 p-2.5">
                  <span className="text-[11px] font-semibold text-ink-2">{change.what}</span>
                  <span className="text-xs shrink-0">
                    <span className="text-ink-3 line-through">{change.from}</span>
                    <span className="text-ink-3"> → </span>
                    <span className="font-bold text-black">{change.to}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => void handleSave(true)}
                className="flex-1 bg-black text-white py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Yes, save
              </button>
              <button
                type="button"
                onClick={() => setPendingChanges(null)}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-2 border border-neutral-300 hover:border-black hover:text-black transition-colors cursor-pointer"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-[var(--admin-header-h)] z-30 border-b border-neutral-200 bg-white">
        <div
          className={`mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-4 ${PAGE_GUTTER}`}
        >
          <div className="flex items-center gap-2.5 min-w-0 text-xs sm:text-sm">
            {isNew ? (
              <span className="font-semibold text-black">New product</span>
            ) : (
              <>
                <span className="hidden shrink-0 font-semibold text-black sm:inline">
                  Editing a product
                </span>
                {nameUk && (
                  <>
                    <span className="hidden shrink-0 text-neutral-300 sm:inline" aria-hidden="true">
                      |
                    </span>
                    <span className="truncate font-semibold text-black sm:font-normal sm:text-ink-2">
                      {nameUk}
                    </span>
                  </>
                )}
                {!nameUk && (
                  <span className="font-semibold text-black sm:hidden">Editing a product</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className={`text-sm font-semibold px-5 py-1.5 rounded transition-all cursor-pointer ${
                saved ? "bg-neutral-800 text-white" : "bg-black text-white hover:bg-neutral-800"
              } disabled:opacity-40`}
            >
              {loading
                ? "Loading…"
                : saving
                  ? "Saving…"
                  : saved
                    ? "✓ Saved"
                    : "Save the product"}
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <Toast
          tone="error"
          role="alert"
          offset="calc(var(--admin-header-h) + 3.5rem)"
          onDismiss={() => setNotice(null)}
        >
          {notice}
        </Toast>
      )}

      <div className={`mx-auto w-full max-w-[1600px] ${PAGE_GUTTER} space-y-5 pt-6 pb-8`}>
        <Link
          href="/admin/products"
          className="-mt-1 mb-2 inline-flex items-center gap-2 py-3 text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase transition-colors hover:text-black"
        >
          ← All products
        </Link>


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <MediaUploader
              images={images}
              onChange={setImages}
              max={MAX_PRODUCT_IMAGES}
              error={shownErrors.media}
            />
          </div>
          <div className="lg:col-span-5">
            <Card
              title="Price and availability"
              hint="What it costs and how much is left."
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price, ₴ *" error={shownErrors.price}>
                    <input
                      {...wholeNumberInput}
                      ref={priceRef}
                      value={price}
                      onChange={(e) => {
                        setPrice(digitsOnly(e.target.value));
                        clearError("price");
                      }}
                      placeholder="0"
                      data-invalid={Boolean(shownErrors.price)}
                      className={`${fieldCls(Boolean(shownErrors.price))} sm:max-w-[11rem]`}
                    />
                  </Field>

                  <Field label="Stock, pcs *" error={shownErrors.stock}>
                    <input
                      {...wholeNumberInput}
                      value={stock}
                      onChange={(e) => {
                        setStock(digitsOnly(e.target.value));
                        clearError("stock");
                      }}
                      placeholder="0"
                      data-invalid={Boolean(shownErrors.stock)}
                      className={`${fieldCls(Boolean(shownErrors.stock))} sm:max-w-[11rem]`}
                    />
                  </Field>
                </div>

                {promotionalPrice ? (
                  <Field
                    label="Promotional price, ₴"
                    hint="While it is set, this is what the shopper pays, and the ordinary price is shown struck through."
                    error={shownErrors.promotionalPrice}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        {...wholeNumberInput}
                        value={promotionalPrice}
                        onChange={(e) => {
                          setPromotionalPrice(digitsOnly(e.target.value));
                          clearError("promotionalPrice");
                        }}
                        placeholder="0"
                        autoFocus
                        data-invalid={Boolean(shownErrors.promotionalPrice)}
                        className={cn(fieldCls(Boolean(shownErrors.promotionalPrice)), "w-32 sm:w-auto sm:max-w-[11rem]")}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPromotionalPrice("");
                          clearError("promotionalPrice");
                        }}
                        className="cursor-pointer text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-black hover:decoration-black"
                      >
                        Remove the discount
                      </button>
                    </div>
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!price) {
                        setErrors((prev) => ({
                          ...prev,
                          price: "Give the ordinary price first — the discount is measured from it",
                        }));
                        priceRef.current?.focus();
                        priceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        return;
                      }
                      setPromotionalPrice(price);
                    }}
                    className="w-full cursor-pointer border border-dashed border-neutral-300 px-1.5 py-3 text-[clamp(8.5px,4.2vw_-_5.2px,11px)] font-semibold tracking-[0.08em] whitespace-nowrap text-ink-2 uppercase transition-colors hover:border-black hover:text-black sm:max-w-[11rem] sm:px-4 sm:tracking-[0.14em]"
                  >
                    + Add a discount
                  </button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            <Card
              title="Product"
              hint="What the product is called and at which address it opens."
              headerRight={
                <label className="flex shrink-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSet}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      if (!checked && components.length > 0) {
                        const agreed = await confirm({
                          title: "Clear the set contents?",
                          body: `All ${components.length} items will be removed. The product stops being a set and shows ordinary specifications again.`,
                          confirmLabel: "Clear",
                          destructive: true,
                        });
                        if (!agreed) return;
                        setComponents([]);
                      }
                      setIsSet(checked);
                    }}
                    className="accent-black"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-2">
                    This is a set
                  </span>
                </label>
              }
            >
              <Field label="Product name (Ukrainian) *" error={shownErrors.nameUk}>
                <input
                  type="text"
                  value={nameUk}
                  onChange={(e) => {
                    setNameUk(e.target.value);
                    clearError("nameUk");
                  }}
                  placeholder="Write the product name"
                  data-invalid={Boolean(shownErrors.nameUk)}
                  className={fieldCls(Boolean(shownErrors.nameUk))}
                />
              </Field>
              <Field
                label="Name (Latin) *"
                hint="Shown under the main name"
                error={shownErrors.name}
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearError("name");
                    if (isNew && !slugTouched) {
                      setSlug(slugSuggestion(e.target.value));
                      clearError("slug");
                    }
                  }}
                  placeholder="Write the Latin name"
                  data-invalid={Boolean(shownErrors.name)}
                  className={fieldCls(Boolean(shownErrors.name))}
                />
              </Field>
              <Field
                label="Page address *"
                hint={`Latin, lower case, hyphen separated. Becomes the address: /catalog/${
                  slug || "product-address"
                }`}
                error={shownErrors.slug}
              >
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                    clearError("slug");
                  }}
                  placeholder="product-address"
                  data-invalid={Boolean(shownErrors.slug)}
                  className={fieldCls(Boolean(shownErrors.slug))}
                />
              </Field>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <CategoryCard
              value={category}
              onChange={(slug) => {
                setCategory(slug);
                clearError("categorySlug");
              }}
              error={shownErrors.categorySlug}
            >
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="product-badge"
                    className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.12em]"
                  >
                    Badge
                  </label>
                  <HelpTip>
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-ink-2">
                      These are set automatically and override the manual one
                    </span>
                    <span className="block">
                      <strong className="text-black">Out of stock</strong> — when the product&apos;s
                      stock is 0 pcs
                    </span>
                    <span className="block">
                      <strong className="text-black">Sale</strong> — when the product carries a
                      promotional price.
                    </span>
                  </HelpTip>
                </span>
                <Select
                  id="product-badge"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value as ManualBadge | "")}
                >
                  <option value="">No badge</option>
                  {MANUAL_BADGES.map((b) => (
                    <option key={b} value={b}>
                      {MANUAL_BADGE_LABELS[b]}
                    </option>
                  ))}
                </Select>
              </div>
            </CategoryCard>
          </div>
        </div>

        <Card title="Description" hint="The tagline and the main text on the product page.">
          <Field label="Tagline" hint="A short pulled quote from the description" error={shownErrors.tagline}>
            <input
              type="text"
              value={tagline}
              onChange={(e) => {
                setTagline(e.target.value);
                clearError("tagline");
              }}
              placeholder="What this product brings to mind, in one line"
              data-invalid={Boolean(shownErrors.tagline)}
              className={fieldCls(Boolean(shownErrors.tagline))}
            />
          </Field>
          <Field label="Description *" error={shownErrors.description}>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError("description");
              }}
              rows={5}
              placeholder="A full description: benefits, feel, ingredients, effect…"
              data-invalid={Boolean(shownErrors.description)}
              className={textareaClsFor(Boolean(shownErrors.description))}
            />
          </Field>
        </Card>

        {isSet ? (
          <SetComposition
            components={components}
            onChange={setComponents}
            catalogue={catalogue}
            error={shownErrors.components}
          />
        ) : (
          <SpecificationsEditor specifications={customDetails} onChange={setCustomDetails} />
        )}

        <Card
          title="How to use"
          hint="The order of use, a separate block on the product page."
        >
          <Field label="Directions for use *" error={shownErrors.usage}>
            <textarea
              value={usage}
              onChange={(e) => {
                setUsage(e.target.value);
                clearError("usage");
              }}
              rows={3}
              placeholder="Describe how the product is used…"
              data-invalid={Boolean(shownErrors.usage)}
              className={textareaClsFor(Boolean(shownErrors.usage))}
            />
          </Field>
        </Card>

        <Card
          title="Delivery and packaging"
          hint="Delivery and packaging terms, a separate block on the product page."
        >
          <Field label="How this product is packed and delivered *" error={shownErrors.packaging}>
            <textarea
              value={packaging}
              onChange={(e) => {
                setPackaging(e.target.value);
                clearError("packaging");
              }}
              rows={5}
              placeholder="Describe how this product is packed and delivered…"
              data-invalid={Boolean(shownErrors.packaging)}
              className={textareaClsFor(Boolean(shownErrors.packaging))}
            />
          </Field>
        </Card>

        <div className="space-y-2.5">
          <button
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className={`w-full text-sm font-semibold py-3 transition-all cursor-pointer border ${
              saved
                ? "bg-neutral-800 border-neutral-800 text-white"
                : "bg-black border-black text-white hover:bg-neutral-800"
            } disabled:opacity-40`}
          >
            {loading
              ? "Loading…"
              : saving
                ? "Saving…"
                : saved
                  ? "✓ Saved"
                  : "Save the product"}
          </button>
        </div>
      </div>
    </div>
  );
}

