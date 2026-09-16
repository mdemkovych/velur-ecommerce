/**
 * Shared validation schemas and sanitizers for client forms and API route handlers.
 *
 * NOTE: (§1.3) Isomorphic Zod contracts guaranteeing runtime validation on both client and server boundaries.
 */

import { z } from "zod";
import { isVideoUrl } from "./media";
import {
  BANNER_PHOTO_COUNT,
  MANUAL_BADGES,
  MAX_PRODUCT_IMAGES,
  type DeliveryMethod,
  type PaymentMethod,
} from "./types";

// ─── Phone (Ukraine only) ─────────────────────────────────────────────────────

export const UA_PHONE_CODE = "+380";

/** Normalizes raw phone inputs to subscriber digits (e.g. "+380991234567" -> "991234567"). */
export function toSubscriberDigits(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  const withoutCountry = digits.startsWith("380")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return withoutCountry.slice(0, 9);
}

/** Formats subscriber digits into display groups ("99 123 45 67"). */
export function formatSubscriberDigits(digits: string): string {
  const d = toSubscriberDigits(digits);
  const groups = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)];
  return groups.filter(Boolean).join(" ");
}

/** Formats subscriber digits into E.164 canonical standard ("+380991234567"). */
export function toE164(raw: string): string {
  return `${UA_PHONE_CODE}${toSubscriberDigits(raw)}`;
}

/** Validates Ukrainian subscriber number format and operator prefix range. */
export function validatePhone(raw: string): string | null {
  const digits = toSubscriberDigits(raw);
  if (digits.length === 0) return "Enter a telephone number";
  if (digits.length < 9) return "The number needs nine digits after +380";
  if (!/^[3-9]/.test(digits)) return "That is not a valid telephone number";
  return null;
}

// ─── Name ─────────────────────────────────────────────────────────────────────

const NAME_LETTERS = /^[A-Za-zА-Яа-яЄєІіЇїҐґ'’\-\s]+$/;

/** Capitalizes a name while preserving apostrophes and hyphenated words. */
export function capitalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s'’\-])([a-zа-яєіїґ])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function validateName(raw: string, label: string): string | null {
  const value = raw.trim();
  if (value.length < 2) return `${label} needs at least 2 characters`;
  if (value.length > 50) return `${label} cannot be longer than 50 characters`;
  if (!NAME_LETTERS.test(value)) return `${label} takes letters, apostrophes and hyphens only`;
  return null;
}

// ─── Email ────────────────────────────────────────────────────────────────────

export function sanitizeEmail(raw: string): string {
  return (raw || "").replace(/\s+/g, "").slice(0, 254);
}

/** RFC-compliant email validation rules evaluated in prioritized sequence. */
const EMAIL_RULES: { test: (email: string) => boolean; message: string }[] = [
  { test: (e) => e.length > 0, message: "Enter an email address" },
  { test: (e) => e.length <= 254, message: "That email address is too long" },
  {
    test: (e) => !/[^\x20-\x7E]/.test(e),
    message: "An email address uses Latin characters only",
  },
  { test: (e) => (e.match(/@/g) || []).length === 1, message: "An email address needs exactly one @" },
  { test: (e) => /^[a-zA-Z0-9._+-]+@/.test(e), message: "Invalid characters before the @ (allowed: A-Z, 0-9, . _ + -)" },
  { test: (e) => !/^[.]|[.]@/.test(e), message: "A dot cannot start the address or sit before the @" },
  { test: (e) => !/\.\./.test(e), message: "Two dots in a row (..) are not allowed" },
  { test: (e) => /@[a-zA-Z0-9.-]+$/.test(e), message: "Invalid characters in the domain" },
  { test: (e) => /@[^.]+\./.test(e), message: "Give a domain with a dot (gmail.com, for instance)" },
  { test: (e) => /\.[a-zA-Z]{2,}$/.test(e), message: "Give a valid top-level domain (.com, .ua, …)" },
];

export function validateEmail(raw: string): string | null {
  const email = sanitizeEmail(raw);
  return EMAIL_RULES.find((rule) => !rule.test(email))?.message ?? null;
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

function withValidator<T extends z.ZodType<string>>(
  schema: T,
  validate: (value: string) => string | null,
) {
  return schema.superRefine((value, ctx) => {
    const message = validate(value);
    if (message) ctx.addIssue({ code: "custom", message });
  });
}

const nameSchema = (label: string) =>
  withValidator(z.string().trim(), (v) => validateName(v, label));

export const emailSchema = withValidator(
  z.string().transform(sanitizeEmail),
  validateEmail,
);

/** NOTE: (§5.2) Delivery validation configuration controlling whether Nova Poshta refs are strictly mandated. */
export interface DeliveryStrictness {
  requireDirectoryRefs: boolean;
}

const customerBase = z.object({
  firstName: nameSchema("First name"),
  lastName: nameSchema("Last name"),
  phone: withValidator(z.string(), validatePhone).transform(toE164),
  email: emailSchema,
  city: z.string().trim().min(2, "Enter a city").max(100),
  cityRef: z.string().max(64).default(""),
  deliveryMethod: z.enum(["branch", "courier"], {
    message: "Choose a delivery method",
  }) satisfies z.ZodType<DeliveryMethod>,
  branch: z.string().trim().max(250).optional(),
  branchRef: z.string().max(64).optional(),
  address: z.string().trim().max(250).optional(),
  paymentMethod: z.literal("mono") satisfies z.ZodType<PaymentMethod>,
  comment: z.string().trim().max(500).optional(),
  consent: z.literal(true, {
    message: "Consent to personal data processing is required",
  }),
});

function withDeliveryShape<T extends z.ZodType<{
  deliveryMethod: DeliveryMethod;
  branch?: string;
  address?: string;
}>>(schema: T) {
  return schema
    .refine((d) => d.deliveryMethod !== "branch" || (d.branch?.trim().length ?? 0) >= 2, {
      message: "Choose a Nova Poshta branch",
      path: ["branch"],
    })
    .refine((d) => d.deliveryMethod !== "courier" || (d.address?.trim().length ?? 0) >= 5, {
      message: "Enter a delivery address",
      path: ["address"],
    });
}

const customerFields = withDeliveryShape(customerBase);

export function customerSchema({ requireDirectoryRefs }: DeliveryStrictness) {
  return customerFields.superRefine((d, ctx) => {
    if (!requireDirectoryRefs) return;

    if (!d.cityRef) {
      ctx.addIssue({
        code: "custom",
        path: ["city"],
        message: "Choose a city from the list, otherwise delivery cannot be arranged",
      });
    }

    if (d.deliveryMethod === "branch" && !d.branchRef) {
      ctx.addIssue({
        code: "custom",
        path: ["branch"],
        message: "Choose a branch from the list",
      });
    }
  });
}

/** NOTE: (§8.5) Mutable customer details schema for staff order corrections before dispatch. */
export const orderCustomerPatchSchema = withDeliveryShape(
  customerBase.omit({ consent: true, paymentMethod: true }),
);

export type OrderCustomerPatch = z.output<typeof orderCustomerPatchSchema>;

export type CustomerInput = z.input<typeof customerFields>;
export type CustomerData = z.output<typeof customerFields>;

/** NOTE: (§3.5) Cart payload schema validated on order placement. Prices are excluded and resolved from DB. */
export const cartLineSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1, "The smallest quantity is 1").max(99, "At most 99 pcs"),
});

export function createOrderSchema(strictness: DeliveryStrictness) {
  return z.object({
    customer: customerSchema(strictness),
    items: z.array(cartLineSchema).min(1, "The basket is empty").max(50),
  });
}

// ─── Field Errors ─────────────────────────────────────────────────────────────

export type FieldErrors = Record<string, string>;

/** Maps Zod issue array to flat dotted field path keys. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

// ─── Admin Schemas ────────────────────────────────────────────────────────────

export const specPairSchema = z.object({
  key: z.string().trim().min(1, "A specification needs a name").max(100),
  value: z.string().trim().min(1, "A specification needs a value").max(2000),
});

/** Allowed media path format: site-relative absolute paths or HTTPS URLs. */
const MEDIA_URL = /^(\/(?!\/)|https:\/\/)[^\s]*$/;
const MEDIA_URL_MESSAGE = "Media must be a path on this site or an https link";

export const productSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "A product address needs at least 2 characters")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "The address takes lower-case Latin letters, digits and hyphens only"),
  nameUk: z.string().trim().min(1, "A name is required").max(200),
  name: z.string().trim().min(1, "The Latin name is required").max(200),
  tagline: z.string().trim().max(300).default(""),
  description: z.string().trim().min(1, "A description is required").max(4000),
  usage: z.string().trim().min(1, "Directions for use are required").max(4000),
  specifications: z.array(specPairSchema).max(30, "At most 30 specifications"),
  media: z
    .array(z.string().trim().max(500).regex(MEDIA_URL, MEDIA_URL_MESSAGE))
    .min(1, "Upload at least one photograph")
    .max(MAX_PRODUCT_IMAGES, `At most ${MAX_PRODUCT_IMAGES} items`),
  categorySlug: z.string().trim().min(1, "Choose a category").max(50),
  badge: z.enum(MANUAL_BADGES).optional(),
  packaging: z.string().trim().min(1, "Fill in delivery and packaging").max(2000),
  price: z.number().int("The price must be a whole number").positive("The price must be greater than 0"),
  promotionalPrice: z.number().int().positive().optional(),
  stock: z.number().int().min(0, "Stock cannot be negative").max(100_000).default(0),
  /** NOTE: (§2.3) Product set bundled items. */
  components: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(64),
        quantity: z.number().int().min(1, "The quantity is at least 1").max(50),
      }),
    )
    .max(20, "At most 20 items in a set")
    .optional(),
})
  /** NOTE: (§6.4) Product primary media must be an image, not a video clip. */
  .refine((p) => !isVideoUrl(p.media[0]), {
    message: "The first item must be a photograph, not a clip: it is what the catalogue card shows",
    path: ["media"],
  })
  /** NOTE: (§2.2) Promotional price must be strictly lower than regular price. */
  .refine((p) => p.promotionalPrice === undefined || p.promotionalPrice < p.price, {
    message: "A promotional price must be lower than the ordinary one, or it is not a promotion",
    path: ["promotionalPrice"],
  })
  .refine((p) => (p.components ?? []).length > 0 || p.specifications.length > 0, {
    message: "Add at least one specification",
    path: ["specifications"],
  })
  .refine(
    (p) => {
      const ids = (p.components ?? []).map((c) => c.productId);
      return new Set(ids).size === ids.length;
    },
    { message: "That product is already in the set; change its quantity instead", path: ["components"] },
  );

/** NOTE: (§2.4) Category slug must be valid lowercase Latin alphanumeric with hyphens. */
export const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "A category address needs at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "The address takes lower-case Latin letters, digits and hyphens only"),
  nameUk: z.string().trim().min(2, "Enter a category name").max(60),
});

export const categoryRenameSchema = categorySchema.partial({ slug: true });

/** NOTE: (§8.3) Banner CTA target URL must be an internal site path starting with a single forward slash. */
const internalHref = z
  .string()
  .trim()
  .max(200)
  // MUST NOT: drop the (?!\/) lookahead; `/` sits inside the character class, so
  // without it `//evil.com` passes and the shop's own hero leaves the site.
  .regex(
    /^\/(?!\/)[a-zA-Z0-9\-_/?=&.]*$/,
    "The link must start with «/»: it is an address on this site",
  );

export const bannerSchema = z
  .object({
    title: z
      .string()
      .transform((value) => value.replace(/\r\n?/g, "\n"))
      .pipe(
        z
          .string()
          .trim()
          .min(2, "Enter a banner heading")
          .max(160)
          .refine(
            (value) => value.split("\n").length <= 4,
            "Too many lines in the heading; four at most",
          ),
      ),
    subtitle: z
      .string()
      .transform((value) => value.replace(/\r\n?/g, "\n"))
      .pipe(
        z
          .string()
          .trim()
          .max(120)
          .refine(
            (value) => value.split("\n").length <= 2,
            "The line above the heading takes two lines at most",
          ),
      )
      .optional(),
    images: z
      .array(z.string().trim().min(1).max(500).regex(MEDIA_URL, MEDIA_URL_MESSAGE))
      .max(BANNER_PHOTO_COUNT),
    ctaLabel: z.string().trim().max(40).optional(),
    ctaHref: internalHref.optional(),
    ctaSecondaryLabel: z.string().trim().max(40).optional(),
    ctaSecondaryHref: internalHref.optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((b, ctx) => {
    // NOTE: (§6.4) Hero banners display images only; video is disallowed.
    const clip = b.images.findIndex(isVideoUrl);
    if (clip !== -1) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message: `A banner shows photographs only; remove the clip at position ${clip + 1}`,
      });
    }

    // NOTE: (§8.3) Hero banner requires exactly 3 photographs.
    if (b.images.length !== BANNER_PHOTO_COUNT) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message:
          b.images.length === 0
            ? `Add ${BANNER_PHOTO_COUNT} photographs: a banner shows exactly that many`
            : b.images.length < BANNER_PHOTO_COUNT
              ? `A banner shows exactly ${BANNER_PHOTO_COUNT} photographs; add ${BANNER_PHOTO_COUNT - b.images.length} more`
              : `Too many photographs: exactly ${BANNER_PHOTO_COUNT} are needed, ${b.images.length} uploaded`,
      });
    }
  })
  .refine((b) => !b.ctaLabel || Boolean(b.ctaHref), {
    message: "Say where the button leads",
    path: ["ctaHref"],
  })
  .refine((b) => !b.ctaSecondaryLabel || Boolean(b.ctaSecondaryHref), {
    message: "Say where the second button leads",
    path: ["ctaSecondaryHref"],
  });

export const productOrderSchema = z.object({
  ids: z
    .array(z.string().min(1).max(64))
    .min(1, "Empty list")
    .max(500, "Too many products in one request"),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: emailSchema,
  password: z
    .string()
    .min(12, "A password needs at least 12 characters")
    .max(128)
    .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
      message: "A password needs upper and lower case letters and a digit",
    }),
  role: z.enum(["OWNER", "MANAGER"]).default("MANAGER"),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter an email").max(254),
  password: z.string().min(1, "Enter a password").max(128),
});

