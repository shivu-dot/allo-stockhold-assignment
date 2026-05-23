import { format } from "date-fns";
import { notFound } from "next/navigation";

import { ReservationActions } from "@/components/reservation-actions";
import { getReservationDetails } from "@/lib/catalog";

type ReservationPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ReservationPage({ params }: ReservationPageProps) {
  const { id } = await params;
  const reservation = await getReservationDetails(id);

  if (!reservation) {
    notFound();
  }

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--panel)]/90 p-6 shadow-[0_20px_60px_rgba(64,44,13,0.08)] md:p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-[color:var(--muted)]">Checkout hold</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--ink)]">
            {reservation.product.name}
          </h1>
          <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
            Reservation ID <span className="font-mono text-[color:var(--ink)]">{reservation.id}</span>
          </p>

          <dl className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoCard label="SKU" value={reservation.product.sku} />
            <InfoCard label="Quantity" value={String(reservation.quantity)} />
            <InfoCard label="Warehouse" value={reservation.warehouse.name} />
            <InfoCard label="Location" value={reservation.warehouse.location} />
            <InfoCard label="Created" value={format(reservation.createdAt, "PPP p")} />
            <InfoCard label="Expires" value={format(reservation.expiresAt, "PPP p")} />
          </dl>

          <div className="mt-8 rounded-[28px] border border-[color:var(--line)] bg-white p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Flow summary</p>
            <ol className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--muted)]">
              <li>1. This reservation holds stock temporarily while payment is in progress.</li>
              <li>2. Confirming the purchase reduces both reserved stock and total stock.</li>
              <li>3. Cancelling or expiring the hold releases reserved units back to availability.</li>
            </ol>
          </div>
        </section>

        <ReservationActions
          id={reservation.id}
          initialStatus={reservation.status}
          expiresAt={reservation.expiresAt.toISOString()}
          confirmedAt={reservation.confirmedAt?.toISOString() ?? null}
          releasedAt={reservation.releasedAt?.toISOString() ?? null}
        />
      </div>
    </main>
  );
}

type InfoCardProps = {
  label: string;
  value: string;
};

function InfoCard({ label, value }: InfoCardProps) {
  return (
    <div className="rounded-[24px] border border-[color:var(--line)] bg-white p-5 shadow-sm">
      <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</dt>
      <dd className="mt-3 text-lg font-semibold text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}
