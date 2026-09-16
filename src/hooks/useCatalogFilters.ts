"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { chargedPrice, type Product } from "@/lib/types";

export type SortOption = "default" | "price-asc" | "price-desc";

interface UseCatalogFiltersResult {
  filtered: Product[];
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  isSortOpen: boolean;
  setIsSortOpen: (open: boolean) => void;
  sortDropdownRef: React.RefObject<HTMLDivElement | null>;
  isCategoryOpen: boolean;
  setIsCategoryOpen: (open: boolean) => void;
  categoryDropdownRef: React.RefObject<HTMLDivElement | null>;
  getCategoryCount: (cat: string) => number;
}

interface Filters {
  category: string;
  query: string;
}

/** Parses the shareable part of the filter state out of a query string. */
function parseSearch(search: string): Filters {
  const params = new URLSearchParams(search);
  return { category: params.get("category") || "all", query: params.get("q") || "" };
}

function subscribeToUrl(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const readSearch = () => window.location.search;

/** The server has no address bar, so it renders the catalogue unfiltered. */
const readServerSearch = () => "";

/**
 * Manages category filtering, search queries, and price sorting, mirroring the
 * shareable part of that state into the query string.
 *
 * NOTE: (§7.1) The server render is deliberately unfiltered; an incoming
 * `?category=` is applied once the browser can read it.
 *
 * MUST NOT: read the filters with `useSearchParams`. That hook opts its whole
 * Suspense boundary out of the prerender, which leaves the catalogue's server
 * HTML holding a loading line and no product, name, price or link for a crawler
 * to follow — the shop's most valuable page, invisible, with nothing failing.
 */
export function useCatalogFilters(productList: Product[]): UseCatalogFiltersResult {
  const router = useRouter();

  // An incoming link may carry filters, and only the browser can read them.
  // `useSyncExternalStore` is what lets the server render one answer and the
  // browser correct it, instead of the two disagreeing during hydration.
  const search = useSyncExternalStore(subscribeToUrl, readSearch, readServerSearch);
  const linked = useMemo(() => parseSearch(search), [search]);

  // What the visitor picked outranks the link that brought them here: the
  // address bar is written through the router and does not echo back in time
  // for the next keystroke.
  const [chosen, setChosen] = useState<Filters | null>(null);
  const { category: activeCategory, query: searchQuery } = chosen ?? linked;

  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [isSortOpen, setIsSortOpen] = useState<boolean>(false);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);

  // Outside click listener for sort and category dropdown menus.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setIsSortOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) {
        setIsCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const apply = (next: Filters) => {
    setChosen(next);
    const params = new URLSearchParams();
    if (next.category && next.category !== "all") {
      params.set("category", next.category);
    }
    if (next.query.trim()) {
      params.set("q", next.query.trim());
    }
    const queryString = params.toString();
    router.replace(`/catalog${queryString ? `?${queryString}` : ""}`, { scroll: false });
  };

  const setActiveCategory = (cat: string) => apply({ category: cat, query: searchQuery });

  const setSearchQuery = (q: string) => apply({ category: activeCategory, query: q });

  const getCategoryCount = useCallback(
    (cat: string): number => {
      if (cat === "all") return productList.length;
      return productList.filter((p) => p.category === cat).length;
    },
    [productList]
  );

  const filtered = useMemo(() => {
    let result = activeCategory === "all"
      ? [...productList]
      : productList.filter((p) => p.category === activeCategory);

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((p) => {
        const matchesNameUk = p.nameUk ? p.nameUk.toLowerCase().includes(q) : false;
        const matchesName = p.name ? p.name.toLowerCase().includes(q) : false;
        const matchesTagline = p.tagline ? p.tagline.toLowerCase().includes(q) : false;
        const matchesDesc = p.description ? p.description.toLowerCase().includes(q) : false;
        return matchesNameUk || matchesName || matchesTagline || matchesDesc;
      });
    }

    if (sortBy === "price-asc") result.sort((a, b) => chargedPrice(a) - chargedPrice(b));
    if (sortBy === "price-desc") result.sort((a, b) => chargedPrice(b) - chargedPrice(a));
    return result;
  }, [productList, activeCategory, searchQuery, sortBy]);

  return {
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
  };
}
