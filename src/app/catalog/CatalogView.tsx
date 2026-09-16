"use client";

import { useMemo } from "react";
import type { Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import BackToTopButton from "@/components/BackToTopButton";
import { useCatalogFilters } from "@/hooks/useCatalogFilters";

interface CatalogProps {
  products: Product[];
  /** Category metadata list with localized names (§2.4). */
  categoryList: { slug: string; nameUk: string }[];
}

/**
 * Interactive product catalog with search, category filtering, and sorting controls.
 *
 * NOTE: (§2.4, §7.1) Rendered on the server with the full list, then filtered in
 * the browser, so the grid reaches a crawler as markup.
 *
 * MUST NOT: wrap this in `<Suspense>`. Next then drops the subtree from the
 * static render and ships a fallback line in place of every product.
 */
export default function CatalogView({ products, categoryList }: CatalogProps) {
  const categoryLabels = useMemo(
    () => Object.fromEntries(categoryList.map((c) => [c.slug, c.nameUk])),
    [categoryList],
  );

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))],
    [products],
  );

  const {
    filtered,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    isSortOpen,
    setIsSortOpen,
    sortDropdownRef,
    isCategoryOpen,
    setIsCategoryOpen,
    categoryDropdownRef,
    getCategoryCount,
  } = useCatalogFilters(products);

  return (
    <main className="flex-1 bg-white text-black relative w-full">
      <div className="sticky top-[var(--header-h)] z-40 w-full border-b border-neutral-200 bg-white">
        <div className="flex h-14 w-full items-center gap-2.5 px-4 sm:px-8 md:gap-6 md:px-10">
          <h1 className="shrink-0 font-cormorant text-xs font-bold uppercase tracking-[0.14em] text-black min-[380px]:text-sm sm:text-base tablet:border-r tablet:border-line tablet:pr-5 lg:pr-6 lg:text-lg lg:tracking-[0.18em]">
            Collection
          </h1>

          <div className="relative ml-auto hidden tablet:order-3 tablet:block tablet:w-44 lg:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the catalogue…"
              className="h-9 w-full border border-neutral-200 bg-white pl-8 pr-8 font-montserrat text-xs focus:border-black"
            />
            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear the search"
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center text-ink-3 hover:text-black"
              >
                ✕
              </button>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-stretch gap-2 tablet:contents">
            <div className="relative shrink-0" ref={categoryDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                aria-expanded={isCategoryOpen}
                className={`flex h-9 w-full cursor-pointer items-center justify-between gap-1.5 whitespace-nowrap border px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-all min-[380px]:px-3 min-[380px]:tracking-[0.14em] tablet:w-auto tablet:justify-start tablet:gap-2.5 tablet:px-4 tablet:text-[11px] tablet:font-semibold tablet:tracking-[0.2em] ${
                  activeCategory === "all"
                    ? "border-neutral-200 bg-white text-ink-2 hover:border-black hover:text-black tablet:border-neutral-300"
                    : "border-black bg-black text-white"
                }`}
              >
                <span className="max-w-[140px] truncate min-[380px]:max-w-[190px] sm:max-w-none">
                  {activeCategory === "all"
                    ? "Category"
                    : `${categoryLabels[activeCategory] || activeCategory} (${getCategoryCount(activeCategory)})`}
                </span>
                <svg
                  className={`h-3 w-3 shrink-0 transition-transform ${isCategoryOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isCategoryOpen && (
                <ul className="absolute right-0 z-50 mt-2 max-h-[60vh] w-56 max-w-[calc(100vw-3rem)] divide-y divide-neutral-100 overflow-y-auto border border-neutral-200 bg-white py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] animate-in fade-in duration-200 tablet:left-0 tablet:right-auto tablet:w-64">
                  <li
                    onClick={() => {
                      setActiveCategory("all");
                      setIsCategoryOpen(false);
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 ${
                      activeCategory === "all" ? "bg-neutral-50/50 text-black" : "text-ink-3"
                    }`}
                  >
                    <span>All products</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-normal text-ink-3">{getCategoryCount("all")}</span>
                      {activeCategory === "all" && <span className="text-xs font-bold text-black">✓</span>}
                    </span>
                  </li>
                  {categories.map((cat) => {
                    const isActive = activeCategory === cat;
                    return (
                      <li
                        key={cat}
                        onClick={() => {
                          setActiveCategory(cat);
                          setIsCategoryOpen(false);
                        }}
                        className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 ${
                          isActive ? "bg-neutral-50/50 text-black" : "text-ink-3"
                        }`}
                      >
                        <span>{categoryLabels[cat] || cat}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="font-normal text-ink-3">{getCategoryCount(cat)}</span>
                          {isActive && <span className="text-xs font-bold text-black">✓</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="relative hidden shrink-0 tablet:order-4 tablet:block" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                aria-expanded={isSortOpen}
                aria-label="Sorting"
                title="Sorting"
                className={`flex h-9 w-9 cursor-pointer items-center justify-center border transition-all ${
                  isSortOpen || sortBy !== "default"
                    ? "border-black bg-black text-white"
                    : "border-neutral-300 bg-white text-ink-2 hover:border-black hover:text-black"
                }`}
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
                </svg>
              </button>

              {isSortOpen && (
                <ul className="absolute right-0 mt-2 bg-white border border-neutral-200 py-1.5 z-50 text-[10px] font-bold tracking-[0.15em] uppercase w-60 divide-y divide-neutral-100 animate-in fade-in duration-200">
                  <li
                    onClick={() => {
                      setSortBy("default");
                      setIsSortOpen(false);
                    }}
                    className={`px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors flex items-center justify-between ${
                      sortBy === "default" ? "text-black bg-neutral-50/50 font-bold" : "text-ink-3"
                    }`}
                  >
                    <span>RECOMMENDED</span>
                    {sortBy === "default" && <span className="text-black text-xs font-bold">✓</span>}
                  </li>
                  <li
                    onClick={() => {
                      setSortBy("price-asc");
                      setIsSortOpen(false);
                    }}
                    className={`px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors flex items-center justify-between ${
                      sortBy === "price-asc" ? "text-black bg-neutral-50/50 font-bold" : "text-ink-3"
                    }`}
                  >
                    <span>PRICE: LOW TO HIGH</span>
                    {sortBy === "price-asc" && <span className="text-black text-xs font-bold">✓</span>}
                  </li>
                  <li
                    onClick={() => {
                      setSortBy("price-desc");
                      setIsSortOpen(false);
                    }}
                    className={`px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors flex items-center justify-between ${
                      sortBy === "price-desc" ? "text-black bg-neutral-50/50 font-bold" : "text-ink-3"
                    }`}
                  >
                    <span>PRICE: HIGH TO LOW</span>
                    {sortBy === "price-desc" && <span className="text-black text-xs font-bold">✓</span>}
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="w-full px-3.5 py-5 sm:px-8 sm:py-7 md:px-10 lg:py-14">
        <div className="grid grid-cols-2 tablet:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-5 md:gap-6 items-stretch">
          {filtered.map((product) => (
            <div key={product.id} className="h-full flex flex-col">
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-24 text-center border border-black space-y-3">
            <p className="font-[family-name:var(--font-tenor-sans)] text-2xl font-bold uppercase">
              NO PRODUCTS FOUND
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">
              Loosen the filters or pick another category.
            </p>
            {(searchQuery || activeCategory !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setSearchQuery("");
                }}
                className="mt-4 text-xs font-bold uppercase tracking-wider text-black border border-black px-4 py-2 hover:bg-black hover:text-white transition-all cursor-pointer"
              >
                Reset the search
              </button>
            )}
          </div>
        )}
      </section>

      <BackToTopButton />
    </main>
  );
}

