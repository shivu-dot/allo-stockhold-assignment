"use client";

import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED";

type ReservationActionsProps = {
  id: string;
  initialStatus: ReservationStatus;
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
};

type ActionState = {
  confirmedAt: string | null;
  releasedAt: string | null;
  status: ReservationStatus;
};

export function ReservationActions({
  id,
  initialStatus,
  expiresAt,
  confirmedAt,
  releasedAt,
}: ReservationActionsProps) {
  const [actionState, setActionState] = useState<ActionState>({
    status: initialStatus,
    confirmedAt,
    releasedAt,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (actionState.status !== "PENDING") {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [actionState.status]);

  const expiresAtMs = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const isExpired = actionState.status === "PENDING" && now >= expiresAtMs;
  const effectiveStatus = isExpired ? "RELEASED" : actionState.status;
  const releaseTimestamp = actionState.releasedAt ?? (isExpired ? new Date(expiresAtMs).toISOString() : null);

  const countdownLabel =
    effectiveStatus === "PENDING"
      ? formatDistanceToNowStrict(new Date(expiresAt), {
          addSuffix: true,
        })
      : null;

  async function runAction(path: string, nextStatus: ReservationStatus) {
    setError(null);

    const response = await fetch(path, {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message ?? "Action failed.");

      if (response.status === 410) {
        setActionState((current) => ({
          ...current,
          status: "RELEASED",
          releasedAt: current.releasedAt ?? expiresAt,
        }));
      }

      return;
    }

      startTransition(() => {
        setActionState({
          status: nextStatus,
          confirmedAt: data.reservation.confirmedAt,
          releasedAt: data.reservation.releasedAt,
      });
    });
  }

  return (
    <div className="space-y-5 rounded-[28px] border border-[color:var(--line)] bg-white p-6 shadow-[0_24px_80px_rgba(64,44,13,0.08)]">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Reservation status</p>
        <p className="text-2xl font-semibold text-[color:var(--ink)]">{formatStatusLabel(effectiveStatus)}</p>
        {countdownLabel ? (
          <p className="text-sm text-[color:var(--muted)]">Expires {countdownLabel}.</p>
        ) : null}
        {effectiveStatus === "CONFIRMED" && actionState.confirmedAt ? (
          <p className="text-sm text-[color:var(--success)]">
            Confirmed at {new Date(actionState.confirmedAt).toLocaleString()}.
          </p>
        ) : null}
        {effectiveStatus === "RELEASED" && releaseTimestamp ? (
          <p className="text-sm text-[color:var(--muted)]">
            Released at {new Date(releaseTimestamp).toLocaleString()}.
          </p>
        ) : null}
      </div>

      {effectiveStatus === "PENDING" ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => runAction(`/api/reservations/${id}/confirm`, "CONFIRMED")}
            className="h-11 rounded-xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-[color:var(--line-strong)]"
            disabled={isPending || isExpired}
          >
            Confirm purchase
          </button>
          <button
            type="button"
            onClick={() => runAction(`/api/reservations/${id}/release`, "RELEASED")}
            className="h-11 rounded-xl border border-[color:var(--line-strong)] px-5 text-sm font-semibold text-[color:var(--ink)] transition hover:border-[color:var(--ink)] disabled:cursor-not-allowed disabled:text-[color:var(--muted)]"
            disabled={isPending}
          >
            Cancel reservation
          </button>
        </div>
      ) : null}

      {isExpired && !error ? (
        <p className="text-sm text-[color:var(--danger)]">
          This reservation has expired and the units are available again.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}

      <Link
        href="/"
        className="inline-flex text-sm font-semibold text-[color:var(--accent)] transition hover:text-[color:var(--accent-strong)]"
      >
        Back to inventory
      </Link>
    </div>
  );
}

function formatStatusLabel(status: ReservationStatus) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmed";
    case "RELEASED":
      return "Released";
    default:
      return "Pending";
  }
}
