"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, Icon, Notice, PageBody, PageHeader } from "../ui";
import { useConfirm } from "../useConfirm";
import { primaryMedia, IMAGE_QUALITY } from "@/lib/media";
import { BANNER_PHOTO_COUNT, MAX_ACTIVE_BANNERS, type Banner } from "@/lib/types";

/**
 * Hero banner management dashboard listing configured rotators.
 *
 * NOTE: (§8.3) Supports active state toggle, reordering up/down, deletion, and edit navigation.
 */
export default function AdminBannersPage() {
  const { confirm, dialog } = useConfirm();
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/banners")
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as Banner[];
      })
      .then(setBanners)
      .catch(() => {
        setError("The banners could not be loaded.");
        setBanners([]);
      });
  }, []);

  const reload = async () => {
    const res = await fetch("/api/banners");
    if (res.ok) setBanners((await res.json()) as Banner[]);
  };

  async function send(id: string, init: RequestInit, failure: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/banners/${id}`, init);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? failure);
        return;
      }
      await reload();
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (b: Banner) =>
    send(
      b.id,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...b, isActive: !b.isActive }),
      },
      "The banner could not be changed.",
    );

  const move = (b: Banner, direction: "up" | "down") =>
    send(
      b.id,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move: direction }),
      },
      "The banner could not be moved.",
    );

  const remove = async (b: Banner) => {
    const agreed = await confirm({
      title: "Delete the banner?",
      body: `«${b.title}» will leave the list and its photographs will be erased from storage. That cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!agreed) return;
    return send(b.id, { method: "DELETE" }, "The banner could not be deleted.");
  };

  const active = banners?.filter((b) => b.isActive).length ?? 0;

  return (
    <PageBody className="space-y-8">
      {dialog}
      <PageHeader
        title="Banners"
        hint={`Every banner is ${BANNER_PHOTO_COUNT} photographs: a desktop shows all three, a tablet the first two, a phone only the first.`}
      />

      {error && <Notice kind="error">{error}</Notice>}

      <Card
        title="List"
        hint={`${active} of ${MAX_ACTIVE_BANNERS} switched on. A switched-off banner stays here but does not appear on the site.`}
        headerRight={
          <Link
            href="/admin/banners/new"
            className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center bg-black px-3 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-neutral-800 sm:px-4"
          >
            <span className="min-[400px]:hidden">+ Banner</span>
            <span className="hidden min-[400px]:inline">+ Add a banner</span>
          </Link>
        }
      >
        {banners === null && <p className="py-6 text-sm text-ink-2">Loading…</p>}

        {banners?.length === 0 && (
          <p className="py-6 text-sm text-ink-2">
            There are no banners — the first screen of the home page is empty.
          </p>
        )}

        <ul className="divide-y divide-neutral-100">
          {banners?.map((b, idx) => (
            <li
              key={b.id}
              className="relative flex items-start gap-2.5 py-4 transition-colors hover:bg-neutral-50/70 sm:gap-3"
            >
              <div className="flex h-24 shrink-0 flex-col items-center justify-center gap-0.5">
                <button
                  type="button"
                  disabled={busy || idx === 0}
                  onClick={() => void move(b, "up")}
                  className="relative z-10 flex h-7 w-6 cursor-pointer items-center justify-center text-[10px] text-ink-3 transition-colors hover:text-black disabled:cursor-default disabled:opacity-20"
                  aria-label="Show earlier"
                  title="Show earlier"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={busy || idx === (banners?.length ?? 0) - 1}
                  onClick={() => void move(b, "down")}
                  className="relative z-10 flex h-7 w-6 cursor-pointer items-center justify-center text-[10px] text-ink-3 transition-colors hover:text-black disabled:cursor-default disabled:opacity-20"
                  aria-label="Show later"
                  title="Show later"
                >
                  ▼
                </button>
              </div>

              <div className="flex h-24 shrink-0 gap-0.5">
                {b.images.slice(0, BANNER_PHOTO_COUNT).map((src, i) => (
                  <div
                    key={i}
                    className={`relative h-full w-20 overflow-hidden border border-neutral-200 bg-photo-bg ${
                      i === 1 ? "hidden sm:block" : i === 2 ? "hidden lg:block" : ""
                    }`}
                  >
                    <Image
                      src={primaryMedia(src)}
                      alt=""
                      fill
                      className={`object-cover ${b.isActive ? "" : "opacity-40 grayscale"}`}
                      sizes="80px"
                      quality={IMAGE_QUALITY}
                    />
                  </div>
                ))}
              </div>

              <div className="flex min-h-24 min-w-0 flex-1 flex-col justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <p
                    className={`line-clamp-2 text-sm font-medium ${
                      b.isActive ? "text-black" : "text-ink-3"
                    }`}
                  >
                    {b.title}
                  </p>

                  {b.images.length < BANNER_PHOTO_COUNT && (
                    <p className="flex items-start gap-1.5 text-[11px] font-semibold text-red-700">
                      <Icon name="warning" className="mt-0.5 h-3.5 w-3.5" />
                      <span>
                        Add {BANNER_PHOTO_COUNT - b.images.length} more photographs, or a desktop
                        will show an empty column
                      </span>
                    </p>
                  )}
                  {!b.isActive && (
                    <p className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                      Switched off
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggle(b)}
                    aria-label={b.isActive ? "Switch the banner off" : "Switch the banner on"}
                    title={b.isActive ? "Switch off" : "Switch on"}
                    className="relative z-10 inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-dashed border-neutral-400 bg-white text-[10px] font-bold tracking-wider uppercase transition-colors hover:border-black disabled:opacity-40 sm:w-auto sm:border-solid sm:border-neutral-300 sm:px-3"
                  >
                    <Icon name={b.isActive ? "hide" : "show"} className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline">
                      {b.isActive ? "Switch off" : "Switch on"}
                    </span>
                  </button>

                  <Link
                    href={`/admin/banners/${b.id}`}
                    aria-label={`Edit the banner «${b.title}»`}
                    title="Edit"
                    className="inline-flex h-9 w-9 items-center justify-center border border-black bg-black text-[10px] font-bold tracking-wider text-white uppercase transition-colors after:absolute after:inset-0 after:content-[''] hover:bg-neutral-800 min-[400px]:w-auto min-[400px]:px-3"
                  >
                    <Icon name="pencil" className="h-4 w-4 min-[400px]:hidden" />
                    <span className="hidden min-[400px]:inline sm:hidden">Change</span>
                    <span className="hidden sm:inline">Edit</span>
                  </Link>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(b)}
                    title="Delete the banner"
                    aria-label={`Delete the banner «${b.title}»`}
                    className="relative z-10 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border border-neutral-300 bg-white text-ink-3 transition-colors hover:border-red-600 hover:text-red-700 disabled:opacity-40"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </PageBody>
  );
}

