"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Field,
  fieldCls,
  Notice,
  PageBody,
  PageHeader,
  textareaClsFor,
} from "../../ui";
import { MediaUploader } from "../../MediaUploader";
import { Toast } from "@/components/ui/Toast";
import { bannerSchema, fieldErrorsFrom, type FieldErrors } from "@/lib/validation";
import { BANNER_PHOTO_COUNT, bannerDeviceViews, type Banner } from "@/lib/types";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

/**
 * Schematic diagram visualizing responsive banner aspect ratios across desktop, tablet, and mobile.
 *
 * NOTE: (§8.3) Renders exact multi-column distribution without requiring live mock image fetches.
 */
function BannerOnDevices() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {bannerDeviceViews().map((view) => (
        <div key={view.device} className="space-y-1.5">
          <p className="text-[10px] font-bold tracking-[0.1em] text-ink-2 uppercase">
            {view.label}
          </p>
          <div className="flex h-12 w-full items-start gap-0.5 sm:h-14 lg:h-16">
            {Array.from({ length: view.photos }).map((_, cell) => (
              <div
                key={cell}
                style={{ aspectRatio: String(view.cellAspect) }}
                className="h-full min-w-0 shrink border border-neutral-300 bg-neutral-100"
              />
            ))}
          </div>
          <p className="text-[10px] leading-tight text-ink-3">
            {view.photos === 1 ? "photo 1" : `photos 1–${view.photos}`}
          </p>
        </div>
      ))}
    </div>
  );
}

const EMPTY = {
  subtitle: "",
  title: "",
  ctaLabel: "",
  ctaHref: "",
  ctaSecondaryLabel: "",
  ctaSecondaryHref: "",
  isActive: true,
};

/**
 * Admin banner editor view for creating or modifying homepage hero banners.
 *
 * NOTE: (§8.3) Enforces 3-photo requirement, multi-line titles, and local CTA link destinations.
 */
export default function AdminBannerEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNew = id === "new";

  const [values, setValues] = useState(EMPTY);
  const [secondCtaOpen, setSecondCtaOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [savedState, setSavedState] = useState(() =>
    JSON.stringify({ values: EMPTY, images: [] as string[] }),
  );

  useEffect(() => {
    if (isNew) return;
    fetch("/api/banners")
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as Banner[];
      })
      .then((all) => {
        const b = all.find((x) => x.id === id);
        if (!b) {
          router.push("/admin/banners");
          return;
        }
        setValues({
          subtitle: b.subtitle ?? "",
          title: b.title,
          ctaLabel: b.ctaLabel ?? "",
          ctaHref: b.ctaHref ?? "",
          ctaSecondaryLabel: b.ctaSecondaryLabel ?? "",
          ctaSecondaryHref: b.ctaSecondaryHref ?? "",
          isActive: b.isActive,
        });
        setImages(b.images);
        setSavedState(
          JSON.stringify({
            values: {
              subtitle: b.subtitle ?? "",
              title: b.title,
              ctaLabel: b.ctaLabel ?? "",
              ctaHref: b.ctaHref ?? "",
              ctaSecondaryLabel: b.ctaSecondaryLabel ?? "",
              ctaSecondaryHref: b.ctaSecondaryHref ?? "",
              isActive: b.isActive,
            },
            images: b.images,
          }),
        );
      })
      .catch(() => router.push("/admin/banners"))
      .finally(() => setLoading(false));
  }, [id, isNew, router]);

  const set = useCallback(<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  async function save() {
    const payload = {
      title: values.title,
      subtitle: values.subtitle || undefined,
      images,
      ctaLabel: values.ctaLabel || undefined,
      ctaHref: values.ctaHref || undefined,
      ctaSecondaryLabel: values.ctaSecondaryLabel || undefined,
      ctaSecondaryHref: values.ctaSecondaryHref || undefined,
      isActive: values.isActive,
    };

    const parsed = bannerSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = fieldErrorsFrom(parsed.error);
      setErrors(fieldErrors);
      setNotice("Not saved: check the highlighted fields.");
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(isNew ? "/api/banners" : `/api/banners/${id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setNotice(data.error ?? "The banner could not be saved.");
        return;
      }
      setSavedState(JSON.stringify({ values, images }));
      router.push("/admin/banners");
    } catch {
      setNotice("Connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const isDirty = JSON.stringify({ values, images }) !== savedState;

  useUnsavedChangesGuard(isDirty, "The banner changes are not saved. Leave the page?");

  if (loading) {
    return (
      <PageBody narrow>
        <p className="py-10 text-sm text-ink-2">Loading…</p>
      </PageBody>
    );
  }

  return (
    <PageBody narrow className="space-y-6 pt-6 sm:pt-6">
      {isDirty && (
        <div className="sticky top-[var(--admin-header-h)] z-30 -mx-4 -mt-6 border-b border-neutral-200 bg-white px-4 sm:-mx-10 sm:px-10">
          <div className="flex min-h-14 items-center justify-between gap-3 py-2.5">
            <p className="min-w-0 truncate text-xs text-ink-2">Changes not saved</p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="min-h-9 cursor-pointer border border-black bg-black px-4 text-[11px] font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-ink-3"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <Link
                href="/admin/banners"
                className="inline-flex min-h-9 cursor-pointer items-center px-2 text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase transition-colors hover:text-black"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      )}

      <Link
        href="/admin/banners"
        className="-mt-1 mb-2 inline-flex items-center gap-2 py-3 text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase transition-colors hover:text-black"
      >
        ← All banners
      </Link>

      <PageHeader
        title={isNew ? "New banner" : "Editing a banner"}
        hint="The first screen of the home page: three full-width photographs with a heading and a button over them."
      />

      {notice && (
        <Toast
          tone="error"
          role="alert"
          offset="var(--admin-header-h)"
          onDismiss={() => setNotice(null)}
        >
          {notice}
        </Toast>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card
            title="Appearance"
            hint="What of this banner is visible on each device."
          >
            <BannerOnDevices />

            <p className="text-xs leading-relaxed text-ink-2">
              A banner is always{" "}
              <strong className="font-semibold text-black">
                {BANNER_PHOTO_COUNT} photographs
              </strong>{" "}
              and fills the screen. A desktop shows all three side by side, a tablet
              the first two, a phone only the first.
              <br />
              <strong className="font-semibold text-black">
                Everyone sees the first photograph
              </strong>{" "}
              — so put the most important shot first. The star on a photograph
              changes the order.
            </p>
          </Card>

          <MediaUploader
            images={images}
            onChange={setImages}
            max={BANNER_PHOTO_COUNT}
            allowVideo={false}
            kind="banner"
            title="Banner photographs"
            hint={`Exactly ${BANNER_PHOTO_COUNT} are needed. The first shows on every device, the second from tablet up, the third on desktop only.`}
          />
          {errors.images && <Notice kind="error">{errors.images}</Notice>}

          <Card title="Display" hint="A switched-off banner stays in the list but does not appear on the site.">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-black"
              />
              Show on the home page
            </label>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card title="Text" hint="What a shopper reads over the photographs.">
            <Field
              label="The line above the heading"
              hint="Capitals, letter-spaced. Enter starts a new line, two at most"
              error={errors.subtitle}
            >
              <textarea
                value={values.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                rows={1}
                placeholder="A UKRAINIAN PREMIUM COSMETICS BRAND"
                className={`${textareaClsFor(Boolean(errors.subtitle))} [field-sizing:content]`}
              />
            </Field>
            <Field
              label="Heading *"
              hint="Enter starts a new line, four at most. The type size sets itself"
              error={errors.title}
            >
              <textarea
                value={values.title}
                onChange={(e) => set("title", e.target.value)}
                rows={1}
                placeholder="YOUR DAILY&#10;BEAUTY RITUAL"
                className={`${textareaClsFor(Boolean(errors.title))} [field-sizing:content]`}
              />
            </Field>
          </Card>

          <Card title="Buttons" hint="One button on the banner; a second if you want it.">
            <Field label="Button text" error={errors.ctaLabel}>
              <input
                type="text"
                value={values.ctaLabel}
                onChange={(e) => set("ctaLabel", e.target.value)}
                placeholder="OPEN THE CATALOGUE"
                className={fieldCls(Boolean(errors.ctaLabel))}
              />
            </Field>
            <Field label="Where it leads" hint="An address on this site, starting with «/»" error={errors.ctaHref}>
              <input
                type="text"
                value={values.ctaHref}
                onChange={(e) => set("ctaHref", e.target.value)}
                placeholder="/catalog"
                className={fieldCls(Boolean(errors.ctaHref))}
              />
            </Field>

            {secondCtaOpen || values.ctaSecondaryLabel || values.ctaSecondaryHref ? (
              <>
                <Field
                  label="Second button"
                  hint="Shown on desktop only."
                  error={errors.ctaSecondaryLabel}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      value={values.ctaSecondaryLabel}
                      onChange={(e) => set("ctaSecondaryLabel", e.target.value)}
                      placeholder="ABOUT THE BRAND"
                      autoFocus
                      className={fieldCls(Boolean(errors.ctaSecondaryLabel))}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        set("ctaSecondaryLabel", "");
                        set("ctaSecondaryHref", "");
                        setSecondCtaOpen(false);
                      }}
                      className="shrink-0 cursor-pointer text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-black hover:decoration-black"
                    >
                      Remove
                    </button>
                  </div>
                </Field>
                <Field label="Where the second one leads" error={errors.ctaSecondaryHref}>
                  <input
                    type="text"
                    value={values.ctaSecondaryHref}
                    onChange={(e) => set("ctaSecondaryHref", e.target.value)}
                    placeholder="/about"
                    className={fieldCls(Boolean(errors.ctaSecondaryHref))}
                  />
                </Field>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSecondCtaOpen(true)}
                className="min-h-11 w-full cursor-pointer border border-dashed border-neutral-300 px-4 text-[11px] font-semibold tracking-[0.14em] text-ink-2 uppercase transition-colors hover:border-black hover:text-black"
              >
                + Add a second button
              </button>
            )}
          </Card>

        </div>
      </div>
    </PageBody>
  );
}

