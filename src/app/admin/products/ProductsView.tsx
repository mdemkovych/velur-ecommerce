"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { AdminProduct } from "@/lib/types";
import { hintCls, Icon, inputCls, Notice, PageBody, PageHeader, Select } from "../ui";
import { useConfirm } from "../useConfirm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";

/**
 * Catalogue management view for reordering, filtering, soft-hiding, and permanently deleting products.
 *
 * NOTE: (§8.1, §8.4) Provides drag-free card reordering with unsaved changes confirmation guards.
 */
export function ProductsView({
  initialProducts,
  initialCategories,
}: {
  initialProducts: AdminProduct[];
  initialCategories: { slug: string; nameUk: string }[];
}) {
  const { confirm, dialog } = useConfirm();
  const [products, setProducts] = useState<AdminProduct[] | null>(initialProducts);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [showHidden, setShowHidden] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [categories, setCategories] =
    useState<{ slug: string; nameUk: string }[]>(initialCategories);

  const [savedOrder, setSavedOrder] = useState<string[] | null>(
    initialProducts.map((p) => p.id),
  );
  const [savingOrder, setSavingOrder] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (reloadKey === 0) return;

    let cancelled = false;
    Promise.all([
      fetch("/api/products").then((res) => res.json()),
      fetch("/api/categories").then((res) => res.json()),
    ])
      .then(([productRows, categoryRows]) => {
        if (cancelled) return;
        const rows = productRows as AdminProduct[];
        setProducts(rows);
        setSavedOrder(rows.map((p) => p.id));
        setCategories(categoryRows as { slug: string; nameUk: string }[]);
      })
      .catch((err) => {
        console.error("Failed to load products:", err);
        if (!cancelled) setProducts([]);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const orderIsDirty =
    savedOrder !== null &&
    products !== null &&
    products.map((p) => p.id).join(",") !== savedOrder.join(",");

  useUnsavedChangesGuard(orderIsDirty, "The catalogue order is not saved. Leave the page?");

  const handleDeleteForever = async (product: AdminProduct) => {
    const agreed = await confirm({
      title: "Delete for good?",
      body: `«${product.nameUk}» will be gone from the database for good, and that cannot be undone. If it has been ordered before, it stays hidden instead.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!agreed) return;

    try {
      const res = await fetch(`/api/products/${product.id}?forever=true`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setNotice(data?.error ?? "The product could not be deleted.");
        return;
      }
      setProducts((prev) => (prev ?? []).filter((x) => x.id !== product.id));
      setNotice(null);
    } catch {
      setNotice("Connection failed. Try again.");
    }
  };

  const moveProduct = (product: AdminProduct, direction: -1 | 1) => {
    const visible = filteredProducts;
    const visibleIndex = visible.findIndex((x) => x.id === product.id);
    const neighbour = visible[visibleIndex + direction];
    if (!neighbour) return;

    setProducts((prev) => {
      const next = [...(prev ?? [])];
      const from = next.findIndex((x) => x.id === product.id);
      const to = next.findIndex((x) => x.id === neighbour.id);
      if (from < 0 || to < 0) return prev;
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    setNotice(null);
  };

  const saveOrder = async () => {
    const ids = (products ?? []).map((p) => p.id);
    setSavingOrder(true);
    setNotice(null);
    try {
      const res = await fetch("/api/products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice(data?.error ?? "The order could not be saved.");
        return;
      }
      setSavedOrder(ids);
    } catch {
      setNotice("Connection failed. The order was not saved.");
    } finally {
      setSavingOrder(false);
    }
  };

  const discardOrder = () => {
    if (!savedOrder) return;
    setProducts((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.map((p) => [p.id, p]));
      const restored = savedOrder.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
      const rest = prev.filter((p) => !savedOrder.includes(p.id));
      return [...restored, ...rest];
    });
    setNotice(null);
  };

  const handleToggleVisibility = async (product: AdminProduct) => {
    const hide = !product.isDeleted;
    if (
      hide &&
      !(await confirm({
        title: "Hide the product?",
        body: `«${product.nameUk}» will leave the catalogue but stay in the database, because old orders point at it. You can bring it back at any time.`,
        confirmLabel: "Hide",
      }))
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/products/${product.id}${hide ? "" : "?restore=true"}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice(data?.error ?? (hide ? "The product could not be hidden." : "The product could not be restored."));
        return;
      }
      setNotice(null);
      reload();
    } catch (err) {
      console.error(err);
      setNotice("Connection failed. Try again.");
    }
  };

  const filteredProducts = (products ?? []).filter((p) => {
    if (p.isDeleted !== showHidden) return false;
    const matchesCategory = productCategoryFilter === "all" || p.category === productCategoryFilter;
    const q = productSearchQuery.toLowerCase().trim();
    if (!q) return matchesCategory;
    const haystack = [p.nameUk, p.name, p.tagline, p.description, p.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesCategory && haystack.includes(q);
  });

  return (
    <PageBody className="space-y-8">
      {dialog}
      {orderIsDirty && (
        <div className="sticky top-[var(--admin-header-h)] z-30 -mx-4 -mt-10 border-b border-neutral-200 bg-white px-4 sm:-mx-10 sm:-mt-14 sm:px-10">
          <div className="flex min-h-14 items-center justify-between gap-3 py-2.5">
            <p className="min-w-0 truncate text-xs text-ink-2">Order changed</p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void saveOrder()}
                disabled={savingOrder}
                className="min-h-9 cursor-pointer border border-black bg-black px-4 text-[11px] font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-ink-3"
              >
                {savingOrder ? (
                  "Saving…"
                ) : (
                  <>
                    <span className="sm:hidden">Save</span>
                    <span className="hidden sm:inline">Save the order</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={discardOrder}
                disabled={savingOrder}
                className="min-h-9 cursor-pointer px-2 text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase transition-colors hover:text-black disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-6 animate-in fade-in duration-200">
        <PageHeader
          title="Catalogue"
          hint="Everything a shopper sees on the site. The cards stand here in the same order as in the catalogue: the arrows on a photograph move a product, and a button appears above to save the change. A product that has been ordered can only be hidden, because old orders point at it. One nobody has bought is deleted outright."
        />
        <div className="bg-white border border-neutral-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-montserrat text-sm font-bold uppercase tracking-wider text-black">
              Product catalogue
            </h2>
            <Link
              href="/admin/products/new"
              aria-label="Add a product"
              className="min-h-11 shrink-0 bg-black px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-white uppercase transition-all hover:bg-neutral-800 sm:min-h-0 flex items-center"
            >
              <span className="min-[400px]:hidden">+ Product</span>
              <span className="hidden min-[400px]:inline">+ Add a product</span>
            </Link>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Search by name or description"
                className={`${inputCls} pl-9`}
              />
              <svg
                className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {productSearchQuery && (
                <button
                  type="button"
                  onClick={() => setProductSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-black text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2.5 min-[360px]:flex-row min-[360px]:items-stretch sm:contents">
            <div className="min-w-0 flex-1 sm:w-56 sm:flex-none sm:shrink-0">
              <Select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
              >
                {[{ slug: "all", nameUk: "All categories" }, ...categories].map((cat) => {
                  const scope = (products ?? []).filter((p) => p.isDeleted === showHidden);
                  const count =
                    cat.slug === "all"
                      ? scope.length
                      : scope.filter((p) => p.category === cat.slug).length;
                  return (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.nameUk} ({count})
                    </option>
                  );
                })}
              </Select>
            </div>

            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              aria-label={showHidden ? "To active products" : "Hidden products"}
              className={`min-h-11 shrink-0 whitespace-nowrap border px-3 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer min-[375px]:px-4.5 sm:min-h-0 ${
                showHidden
                  ? "bg-black text-white border-black"
                  : "bg-white text-ink-2 border-neutral-300 hover:border-black hover:text-black"
              }`}
            >
              {showHidden ? (
                <>
                  <span className="sm:hidden">← Active</span>
                  <span className="hidden sm:inline">← To active</span>
                </>
              ) : (
                "Hidden"
              )}
            </button>
            </div>
          </div>

          <p className={hintCls}>
            {showHidden ? (
              <>
                <span className="sm:hidden">Not shown to shoppers.</span>
                <span className="hidden sm:inline">
                  These products are not shown to shoppers but stay in the database,
                  because old orders point at them.
                </span>
              </>
            ) : (
              `Showing ${filteredProducts.length} of ${(products ?? []).length}.`
            )}
          </p>
        </div>

        {notice && <Notice>{notice}</Notice>}

        {filteredProducts.length === 0 ? (
          <div className="border border-neutral-200 bg-white px-6 py-12 text-center sm:py-16">
            <p className="text-sm font-bold uppercase tracking-wider text-black">Nothing found</p>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-balance text-ink-2">
              Try a different search or another category
            </p>
            <button
              type="button"
              onClick={() => {
                setProductSearchQuery("");
                setProductCategoryFilter("all");
              }}
              className="mt-6 -mb-3 inline-flex min-h-11 cursor-pointer items-center justify-center px-2 text-xs font-bold text-black underline underline-offset-4 transition-colors hover:text-ink-2"
            >
              Reset the filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((p, index) => (
              <div
                key={p.id}
                className="group relative flex flex-col overflow-hidden border border-neutral-200 bg-white transition-colors hover:border-black focus-within:border-black"
              >
                <div className="relative aspect-[4/5] shrink-0 overflow-hidden bg-photo-bg">
                  <Image
                    src={primaryMedia(p.image)}
                    alt={p.nameUk}
                    fill
                    className={`object-cover ${p.isDeleted ? "grayscale opacity-50" : ""}`}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    quality={IMAGE_QUALITY}
                  />

                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                    <span className="text-[11px] font-medium tracking-[0.06em] text-ink-2">
                      {p.categoryNameUk}
                    </span>

                    {!showHidden && (
                      <span className="pointer-events-auto z-20 flex shrink-0 gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveProduct(p, -1)}
                          aria-label={`Show «${p.nameUk}» earlier`}
                          title="Show earlier"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center border border-neutral-300 bg-white/85 text-xs font-bold text-ink-2 backdrop-blur-[2px] transition-colors hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-neutral-300 disabled:hover:text-ink-2"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={index === filteredProducts.length - 1}
                          onClick={() => moveProduct(p, 1)}
                          aria-label={`Show «${p.nameUk}» later`}
                          title="Show later"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center border border-neutral-300 bg-white/85 text-xs font-bold text-ink-2 backdrop-blur-[2px] transition-colors hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-neutral-300 disabled:hover:text-ink-2"
                        >
                          →
                        </button>
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/admin/products/${p.id}`}
                    aria-label={`Edit «${p.nameUk}»`}
                    className="group/edit absolute inset-0 z-10 flex cursor-pointer items-center justify-center after:absolute after:inset-0 after:content-['']"
                  >
                    <span className="flex h-11 w-11 items-center justify-center bg-black/45 text-white/90 backdrop-blur-[2px] transition-colors group-hover/edit:bg-black group-hover/edit:text-white">
                      <Icon name="pencil" className="h-5 w-5" />
                    </span>
                  </Link>
                </div>

                <div className="flex flex-1 flex-col justify-between gap-3 px-3.5 pb-4 pt-3 sm:px-4">
                  <div>
                    <h3 className="font-montserrat line-clamp-2 text-xs font-medium leading-snug text-black sm:text-sm">
                      {p.nameUk}
                    </h3>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <span className="font-montserrat text-xs font-semibold text-neutral-900 sm:text-sm">
                        {p.price} ₴
                      </span>
                      <span className="font-montserrat shrink-0 text-xs text-ink-2">
                        qty: {p.stock}
                      </span>
                    </div>
                  </div>

                  {p.isDeleted ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleVisibility(p)}
                      className="relative z-10 w-full cursor-pointer border border-neutral-300 bg-white py-2 text-[11px] font-bold tracking-wider text-ink-2 uppercase transition-all hover:border-black hover:text-black"
                    >
                      Restore
                    </button>
                  ) : p.hasOrders ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleVisibility(p)}
                      title="This product has been ordered, so it can only be hidden"
                      className="relative z-10 w-full cursor-pointer border border-neutral-300 bg-white py-2 text-[11px] font-bold tracking-wider text-ink-2 uppercase transition-all hover:border-black hover:text-black"
                    >
                      Hide
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleDeleteForever(p)}
                      title="This product has not been ordered, so it can be deleted outright"
                      className="relative z-10 w-full cursor-pointer border border-neutral-300 bg-white py-2 text-[11px] font-bold tracking-wider text-ink-2 uppercase transition-all hover:border-red-600 hover:bg-red-600 hover:text-white"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageBody>
  );
}

