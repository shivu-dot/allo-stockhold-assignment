import { getReservationTtlMinutes } from "@/lib/env";
import { type CatalogProduct, getCatalog } from "@/lib/catalog";
import { ReserveForm } from "@/components/reserve-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  let products: CatalogProduct[] = [];
  let catalogError: string | null = null;

  try {
    products = await getCatalog();
  } catch (error) {
    if (isNextDynamicServerError(error)) {
      throw error;
    }

    console.error("Catalog load failed", error);
    catalogError = "The database is not configured or reachable for this deployment.";
  }

  const reservationTtlMinutes = getReservationTtlMinutes();

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--panel)]/90 px-6 py-8 shadow-[0_30px_120px_rgba(64,44,13,0.08)] md:px-10">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Allo Engineering Take-home
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--ink)] md:text-5xl">
              Inventory reservations with a clear checkout hold flow
            </h1>
            <p className="text-base leading-8 text-[color:var(--muted)] md:text-lg">
              Customers can hold units for {reservationTtlMinutes} minutes while payment is in progress.
              Confirming the reservation permanently decrements stock. Cancelling or expiring the hold
              releases the units back into availability.
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <article className="rounded-[28px] border border-[color:var(--line)] bg-white/90 p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Rule</p>
            <h2 className="mt-3 text-xl font-semibold text-[color:var(--ink)]">Atomic reservation</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              The reserve endpoint performs a guarded inventory update inside a database transaction, so
              only one request can claim the final unit.
            </p>
          </article>
          <article className="rounded-[28px] border border-[color:var(--line)] bg-white/90 p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Expiry</p>
            <h2 className="mt-3 text-xl font-semibold text-[color:var(--ink)]">Automatic release</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              Pending reservations are lazily released during reads and writes, which keeps available
              stock correct without requiring a permanently running worker.
            </p>
          </article>
          <article className="rounded-[28px] border border-[color:var(--line)] bg-white/90 p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Experience</p>
            <h2 className="mt-3 text-xl font-semibold text-[color:var(--ink)]">Visible errors</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              The UI surfaces stock conflicts and expiries directly, so `409` and `410` cases are easy
              to test during the review.
            </p>
          </article>
        </section>

        {catalogError ? (
          <section className="rounded-[28px] border border-[color:var(--danger)]/30 bg-white/95 p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--danger)]">
              Deployment Notice
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[color:var(--ink)]">
              The app is live, but the database is not connected yet
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--muted)]">
              Reviewers can still view the implementation notes on this page. To enable the catalog and
              reservation flow, configure `DATABASE_URL` in Vercel, run the Prisma migration, and seed the
              database.
            </p>
          </section>
        ) : null}

        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">Catalog</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--ink)]">
                Products and warehouse availability
              </h2>
            </div>
            <p className="max-w-md text-right text-sm leading-7 text-[color:var(--muted)]">
              The lower-stock shaker bottle rows are useful for testing concurrency conflicts.
            </p>
          </div>

          <div className="space-y-8">
            {products.length > 0 ? (
              products.map((product) => (
              <article
                key={product.id}
                className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--panel)]/90 p-6 shadow-[0_20px_60px_rgba(64,44,13,0.06)] md:p-8"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      {product.sku}
                    </p>
                    <h3 className="text-2xl font-semibold text-[color:var(--ink)]">{product.name}</h3>
                    <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
                      {product.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {product.warehouses.map((warehouse) => (
                    <div
                      key={warehouse.inventoryId}
                      className="rounded-[28px] border border-[color:var(--line)] bg-white p-5 shadow-sm"
                    >
                      <div className="space-y-1">
                        <p className="text-sm uppercase tracking-[0.22em] text-[color:var(--muted)]">
                          {warehouse.warehouseCode}
                        </p>
                        <h4 className="text-xl font-semibold text-[color:var(--ink)]">
                          {warehouse.warehouseName}
                        </h4>
                        <p className="text-sm text-[color:var(--muted)]">{warehouse.warehouseLocation}</p>
                      </div>

                      <dl className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-[color:var(--panel)] p-4">
                        <div>
                          <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            Available
                          </dt>
                          <dd className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">
                            {warehouse.availableUnits}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            Reserved
                          </dt>
                          <dd className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">
                            {warehouse.reservedUnits}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            Total
                          </dt>
                          <dd className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">
                            {warehouse.totalUnits}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-5">
                        <ReserveForm
                          availableUnits={warehouse.availableUnits}
                          productId={product.id}
                          warehouseId={warehouse.warehouseId}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
              ))
            ) : (
              <div className="rounded-[28px] border border-[color:var(--line)] bg-white/90 p-6 text-sm leading-7 text-[color:var(--muted)] shadow-sm">
                Catalog data will appear here after the deployment database is configured and seeded.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function isNextDynamicServerError(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    (error as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
  );
}
