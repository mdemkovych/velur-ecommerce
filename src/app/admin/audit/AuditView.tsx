"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  CRITICAL_AUDIT_ACTIONS,
  MANAGER_VISIBLE_AUDIT_ACTIONS,
  type AuditAction,
} from "@/lib/types";
import { hintCls, inputCls, PageBody, PageHeader, Select } from "../ui";
import { useConfirm } from "../useConfirm";

interface AuditRecord {
  id: string;
  timestamp: string;
  actorLabel: string;
  actorName?: string;
  action: string;
  target: string;
  ip?: string;
  details?: unknown;
}

function actorText(entry: AuditRecord): string {
  if (entry.actorName) return entry.actorName;
  if (entry.actorLabel === "system") return "System";
  if (entry.actorLabel === "monobank-webhook") return "Monobank";
  if (entry.actorLabel === "anonymous") return "Anonymous";
  return entry.actorLabel;
}

function actionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}

function isCritical(action: string): boolean {
  return CRITICAL_AUDIT_ACTIONS.includes(action as AuditAction);
}

/**
 * Audit trail table view rendering security and administrative event records.
 *
 * NOTE: (§8.1, §8.4) Provides cursor pagination, query search, action filtering, and owner single-entry purge.
 */
export function AuditView({ isOwner = true }: { isOwner?: boolean }) {
  const [entries, setEntries] = useState<AuditRecord[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function removeEntry(entry: AuditRecord) {
    const ok = await confirm({
      title: "Delete the entry from the journal?",
      body: `«${actionLabel(entry.action)}» — ${entry.target}. The entry will be gone for good. The journal keeps a trace that you removed it, and that trace cannot be removed.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setError(null);
    try {
      const res = await fetch(`/api/audit/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "The entry could not be deleted");
        return;
      }
      setEntries((prev) => (prev ?? []).filter((row) => row.id !== entry.id));
    } catch {
      setError("Connection failed. Try again.");
    }
  }

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (search.trim()) params.set("q", search.trim());
      if (cursor) params.set("cursor", cursor);
      return `/api/audit?${params.toString()}`;
    },
    [action, search],
  );

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      fetch(buildUrl())
        .then((res) => res.json())
        .then((data: { entries: AuditRecord[]; nextCursor: string | null }) => {
          if (cancelled) return;
          setEntries(data.entries ?? []);
          setNextCursor(data.nextCursor ?? null);
        })
        .catch((err) => {
          console.error("Failed to load the audit trail:", err);
          if (!cancelled) setEntries([]);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildUrl]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextCursor));
      const data = (await res.json()) as {
        entries: AuditRecord[];
        nextCursor: string | null;
      };
      setEntries((prev) => [...(prev ?? []), ...(data.entries ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      console.error("Failed to load more audit entries:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <PageBody className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        title="Action journal"
        hint={
          isOwner
            ? "Who changed what, and when. Written automatically and never edited — including payment mismatches, which are visible nowhere else."
            : "What happened to orders and their money. Written automatically and never edited."
        }
      />

      <div className="flex flex-col gap-3 border border-neutral-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="w-full min-w-0 sm:min-w-[240px] sm:flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number, product or email…"
            className={inputCls}
          />
        </div>
        <Select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
          className="w-full sm:w-auto"
        >
          <option value="">All actions</option>
          {(isOwner ? AUDIT_ACTIONS : MANAGER_VISIBLE_AUDIT_ACTIONS).map((value) => (
            <option key={value} value={value}>
              {AUDIT_ACTION_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      {entries === null ? (
        <div className="py-20 text-center bg-white border border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-3">
            Loading the journal…
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="py-20 text-center bg-white border border-neutral-200">
          <p className="text-sm font-bold uppercase tracking-wider text-ink-3">
            No entries found
          </p>
        </div>
      ) : (
        <>
          <p className={`${hintCls} mb-2 lg:hidden`}>
            The table is wider than the screen — scroll sideways to see the rest of the columns.
          </p>
          <div className="border border-neutral-200 bg-white overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  {["Time", "Who", "Action", "Target", ...(isOwner ? ["IP", ""] : [])].map(
                    (heading, i) => (
                      <th
                        key={heading || `actions-${i}`}
                        className="px-4 py-3 font-bold uppercase tracking-wider text-[11px] text-ink-3 whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50 transition-colors align-top">
                    <td className="px-4 py-3 text-ink-2 font-medium whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString("uk-UA", {
                        timeZone: "Europe/Kyiv",
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-black whitespace-nowrap">
                      {actorText(entry)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block max-w-[13rem] px-2 py-1 text-[11px] leading-snug font-bold tracking-wider uppercase ${
                          isCritical(entry.action)
                            ? "bg-red-100 text-red-900 border border-red-300"
                            : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                        }`}
                      >
                        {actionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 font-mono break-all">
                      {entry.target}
                      {entry.details !== undefined && (
                        <span className="block text-[11px] text-ink-3 font-sans mt-0.5 break-all">
                          {JSON.stringify(entry.details)}
                        </span>
                      )}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 font-mono whitespace-nowrap text-ink-3">
                        {entry.ip ?? "—"}
                      </td>
                    )}
                    {isOwner && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void removeEntry(entry)}
                          aria-label="Delete the entry"
                          title="Delete the entry"
                          className="cursor-pointer border-0 bg-transparent p-2 text-ink-3 transition-colors hover:text-red-700"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden
                          >
                            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {error && (
        <p className="border border-red-300 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800">
          {error}
        </p>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="w-full border border-neutral-300 bg-white py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-ink-2 hover:border-black hover:text-black transition-colors cursor-pointer disabled:opacity-40"
        >
          {isLoadingMore ? "Loading…" : "Show more"}
        </button>
      )}

      {dialog}
    </PageBody>
  );
}

