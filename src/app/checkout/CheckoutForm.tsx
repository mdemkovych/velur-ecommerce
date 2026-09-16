"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearCart,
  hydrateShop,
  readStoredCart,
  selectCartItems,
  selectCartNotices,
  selectCartTotal,
  selectShopHydrated,
  selectWishlistItems,
} from "@/store/shopSlice";
import { resolveCart } from "@/store/resolveCart";
import { cartLinePrice, noticeBlocksCheckout } from "@/lib/types";
import { primaryMedia } from "@/lib/media";
import { customerSchema, validateEmail, validateName, validatePhone } from "@/lib/validation";
import { ContactSection } from "./ContactSection";
import { DeliverySection } from "./DeliverySection";
import { PaymentSection } from "./PaymentSection";
import { OrderSummary, SubmitOrder } from "./OrderSummary";
import { LAST_ORDER_STORAGE_KEY, type PlacedOrder } from "./OrderPlaced";
import {
  composeAddress,
  emptyCheckoutValues,
  readCheckoutDraft,
  saveCheckoutDraft,
  type CheckoutErrors,
  type CheckoutValues,
} from "./types";
import CheckoutLoading from "./loading";
import CartNotices from "@/components/CartNotices";
import { Toast } from "@/components/ui/Toast";
import { useHasMounted } from "@/hooks/useHasMounted";
import { useReleaseUnpaidOrder } from "@/hooks/useReleaseUnpaidOrder";

interface Props {
  isOnlinePaymentAvailable: boolean;
}

/**
 * Step section accordion component for customer details, shipping, and payment.
 */
function Section({
  index,
  title,
  isComplete,
  children,
}: {
  index: number;
  title: string;
  isComplete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <h2 className="type-h3 flex items-center gap-3 border-b border-neutral-200 pb-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold transition-colors duration-300 sm:h-7 sm:w-7 sm:text-xs ${
            isComplete ? "bg-black text-white" : "border border-neutral-300 bg-white text-ink-3"
          }`}
        >
          {isComplete ? (
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            index
          )}
        </span>
        <span className="text-black">{title}</span>
      </h2>
      <div>{children}</div>
    </div>
  );
}

/**
 * Interactive customer checkout form coordinating order creation and payment gateway redirection.
 *
 * NOTE: (§3.1, §3.5, §4.1, §7.4) Validates customer schema, reconciles cart changes, and initializes Monobank invoice session.
 */
export function CheckoutForm({ isOnlinePaymentAvailable }: Props) {
  const dispatch = useAppDispatch();
  const wishlist = useAppSelector(selectWishlistItems);
  const items = useAppSelector(selectCartItems);
  const isShopHydrated = useAppSelector(selectShopHydrated);
  const total = useAppSelector(selectCartTotal);
  const notices = useAppSelector(selectCartNotices);
  const hasMounted = useHasMounted();

  const [values, setValuesState] = useState<CheckoutValues>(
    () => readCheckoutDraft() ?? emptyCheckoutValues,
  );
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefusedByServer, setIsRefusedByServer] = useState(false);
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [isDirectoryDown, setIsDirectoryDown] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof CheckoutValues, true>>>({});

  const markTouched = useCallback((field: keyof CheckoutValues) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  const [isLeaving, setIsLeaving] = useState(false);
  const [storedCartLines] = useState(() => readStoredCart().length);

  const handlePageRestored = useCallback(() => setIsLeaving(false), []);
  const { isReleasing } = useReleaseUnpaidOrder(handlePageRestored);

  const setValues = useCallback((patch: Partial<CheckoutValues>) => {
    setValuesState((prev) => ({ ...prev, ...patch }));
    setIsRefusedByServer(false);
    setFormAlert(null);
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key as keyof CheckoutErrors];
      delete next.form;
      return next;
    });
  }, []);

  const setValue = useCallback(
    <K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) => {
      setValues({ [key]: value } as Partial<CheckoutValues>);
    },
    [setValues],
  );

  const setError = useCallback((key: keyof CheckoutValues, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  }, []);

  const isContactValid =
    validateName(values.firstName, "First name") === null &&
    validateName(values.lastName, "Last name") === null &&
    validatePhone(values.phone) === null &&
    validateEmail(values.email) === null;

  const isAddressPicked =
    isDirectoryDown ||
    (values.cityRef.length > 0 &&
      (values.deliveryMethod !== "branch" || values.branchRef.length > 0));

  const touchedErrors: CheckoutErrors = {};
  if (touched.city && values.city.trim().length > 0 && !isDirectoryDown && !values.cityRef) {
    touchedErrors.city = "Choose a city from the list, otherwise delivery cannot be arranged";
  }
  if (
    touched.branch &&
    values.deliveryMethod === "branch" &&
    values.branch.trim().length > 0 &&
    !isDirectoryDown &&
    !values.branchRef
  ) {
    touchedErrors.branch = "Choose a branch from the list";
  }
  if (touched.street && values.street.trim().length < 2) {
    touchedErrors.street = "Enter a street";
  }
  if (touched.house && values.house.trim().length < 1) {
    touchedErrors.house = "Enter a house number";
  }

  const shownErrors: CheckoutErrors = { ...touchedErrors, ...errors };

  const isDeliveryValid =
    isContactValid &&
    isAddressPicked &&
    values.city.trim().length >= 2 &&
    (values.deliveryMethod === "branch"
      ? values.branch.trim().length >= 2
      : values.deliveryMethod === "courier"
        ? composeAddress(values).length > 0
        : false);

  const hasUnreadCartChanges = notices.some(noticeBlocksCheckout);

  const canSubmit =
    isDeliveryValid &&
    Boolean(values.paymentMethod) &&
    values.consent &&
    !hasUnreadCartChanges &&
    !isRefusedByServer;

  const submitLabel = "Go to payment";

  const cartLines = useMemo(
    () => items.map(({ product, quantity }) => ({ productId: product.id, quantity })),
    [items],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    if (hasUnreadCartChanges) return;

    const candidate = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email,
      city: values.city,
      cityRef: values.cityRef,
      deliveryMethod: values.deliveryMethod,
      branch: values.deliveryMethod === "branch" ? values.branch : undefined,
      branchRef: values.deliveryMethod === "branch" ? values.branchRef : undefined,
      address: values.deliveryMethod === "courier" ? composeAddress(values) : undefined,
      paymentMethod: values.paymentMethod,
      comment: values.comment || undefined,
      consent: values.consent,
    };

    const parsed = customerSchema({
      requireDirectoryRefs: !isDirectoryDown,
    }).safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors: CheckoutErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key as keyof CheckoutErrors] = issue.message;
      }

      if (fieldErrors.address) {
        if (values.street.trim().length < 2) fieldErrors.street = "Enter a street";
        if (values.house.trim().length < 1) fieldErrors.house = "Enter a house number";
        if (fieldErrors.street || fieldErrors.house) delete fieldErrors.address;
      }

      setErrors(fieldErrors);
      setFormAlert("Check the highlighted fields — we marked what is missing.");

      const form = event.currentTarget as HTMLFormElement;
      requestAnimationFrame(() => {
        const firstInvalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (!firstInvalid) return;
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid.focus({ preventScroll: true });
      });
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setFormAlert(null);
    setIsRefusedByServer(false);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: candidate, items: cartLines }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          try {
            const { items: fresh, notices } = await resolveCart(readStoredCart());
            dispatch(hydrateShop({ items: fresh, wishlist, notices }));
          } catch (err) {
            console.error("Failed to refresh the basket after rejection:", err);
            setErrors({ form: data.error ?? "The order could not be placed" });
            setFormAlert(data.error ?? "The order could not be placed");
          }
          return;
        }

        setErrors({ form: data.error ?? "The order could not be placed" });
        setFormAlert(data.error ?? "The order could not be placed");
        if (res.status === 429 || res.status === 400) setIsRefusedByServer(true);
        return;
      }

      const order: PlacedOrder = {
        id: data.order.id,
        total: data.order.total,
        paymentMethod: "mono",
        paymentToken: data.paymentToken,
        lines: items.map(({ product, quantity }) => ({
          nameUk: product.nameUk,
          quantity,
          sum: cartLinePrice({ product, quantity }) * quantity,
          image: primaryMedia(product.image),
        })),
        deliveryTo:
          values.deliveryMethod === "branch"
            ? [values.city, values.branch].filter(Boolean).join(", ")
            : [values.city, composeAddress(values)].filter(Boolean).join(", "),
      };
      sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(order));
      saveCheckoutDraft(values);

      {
        const invoiceRes = await fetch("/api/monobank/create-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id, paymentToken: data.paymentToken }),
        });
        const invoice = await invoiceRes.json();

        if (invoiceRes.ok && invoice.pageUrl) {
          setIsLeaving(true);
          dispatch(clearCart());
          window.location.href = invoice.pageUrl;
          return;
        }

        sessionStorage.removeItem(LAST_ORDER_STORAGE_KEY);
        {
          const message =
            invoice.error ??
            "The payment page could not be opened. Please try again in a few minutes.";
          setErrors({ form: message });
          setFormAlert(message);
        }
        return;
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      setErrors({ form: "Connection failed. Try again." });
      setFormAlert("Connection failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOnlinePaymentAvailable) {
    return (
      <main className="flex flex-1 items-center justify-center bg-white px-6 py-20 text-black">
        <div className="max-w-sm space-y-6 text-center">
          <h1 className="font-cormorant text-3xl font-bold uppercase">
            Payment is temporarily unavailable
          </h1>
          <p className="text-sm leading-relaxed text-ink-2">
            We cannot take an order right now. Your basket will be kept —
            please try again a little later.
          </p>
          <p className="text-sm leading-relaxed text-ink-2">
            If the order is urgent, get in touch and we will say when payment
            is working again.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contacts"
              className="inline-flex min-h-11 items-center justify-center border border-black bg-black px-8 py-4 text-xs font-bold tracking-[0.25em] text-white uppercase transition-all hover:bg-white hover:text-black"
            >
              Contacts
            </Link>
            <Link
              href="/catalog"
              className="inline-flex min-h-11 items-center justify-center border border-black bg-white px-8 py-4 text-xs font-bold tracking-[0.25em] text-black uppercase transition-all hover:bg-neutral-50"
            >
              To the catalogue
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (isLeaving) return <CheckoutLoading />;
  if (!hasMounted) return <CheckoutLoading />;
  if (isReleasing) return <CheckoutLoading />;
  if (!isShopHydrated && storedCartLines > 0) return <CheckoutLoading />;

  if (items.length === 0) {
    return (
      <>
        <CartNotices tone="alert" />
        <main className="flex-1 bg-white text-black flex items-center justify-center py-20 px-6">
          <div className="text-center space-y-6 max-w-sm">
            <h1 className="font-cormorant text-3xl font-bold uppercase">The basket is empty</h1>
            <p className="text-sm text-ink-2">
              {hasUnreadCartChanges
                ? "What was in the basket is no longer in stock. Pick something else — we have just refreshed the figures."
                : "Add something to the basket to place an order."}
            </p>
            <Link
              href="/catalog"
              className="inline-block bg-black text-white text-xs font-bold tracking-[0.25em] uppercase px-8 py-4 border border-black hover:bg-white hover:text-black transition-all"
            >
              To the catalogue
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <main className="flex-1 bg-white text-black">
      <div className="border-b border-neutral-200 bg-white sticky top-[var(--header-h)] z-40 w-full">
        <div className="flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-8 md:px-10">
          <h1 className="font-cormorant shrink-0 text-xs font-bold tracking-[0.14em] text-black uppercase min-[380px]:text-sm sm:text-base lg:text-lg lg:tracking-[0.18em]">
            Checkout
          </h1>
          <Link
            href="/catalog"
            className="-my-2 flex shrink-0 items-center gap-2 py-3 text-[10px] font-semibold tracking-[0.18em] text-ink-3 uppercase transition-colors hover:text-black sm:text-[11px]"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span>Catalogue</span>
          </Link>
        </div>
      </div>

      <CartNotices tone="alert" />

      {formAlert && (
        <Toast
          tone="error"
          role="alert"
          offset="calc(var(--header-h) + 3.5rem + 1px)"
          onDismiss={() => setFormAlert(null)}
        >
          {formAlert}
        </Toast>
      )}

      <form onSubmit={handleSubmit} className="mx-auto grid max-w-7xl grid-cols-1 xl:grid-cols-12">
        <div className="border-b border-neutral-200 bg-neutral-50 xl:order-2 xl:col-span-5 xl:border-t-0 xl:border-b-0">
          <OrderSummary
            items={items}
            total={total}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            submitLabel={submitLabel}
          />
        </div>

        <div className="space-y-12 border-neutral-200 p-6 sm:p-10 xl:order-1 xl:col-span-7 xl:border-r xl:p-14">
          <Section index={1} title="Contact details" isComplete={isContactValid}>
            <ContactSection
              values={values}
              errors={shownErrors}
              setValue={setValue}
              setError={setError}
            />
          </Section>

          <Section index={2} title="Delivery" isComplete={isDeliveryValid}>
            <DeliverySection
              values={values}
              errors={shownErrors}
              onBlurField={markTouched}
              setValue={setValue}
              setValues={setValues}
              onDirectoryStatus={setIsDirectoryDown}
            />
          </Section>

          <Section index={3} title="Payment method" isComplete={canSubmit}>
            <PaymentSection
              values={values}
              errors={shownErrors}
              setValue={setValue}
            />
          </Section>

          <div className="xl:hidden">
            <SubmitOrder
              canSubmit={canSubmit}
              isSubmitting={isSubmitting}
              submitLabel={submitLabel}
            />
          </div>
        </div>
      </form>
    </main>
  );
}

