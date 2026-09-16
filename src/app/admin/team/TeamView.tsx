"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, fieldCls, hintCls, inputCls, Notice, PageBody, PageHeader } from "../ui";
import { useConfirm } from "../useConfirm";
import { fieldErrorsFrom, userSchema, type FieldErrors } from "@/lib/validation";
import type { TeamMember } from "@/lib/db";

/**
 * Team management dashboard for user creation, access revoking, MFA reset, and password updates.
 *
 * NOTE: (§3.4, §8.1) Supports soft revoking to preserve audit history and MFA factor resets.
 */
export function TeamView({
  initialMembers,
  currentUser,
}: {
  initialMembers: TeamMember[];
  currentUser: { id: string; role: string } | null;
}) {
  const { confirm, dialog } = useConfirm();
  const [usersList, setUsersList] = useState<TeamMember[]>(initialMembers);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);

  const clearError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (reloadKey === 0) return;

    let cancelled = false;
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((users: TeamMember[]) => {
        if (!cancelled) setUsersList(users);
      })
      .catch((err) => console.error("Failed to load team:", err));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleCreateAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = userSchema.safeParse({
      name: newAdminName,
      email: newAdminEmail,
      password: newAdminPassword,
      role: "MANAGER",
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      setNotice(null);
      return;
    }

    setErrors({});
    setNotice(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNotice(data.error ?? "The account could not be created.");
        return;
      }
      setShowUserModal(false);
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      reload();
    } catch (err) {
      console.error(err);
      setNotice("Connection failed. Try again.");
    }
  };

  const handleToggleUserAccess = async (member: TeamMember) => {
    const agreed = await confirm({
      title: member.isActive ? "Switch access off?" : "Restore access?",
      body: member.isActive
        ? `${member.name} will no longer be able to sign in. The account stays, so the journal keeps pointing at a real person.`
        : `${member.name} will be able to sign in again.`,
      confirmLabel: member.isActive ? "Switch off" : "Restore",
      destructive: member.isActive,
    });
    if (!agreed) return;
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNotice(data.error ?? "Access could not be changed.");
        return;
      }
      setNotice(null);
      reload();
    } catch (err) {
      console.error(err);
      setNotice("Connection failed. Try again.");
    }
  };

  const handleResetMfa = async (member: TeamMember) => {
    const agreed = await confirm({
      title: "Reset two-factor sign-in?",
      body: `${member.name} will be able to sign in with the password alone and set the app up again straight away. Every current session of theirs ends. Do this only once you are sure it is really them asking — by telephone or in person.`,
      confirmLabel: "Reset",
      destructive: true,
    });
    if (!agreed) return;
    try {
      const res = await fetch(`/api/users/${member.id}/reset-mfa`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNotice(data.error ?? "2FA could not be reset.");
        return;
      }
      setNotice(`Two-factor sign-in for ${member.name} has been reset.`);
      reload();
    } catch (err) {
      console.error(err);
      setNotice("Connection failed. Try again.");
    }
  };

  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const handleSetPassword = async (member: TeamMember) => {
    try {
      const res = await fetch(`/api/users/${member.id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNotice(data.error ?? "The password could not be changed.");
        return;
      }
      setNotice(`The password for ${member.name} has been changed. Hand it over in person.`);
      setPasswordFor(null);
      setNewPassword("");
    } catch (err) {
      console.error(err);
      setNotice("Connection failed. Try again.");
    }
  };

  return (
    <PageBody className="space-y-8">
      {dialog}
      <div className="space-y-6 animate-in fade-in duration-200">
        <PageHeader
          title="Team"
          hint="Switching access off is not deletion: the account stays, so the journal keeps pointing at a real person."
        />
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-neutral-200 p-4">
          <div>
            <h2 className="font-montserrat text-base font-bold uppercase tracking-wider text-black">
              System administrators
            </h2>
            <p className="text-xs text-ink-2 font-medium">
              Manage access for your team: emails and passwords.
            </p>
          </div>

          {currentUser?.role === "OWNER" && (
            <button
              onClick={() => setShowUserModal(true)}
              className="bg-black text-white text-xs font-bold tracking-[0.2em] uppercase px-6 py-3 border border-neutral-200 hover:bg-white hover:text-black transition-all cursor-pointer"
            >
              + Add a manager
            </button>
          )}
        </div>

        <div className="bg-white border border-neutral-200 divide-y divide-neutral-200">
          {usersList.map((u) => (
            <div
              key={u.id}
              className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-bold text-sm text-black">{u.name}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-black text-white px-2 py-0.5">
                    {u.role === "OWNER" ? "Owner" : "Manager"}
                  </span>
                  {!u.isActive && (
                    <span className="text-[10px] font-extrabold uppercase tracking-widest bg-neutral-200 text-ink-2 px-2 py-0.5">
                      Access switched off
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-2 font-medium">{u.email}</p>
              </div>

              {currentUser?.role === "OWNER" && u.id !== currentUser.id && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setPasswordFor(passwordFor === u.id ? null : u.id);
                      setNewPassword("");
                      setNotice(null);
                    }}
                    className="cursor-pointer border border-neutral-300 px-3 py-1.5 text-xs font-bold tracking-wider text-ink-2 uppercase transition-all hover:border-black hover:text-black"
                  >
                    New password
                  </button>
                  <button
                    onClick={() => void handleResetMfa(u)}
                    className="cursor-pointer border border-neutral-300 px-3 py-1.5 text-xs font-bold tracking-wider text-ink-2 uppercase transition-all hover:border-black hover:text-black"
                  >
                    Reset 2FA
                  </button>
                  <button
                    onClick={() => handleToggleUserAccess(u)}
                    className={`text-xs font-bold uppercase tracking-wider border px-3 py-1.5 transition-all cursor-pointer ${
                      u.isActive
                        ? "text-red-600 border-red-200 hover:border-red-600 hover:bg-red-50"
                        : "text-emerald-700 border-emerald-200 hover:border-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {u.isActive ? "Switch access off" : "Restore access"}
                  </button>
                </div>
              )}

              {passwordFor === u.id && (
                <div className="w-full space-y-3 border-t border-neutral-100 pt-4">
                  <p className={hintCls}>
                    Think of a password and hand it to {u.name} in person — they cannot change it
                    themselves, and only you can reset it.
                  </p>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="off"
                    className={`${inputCls} sm:max-w-sm`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={newPassword.length < 8}
                      onClick={() => void handleSetPassword(u)}
                      className="cursor-pointer border border-black bg-black px-3 py-1.5 text-xs font-bold tracking-wider text-white uppercase transition-all hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordFor(null);
                        setNewPassword("");
                      }}
                      className="cursor-pointer border border-neutral-300 px-3 py-1.5 text-xs font-bold tracking-wider text-ink-2 uppercase transition-all hover:border-black hover:text-black"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative max-h-[85svh] w-full max-w-md space-y-6 overflow-y-auto border border-neutral-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <h2 className="font-montserrat text-base font-bold uppercase tracking-wider text-black">
                New administrator
              </h2>
              <button
                onClick={() => setShowUserModal(false)}
                className="w-8 h-8 flex items-center justify-center border border-neutral-200 hover:bg-black hover:text-white transition-colors cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdminUser} className="space-y-4 text-xs" noValidate>
              {notice && <Notice>{notice}</Notice>}

              <Field label="Full name *" error={errors.name}>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => {
                    setNewAdminName(e.target.value);
                    clearError("name");
                  }}
                  placeholder="Olena Koval"
                  className={fieldCls(Boolean(errors.name))}
                />
              </Field>

              <Field label="Sign-in email *" error={errors.email}>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => {
                    setNewAdminEmail(e.target.value);
                    clearError("email");
                  }}
                  placeholder="olena@velur.beauty"
                  className={fieldCls(Boolean(errors.email))}
                />
              </Field>

              <Field
                label="Sign-in password *"
                hint="At least 12 characters, upper and lower case, and a digit"
                error={errors.password}
              >
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => {
                    setNewAdminPassword(e.target.value);
                    clearError("password");
                  }}
                  placeholder="••••••••••••"
                  className={fieldCls(Boolean(errors.password))}
                />
              </Field>

              <div className="pt-4 border-t border-neutral-200 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 bg-white text-black py-3 border border-neutral-300 text-xs font-bold uppercase tracking-wider hover:bg-neutral-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-black text-white py-3 border border-neutral-200 text-xs font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-all cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageBody>
  );
}

