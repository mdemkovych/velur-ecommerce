"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, hintCls, inputCls, labelCls, PageBody, PageHeader } from "../ui";

interface MfaState {
  hasFactor: boolean;
  mfaSatisfied: boolean;
}

interface Enrolment {
  factorId: string;
  qr: string;
  secret: string;
}

const CODE_LENGTH = 6;

/**
 * Two-Factor Authentication (TOTP MFA) configuration and self-service setup page.
 *
 * NOTE: (§3.4, §8.1) Mandatory enrollment for staff members before accessing protected admin workflows.
 */
export default function AdminSecurityPage() {
  const router = useRouter();
  const [state, setState] = useState<MfaState | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/mfa");
      if (res.ok) {
        setState((await res.json()) as MfaState);
        return;
      }
    } catch {
      // Fall through: treat unreadable response as unauthenticated MFA state
    }
    setState({ hasFactor: false, mfaSatisfied: false });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/mfa")
      .then((res) => (res.ok ? res.json() : { hasFactor: false, mfaSatisfied: false }))
      .then((data: MfaState) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState({ hasFactor: false, mfaSatisfied: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startEnrolment() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Enrolment could not be started");
        return;
      }
      setEnrolment(data as Enrolment);
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    if (!enrolment) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId: enrolment.factorId, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Wrong code");
        setCode("");
        return;
      }
      setEnrolment(null);
      setCode("");
      await load();
      router.refresh();
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "It could not be switched off");
        setCode("");
        return;
      }
      setDisabling(false);
      setCode("");
      await load();
      router.refresh();
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const codeField = (
    <div className="space-y-2 text-center">
      <label htmlFor="mfa-code" className={`${labelCls} block`}>
        Code from the app
      </label>
      <input
        id="mfa-code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        placeholder="000000"
        autoComplete="one-time-code"
        inputMode="numeric"
        className={`${inputCls} mx-auto block max-w-[12rem] text-center text-lg tracking-[0.4em]`}
      />
    </div>
  );

  return (
    <PageBody className="animate-in fade-in duration-200">
      <div className="mx-auto flex min-h-[60vh] w-full flex-col justify-center gap-6 sm:w-4/5">
        <PageHeader
          title="Security"
          hint="Two-factor sign-in: a password plus a code from the app on your phone. A stolen password without the phone no longer opens the panel."
        />

        {state === null ? (
          <p className={hintCls}>Loading…</p>
        ) : state.hasFactor && !disabling ? (
          <Card title="Two-factor sign-in">
            <p className="text-xs leading-relaxed font-semibold text-black">Set up.</p>
            <p className={hintCls}>
              At every sign-in, after the password, a six-digit code from your app is asked for.
            </p>
            <p className={hintCls}>
              The code in the app changes every 30 seconds, and that is how it should be: it is
              computed from the key{" "}
              <strong className="font-semibold text-black">and the current time</strong>, so a code
              somebody glimpsed is useless half a minute later. That it is all wired correctly is
              already proven: the line above appeared because the server accepted your code.
            </p>
            <p className={hintCls}>
              If you lose the phone and backup is switched off in the app, only the shop&apos;s owner
              can reset two-factor sign-in. You cannot do it here yourself, and that is deliberate:
              otherwise whoever stole a session would switch the protection off themselves.
            </p>
            <div className="flex flex-col items-center gap-3 border-t border-neutral-100 pt-4 md:flex-row md:flex-wrap md:justify-center lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <span className="hidden lg:block" aria-hidden="true" />
              <Link
                href="/admin/products"
                className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center border border-black bg-black px-4 py-3 text-xs font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-white hover:text-black md:w-auto md:min-w-[16rem]"
              >
                To the panel
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDisabling(true);
                  setError(null);
                }}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-neutral-300 bg-white px-4 py-3 text-xs font-bold tracking-[0.12em] whitespace-nowrap text-ink-2 uppercase transition-colors hover:border-black hover:text-black lg:justify-self-end"
              >
                Replace the app
              </button>
            </div>
          </Card>
        ) : state.hasFactor && disabling ? (
          <Card title="Replace the app or the phone">
            <p className={hintCls}>
              Enter the current code from the <strong className="font-semibold text-black">old one</strong>{" "}
              app — that proves you still have it. Without it nothing can be replaced: otherwise a
              stolen session would drop the protection with one press.
            </p>
            <p className={hintCls}>
              Straight afterwards you land on the enrolment step and scan a new QR code — the panel
              will not let you end up with no second factor at all.
            </p>
            {codeField}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                disabled={busy || code.length !== CODE_LENGTH}
                onClick={() => void disable()}
                className="cursor-pointer border border-red-300 bg-white px-4 py-3 text-xs font-bold tracking-[0.12em] text-red-700 uppercase transition-colors hover:border-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => {
                  setDisabling(false);
                  setCode("");
                  setError(null);
                }}
                className="cursor-pointer border border-neutral-300 bg-white px-4 py-3 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase transition-colors hover:border-black hover:text-black"
              >
                Cancel
              </button>
            </div>
          </Card>
        ) : enrolment ? (
          <Card title="Step 2 — confirm the code">
            <p className={hintCls}>
              Scan this QR code in your authenticator app (the «+» button, then «Scan a QR code»).
              After scanning, an entry named «VELUR» appears in the app with a six-digit number
              that changes every 30 seconds — that is what goes in below.
            </p>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrolment.qr}
              alt="QR code for the authenticator app"
              className="mx-auto h-48 w-48 border border-neutral-200 bg-white p-2"
            />

            <div className="space-y-2 border-b border-neutral-100 pb-4">
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="mx-auto block cursor-pointer text-[11px] font-bold tracking-wider text-ink-3 uppercase transition-colors hover:text-black"
              >
                {showSecret ? "Hide the key" : "Cannot scan it?"}
              </button>
              {showSecret && (
                <>
                  <p className={hintCls}>
                    Add the entry in the app by hand and paste this key instead of scanning:
                  </p>
                  <p className="border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs break-all text-black">
                    {enrolment.secret}
                  </p>
                </>
              )}
            </div>

            {codeField}

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                disabled={busy || code.length !== CODE_LENGTH}
                onClick={() => void confirmCode()}
                className="cursor-pointer border border-black bg-black px-4 py-3 text-xs font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnrolment(null);
                  setCode("");
                  setError(null);
                }}
                className="cursor-pointer border border-neutral-300 bg-white px-4 py-3 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase transition-colors hover:border-black hover:text-black"
              >
                Cancel
              </button>
            </div>
          </Card>
        ) : (
          <Card title="Step 1 — set up the app">
            <ol className={`${hintCls} list-decimal space-y-3 pl-5`}>
              <li>
                Install an{" "}
                <strong className="font-semibold text-black">authenticator app</strong> on your
                phone. Look for one in the App Store (iPhone) or Google Play (Android).
              </li>
              <li>
                Open the app and{" "}
                <strong className="font-semibold text-black">sign in to your account</strong>{" "}
                — then the codes are kept in a backup. A lost phone no longer means lost access:
                install the app on a new one, sign in with the same account, and the codes are back.
                Without it they vanish with the phone.
              </li>
              <li>
                Come back here and press «Set up» — a QR code appears for that app to scan.
              </li>
            </ol>

            <p className={hintCls}>
              Until two-factor sign-in is set up, the rest of the panel stays out of reach — a
              requirement before real payments are taken.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void startEnrolment()}
              className="mx-auto block w-full cursor-pointer border border-black bg-black px-4 py-3 text-xs font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-white hover:text-black disabled:opacity-50 sm:w-fit sm:min-w-[18rem]"
            >
              {busy ? "Please wait…" : "Set up"}
            </button>
          </Card>
        )}

        {error && (
          <p className="border border-red-300 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800">
            {error}
          </p>
        )}
      </div>
    </PageBody>
  );
}

