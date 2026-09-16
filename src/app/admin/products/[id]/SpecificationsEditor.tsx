"use client";

import { useRef } from "react";
import { Card } from "@/app/admin/ui";

export interface SpecDraft {
  /** Stable React key. Not sent to the server. */
  id: string;
  key: string;
  value: string;
}

/** Generates empty specification draft item. */
export function emptySpec(key = ""): SpecDraft {
  return { id: `s-${Math.random().toString(36).slice(2)}`, key, value: "" };
}

interface Props {
  specifications: SpecDraft[];
  onChange: (specifications: SpecDraft[]) => void;
}

/**
 * Product specifications and characteristics key-value editor component.
 *
 * NOTE: (§2.4, §8.1) Preserves editorial key-value order in product JSONB document specifications.
 */
export function SpecificationsEditor({ specifications, onChange }: Props) {
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= specifications.length || from === to) return;
    const next = [...specifications];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const handleDragEnd = () => {
    const from = dragItem.current;
    const to = dragOver.current;
    dragItem.current = null;
    dragOver.current = null;
    if (from !== null && to !== null) move(from, to);
  };

  const update = (index: number, field: "key" | "value", value: string) =>
    onChange(specifications.map((pair, i) => (i === index ? { ...pair, [field]: value } : pair)));

  const remove = (index: number) => onChange(specifications.filter((_, i) => i !== index));

  return (
    <Card
      title="Specifications and ingredients"
      hint="Name and value pairs, in the order a shopper will see them. Enter inside a value starts a new line."
    >
      <div className="space-y-3">
        {specifications.map((pair, index) => (
          <div
            key={pair.id}
            draggable
            onDragStart={() => {
              dragItem.current = index;
            }}
            onDragEnter={() => {
              dragOver.current = index;
            }}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col gap-2 border border-neutral-200 bg-neutral-50 p-2.5 transition-all hover:border-neutral-400 sm:flex-row sm:items-start sm:gap-2 sm:cursor-move group/char"
          >
            <div className="flex w-full shrink-0 select-none items-center justify-between gap-1 text-ink-3 sm:w-auto sm:justify-start">
            <div className="flex items-center gap-1">
              <span
                className="text-xs text-ink-3 font-mono tracking-tighter px-0.5 cursor-grab"
                title="Drag to reorder"
              >
                ⋮⋮
              </span>
              <div className="flex items-center gap-0.5 text-[9px] leading-none sm:flex-col">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    move(index, index - 1);
                  }}
                  className="flex h-11 w-11 cursor-pointer items-center justify-center font-bold hover:text-black disabled:opacity-20 sm:h-auto sm:w-auto sm:p-0.5"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === specifications.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    move(index, index + 1);
                  }}
                  className="flex h-11 w-11 cursor-pointer items-center justify-center font-bold hover:text-black disabled:opacity-20 sm:h-auto sm:w-auto sm:p-0.5"
                  title="Move down"
                >
                  ▼
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => remove(index)}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-sm text-ink-3 transition-colors hover:bg-red-50 hover:text-red-500 sm:hidden"
              title="Delete specification"
            >
              ✕
            </button>
            </div>

            <div className="w-full sm:w-1/3 sm:min-w-[120px]">
              <input
                type="text"
                value={pair.key}
                onChange={(e) => update(index, "key", e.target.value)}
                placeholder="Field name"
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-base font-semibold text-black focus:border-black sm:text-xs"
              />
            </div>
            <div className="flex-1">
              <textarea
                value={pair.value}
                onChange={(e) => update(index, "value", e.target.value)}
                rows={1}
                placeholder="Value"
                className="w-full resize-y border border-neutral-300 bg-white px-3 py-2 text-base text-black [field-sizing:content] focus:border-black sm:text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              className="hidden h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-sm text-ink-3 transition-colors hover:bg-red-50 hover:text-red-500 sm:flex"
              title="Delete specification"
            >
              ✕
            </button>
          </div>
        ))}

        {specifications.length === 0 && (
          <div className="border-2 border-dashed border-neutral-200 py-6 text-center text-xs text-ink-3">
            Press «+ Add a specification»
          </div>
        )}

        <button
          type="button"
          onClick={() => onChange([...specifications, emptySpec()])}
          className="min-h-11 w-full cursor-pointer border border-dashed border-neutral-300 px-4 text-[11px] font-semibold tracking-[0.14em] text-ink-2 uppercase transition-colors hover:border-black hover:text-black"
        >
          + Add a specification
        </button>
      </div>
    </Card>
  );
}

