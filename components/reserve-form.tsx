"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ReserveFormProps = {
  availableUnits: number;
  productId: string;
  warehouseId: string;
};

export function ReserveForm({
  availableUnits,
  productId,
  warehouseId,
}: ReserveFormProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const maxQuantity = Math.max(1, availableUnits);

  async function handleSubmit(formData: FormData) {
    setError(null);

    const payload = {
      productId,
      warehouseId,
      quantity: Number(formData.get("quantity") ?? quantity),
    };

    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message ?? "Reservation failed.");
      return;
    }

    startTransition(() => {
      router.push(`/reservations/${data.reservation.id}`);
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-2xl border border-[color:var(--line)] bg-white/90 p-4 shadow-sm"
    >
      <div className="flex items-end justify-between gap-3">
        <label className="flex flex-col gap-2 text-sm text-[color:var(--muted)]">
          Quantity
          <input
            className="h-11 w-24 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] px-3 text-base text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
            type="number"
            name="quantity"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(event) => {
              const nextQuantity = Number(event.target.value);
              if (Number.isNaN(nextQuantity)) {
                setQuantity(1);
                return;
              }

              setQuantity(Math.min(maxQuantity, Math.max(1, nextQuantity)));
            }}
            disabled={availableUnits === 0 || isPending}
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-[color:var(--line-strong)]"
          disabled={availableUnits === 0 || isPending}
        >
          {isPending ? "Reserving..." : "Reserve"}
        </button>
      </div>

      {availableUnits === 0 ? (
        <p className="text-sm text-[color:var(--danger)]">No units are currently available in this warehouse.</p>
      ) : null}

      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
    </form>
  );
}
