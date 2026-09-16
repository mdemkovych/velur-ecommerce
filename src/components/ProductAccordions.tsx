"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";
import type { ProductComponentView, SpecPair } from "@/lib/types";

interface ProductAccordionsProps {
  description: string;
  tagline: string;
  /** Ordered pairs — the manager's order is editorial and must be preserved. */
  specifications: SpecPair[];
  /**
   * Set components breakdown when product is a set.
   *
   * NOTE: (§2.3) When present, replaces standard ingredients/characteristics tab.
   */
  components?: ProductComponentView[];
  /** Usage directions; absent section omitted. */
  usage: string;
  /** Packaging and delivery information. */
  packaging: string;
}

interface AccordionItemProps {
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

/** Reusable accordion panel with animated CSS grid height transition. */
function AccordionItem({ id, label, isOpen, onToggle, children }: AccordionItemProps) {
  return (
    <div className="border-b border-neutral-200">
      <button
        onClick={() => onToggle(id)}
        className="w-full py-4 flex items-center justify-between text-left cursor-pointer group"
      >
        <span
          className={cn(
            "text-xs font-bold tracking-[0.2em] uppercase transition-colors",
            isOpen ? "text-black" : "text-ink-3 group-hover:text-black"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-sm font-bold w-6 text-right transition-transform duration-300",
            isOpen ? "text-black" : "text-ink-3 group-hover:text-black"
          )}
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out overflow-hidden",
          isOpen ? "grid-rows-[1fr] opacity-100 pb-5" : "grid-rows-[0fr] opacity-0 pb-0"
        )}
      >
        <div className="min-h-0">{children}</div>
      </div>
    </div>
  );
}

/**
 * Product detail accordion section renderer for descriptions, composition/sets, usage, and shipping terms.
 *
 * NOTE: (§2.3) Renders set component breakdown when present, falling back to specs/ingredients.
 */
export default function ProductAccordions({
  description,
  tagline,
  specifications,
  components = [],
  usage,
  packaging,
}: ProductAccordionsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    details: true,
  });

  const handleToggle = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const usageText = usage.trim();

  const sections: { id: string; title: string; body: React.ReactNode }[] = [
    {
      id: "details",
      title: "PRODUCT DESCRIPTION",
      body: (
        <div className="space-y-4 text-sm font-normal leading-[1.8] text-ink-2">
          {tagline && (
            <div className="p-4 bg-neutral-50 border-l-2 border-black">
              <p className="font-cormorant text-base sm:text-lg italic text-black font-medium">
                &ldquo;{tagline}&rdquo;
              </p>
            </div>
          )}
          <p className="whitespace-pre-line">{description}</p>
        </div>
      ),
    },
    components.length > 0
      ? {
          id: "specs",
          title: "WHAT IS IN THE SET",
          body: (
            <ul className="divide-y divide-neutral-100">
              {components.map((item) => (
                <li key={item.productId}>
                  <Link
                    href={`/catalog/${item.slug}`}
                    className="flex items-center gap-3 py-2.5 transition-opacity hover:opacity-70"
                  >
                    <span className="relative h-14 w-11 shrink-0 overflow-hidden bg-photo-bg">
                      <Image
                        src={primaryMedia(item.image)}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                        quality={IMAGE_QUALITY}
                      />
                    </span>
                    <span className="font-montserrat min-w-0 flex-1 truncate text-sm text-black">
                      {item.nameUk}
                    </span>
                    {item.quantity > 1 && (
                      <span className="font-montserrat shrink-0 text-xs text-ink-3">
                        {item.quantity} pcs
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ),
        }
      : {
          id: "specs",
          title: "SPECIFICATIONS AND INGREDIENTS",
          body: (
            <dl className="divide-y divide-neutral-100 border-t border-neutral-100">
              {specifications.map(({ key, value }) => {
                const lines = value
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean);
                const isList = lines.length > 1;

                return (
                  <div key={key} className="py-3">
                    <dt className="font-montserrat text-[10px] font-semibold tracking-[0.18em] text-ink-3 uppercase">
                      {key}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-black">
                      {isList ? (
                        <ul className="space-y-1">
                          {lines.map((line, idx) => (
                            <li key={idx} className="-indent-4 pl-4 leading-relaxed">
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ),
        },
    ...(usageText
      ? [
          {
            id: "usage",
            title: "HOW TO USE",
            body: (
              <p className="text-sm font-normal leading-[1.8] whitespace-pre-line text-ink-2">
                {usageText}
              </p>
            ),
          },
        ]
      : []),
    {
      id: "shipping",
      title: "DELIVERY AND PACKAGING",
      body: (
        <div className="space-y-2 text-sm font-normal leading-[1.8] text-ink-2">
          <p className="whitespace-pre-line">{packaging}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="mt-10 border-t border-neutral-200">
      {sections.map((section, index) => (
        <AccordionItem
          key={section.id}
          id={section.id}
          label={`${String(index + 1).padStart(2, "0")} — ${section.title}`}
          isOpen={!!openSections[section.id]}
          onToggle={handleToggle}
        >
          {section.body}
        </AccordionItem>
      ))}
    </div>
  );
}

