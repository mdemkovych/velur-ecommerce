"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Field, fieldCls, Notice, Select } from "../../ui";
import { categorySchema } from "@/lib/validation";

/**
 * Category picker and creation/renaming modal card for product editor.
 *
 * NOTE: (§2.4, §8.1) Manages category slugs, localized Ukrainian names, and fallback options.
 */
export function CategoryCard({
  value,
  onChange,
  error,
  children,
}: {
  /** The chosen category's Latin name, or "" before the product has loaded. */
  value: string;
  onChange: (slug: string) => void;
  error?: string;
  children?: React.ReactNode;
}) {
  const [categoriesList, setCategoriesList] = useState<{ id: string; nameUk: string }[]>([]);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatNameUk, setNewCatNameUk] = useState("");
  const [newCatId, setNewCatId] = useState("");
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameSlug, setRenameSlug] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((rows: { slug: string; nameUk: string }[]) =>
        setCategoriesList(rows.map((c) => ({ id: c.slug, nameUk: c.nameUk }))),
      )
      .catch(() => setCategoriesList([]));
  }, []);

  const options = useMemo(
    () =>
      value && !categoriesList.some((c) => c.id === value)
        ? [...categoriesList, { id: value, nameUk: value }]
        : categoriesList,
    [categoriesList, value],
  );

  const handleAddNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryBusy) return;

    const slug = newCatId
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!slug) {
      setCategoryNotice("Give a Latin name — the catalogue filters by it.");
      return;
    }

    const payload = { slug, nameUk: newCatNameUk.trim() };

    const parsed = categorySchema.safeParse(payload);
    if (!parsed.success) {
      setCategoryNotice(parsed.error.issues[0]?.message ?? "Malformed category data");
      return;
    }

    setCategoryBusy(true);
    setCategoryNotice(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { slug?: string; nameUk?: string; error?: string };
      if (!res.ok || !data.slug) {
        setCategoryNotice(data.error ?? "The category could not be created.");
        return;
      }

      const created = { id: data.slug, nameUk: data.nameUk ?? parsed.data.nameUk };
      setCategoriesList((prev) => [...prev.filter((c) => c.id !== created.id), created]);
      onChange(created.id);
      setNewCatNameUk("");
      setNewCatId("");
      setShowAddCatModal(false);
    } catch {
      setCategoryNotice("Connection failed. Try again.");
    } finally {
      setCategoryBusy(false);
    }
  };

  const handleRenameCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingCat || categoryBusy) return;

    const nameUk = renameValue.trim();
    if (nameUk.length < 2) {
      setCategoryNotice("Enter a category name");
      return;
    }

    const slug = renameSlug.trim();
    if (!slug) {
      setCategoryNotice("Give a Latin name — the catalogue filters by it.");
      return;
    }

    setCategoryBusy(true);
    setCategoryNotice(null);
    try {
      const res = await fetch(`/api/categories/${renamingCat}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameUk, slug }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setCategoryNotice(data.error ?? "The category could not be renamed.");
        return;
      }
      setCategoriesList((prev) =>
        prev.map((c) => (c.id === renamingCat ? { id: slug, nameUk } : c)),
      );
      if (value === renamingCat) onChange(slug);
      setRenamingCat(null);
    } catch {
      setCategoryNotice("Connection failed. Try again.");
    } finally {
      setCategoryBusy(false);
    }
  };

  return (
    <Card
      title="Category"
      hint="The catalogue section used for filtering."
      headerRight={
        <button
          type="button"
          onClick={() => {
            setShowAddCatModal(true);
            setRenamingCat(null);
            setCategoryNotice(null);
          }}
          className="text-[10px] font-bold uppercase tracking-wider bg-black text-white px-2.5 py-1 hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          + New category
        </button>
      }
    >
      {showAddCatModal ? (
        <form onSubmit={handleAddNewCategory} className="space-y-3">
          <Field label="Category name *" hint="This is what a shopper sees in the catalogue">
            <input
              type="text"
              value={newCatNameUk}
              onChange={(e) => setNewCatNameUk(e.target.value)}
              placeholder="Hair care"
              className={fieldCls()}
              autoFocus
            />
          </Field>
          <Field
            label="Latin name *"
            hint="Forms the section address: /catalog/category/hair-care"
          >
            <input
              type="text"
              value={newCatId}
              onChange={(e) =>
                setNewCatId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
              placeholder="hair-care"
              className={fieldCls()}
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={categoryBusy}
              className="flex-1 bg-black text-white py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-40"
            >
              {categoryBusy ? "Creating…" : "Create the category"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddCatModal(false);
                setCategoryNotice(null);
              }}
              className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-2 hover:text-black cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : renamingCat === value && value ? (
        <form onSubmit={handleRenameCategory} className="space-y-3">
          <Field label="Category name *" hint="This is what a shopper sees in the catalogue">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className={fieldCls()}
              autoFocus
            />
          </Field>
          <Field
            label="Latin name *"
            hint="Forms the section address. Change it and the old address stops opening, including in search results."
          >
            <input
              type="text"
              value={renameSlug}
              onChange={(e) =>
                setRenameSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
              className={fieldCls()}
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={categoryBusy}
              className="flex-1 bg-black text-white py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-40"
            >
              {categoryBusy ? "Saving…" : "Save the name"}
            </button>
            <button
              type="button"
              onClick={() => setRenamingCat(null)}
              className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-2 hover:text-black cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <Field label="Catalogue section *" error={error}>
            <Select
              value={value}
              hasError={Boolean(error)}
              onChange={(e) => onChange(e.target.value)}
            >
              {options.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nameUk} ({cat.id})
                </option>
              ))}
            </Select>
          </Field>

          {value && (
            <button
              type="button"
              onClick={() => {
                setRenamingCat(value);
                setRenameValue(categoriesList.find((c) => c.id === value)?.nameUk ?? "");
                setRenameSlug(value);
                setCategoryNotice(null);
              }}
              className="text-[10px] font-semibold uppercase tracking-wider text-ink-2 hover:text-black transition-colors cursor-pointer"
            >
              Rename this category
            </button>
          )}
        </div>
      )}

      {categoryNotice && <Notice>{categoryNotice}</Notice>}

      {children}
    </Card>
  );
}

