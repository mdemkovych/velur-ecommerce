"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAdminRole } from "@/lib/types";
import { sanitizeEmail, validateEmail } from "@/lib/validation";

/**
 * Staff authentication view supporting email/password and TOTP second-factor challenge.
 *
 * NOTE: (§3.4, §8.1) Directs authenticated staff users to `/admin` dashboard.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<string | undefined>();

  const goOnwards = (userRole: string | undefined) => {
    router.push(isAdminRole(userRole) ? "/admin" : "/");
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailError = validateEmail(email);
    const passwordError = password.length === 0 ? "Enter a password" : undefined;
    if (emailError || passwordError) {
      setFieldErrors({ email: emailError ?? undefined, password: passwordError });
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Wrong email or password");
        setLoading(false);
        return;
      }

      if (data.mfaRequired) {
        setRole(data.user?.role);
        setStep("code");
        setLoading(false);
        return;
      }

      goOnwards(data.user?.role);
    } catch (err) {
      console.error(err);
      setError("Could not reach the server");
      setLoading(false);
    }
  };

  const startOver = async () => {
    setError("");
    setCode("");
    try {
      await fetch("/api/auth/logout", { method: "DELETE" });
    } catch {
      // Session reset fallback.
    }
    setStep("credentials");
    setPassword("");
    router.refresh();
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Wrong code");
        setCode("");
        setLoading(false);
        return;
      }
      goOnwards(role);
    } catch (err) {
      console.error(err);
      setError("Could not reach the server");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6 text-black font-[family-name:var(--font-montserrat)]">
      <div className="w-full max-w-md bg-white border border-black p-8 sm:p-12 space-y-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center space-y-2">
          <p className="text-[10px] font-extrabold tracking-[0.3em] uppercase text-ink-3">
            SIGN IN
          </p>
          <Link
            href="/"
            className="font-[family-name:var(--font-tenor-sans)] text-2xl sm:text-3xl font-bold uppercase tracking-[0.18em] text-black hover:opacity-75 transition-opacity inline-block"
          >
            VELUR
          </Link>
          <div className="w-12 h-0.5 bg-black mx-auto pt-1" />
        </div>

        {step === "code" ? (
          <form onSubmit={handleCode} className="space-y-5">
            <div>
              <label className="mb-2 block text-[10px] font-bold tracking-wider text-ink-2 uppercase">
                Code from the app
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
                inputMode="numeric"
                autoFocus
                className="w-full border border-black bg-neutral-50 px-4 py-3 text-center text-lg font-semibold tracking-[0.5em] text-black placeholder:text-ink-3 focus:ring-1 focus:ring-black"
              />
              <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
                The six-digit code from the authenticator app on your phone.
              </p>
            </div>

            {error && (
              <div className="animate-in fade-in border border-red-500 bg-red-50 p-3 text-xs font-semibold text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full cursor-pointer border border-black bg-black py-4 text-xs font-bold tracking-[0.25em] text-white uppercase transition-all duration-200 hover:bg-white hover:text-black disabled:opacity-50"
            >
              {loading ? "CHECKING…" : "CONFIRM"}
            </button>

            <button
              type="button"
              onClick={() => void startOver()}
              className="w-full cursor-pointer text-[10px] font-bold tracking-wider text-ink-3 uppercase transition-colors hover:text-black"
            >
              ← Sign in with another account
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-ink-2 mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
                onBlur={() =>
                  setFieldErrors((p) => ({ ...p, email: validateEmail(email) ?? undefined }))
                }
                placeholder="you@example.com"
                autoComplete="username"
                className={`w-full border px-4 py-3 text-xs focus:ring-1 focus:ring-black bg-neutral-50 font-medium text-black placeholder:text-ink-3 ${
                  fieldErrors.email ? "border-red-500" : "border-black"
                }`}
              />
              {fieldErrors.email && (
                <p className="text-[10px] text-red-500 mt-1 font-semibold">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-ink-2 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className={`w-full border px-4 py-3 text-xs focus:ring-1 focus:ring-black bg-neutral-50 font-medium text-black placeholder:text-ink-3 ${
                  fieldErrors.password ? "border-red-500" : "border-black"
                }`}
              />
              {fieldErrors.password && (
                <p className="text-[10px] text-red-500 mt-1 font-semibold">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-500 text-red-600 text-xs font-semibold p-3 animate-in fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white text-xs font-bold tracking-[0.25em] uppercase py-4 border border-black hover:bg-white hover:text-black transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {loading ? "SIGNING IN…" : "SIGN IN"}
            </button>
          </form>
        )}

        <div className="text-center pt-4 border-t border-neutral-100">
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-wider text-ink-3 hover:text-black transition-colors"
          >
            ← Back to the shop
          </Link>
        </div>
      </div>
    </main>
  );
}

