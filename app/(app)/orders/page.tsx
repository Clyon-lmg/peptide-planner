// app/(app)/orders/page.tsx
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import {
  markPlacedAction,
  addTrackingAction,
  markReceivedAction,
  deleteOrderAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Order = {
  id: number;
  vendor_id: number;
  status: "DRAFT" | "PLACED" | "RECEIVED" | string;
  created_at: string;
  placed_at: string | null;
  received_at: string | null;
  vendors: { name: string; homepage: string | null } | null;
};

type AffiliateLink = {
  vendor_id: number;
  base_url: string;
  param_key: string | null;
  param_value: string | null;
};

type Shipment = {
  order_id: number;
  tracking_number: string | null;
  carrier: string | null;
  last_status: string | null;
  eta_date: string | null;
} | null;

async function getUser() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null };
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    PLACED: "bg-blue-100 text-blue-800",
    RECEIVED: "bg-green-100 text-green-800",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-800";
  return <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>{status}</span>;
}

function buildAffiliateUrl(vendorHome: string | null | undefined, aff?: AffiliateLink) {
  let url = aff?.base_url || vendorHome || "#";
  try {
    const u = new URL(url);
    if (aff?.param_key && aff.param_value) u.searchParams.set(aff.param_key, aff.param_value);
    return u.toString();
  } catch {
    return url;
  }
}

export default async function OrdersPage() {
  const { supabase, user } = await getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border p-6">
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="mt-2 text-sm">
            You’re not signed in.{" "}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>{" "}
            to view orders.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: orders }, { data: shipments }, { data: affLinks }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, vendor_id, status, created_at, placed_at, received_at, vendors(name, homepage)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("shipments").select("order_id, tracking_number, carrier, last_status, eta_date"),
    supabase.from("affiliate_links").select("vendor_id, base_url, param_key, param_value").eq("active", true),
  ]);

  const shipByOrder = new Map<number, Shipment>();
  (shipments ?? []).forEach((s: any) => shipByOrder.set(s.order_id, s));
  const affByVendor = new Map<number, AffiliateLink>(
    (affLinks ?? []).map((a: any) => [a.vendor_id, a as AffiliateLink]),
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link href="/cart" className="text-sm underline">
          Back to Cart
        </Link>
      </header>

      {(orders ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {(orders ?? []).map((o: Order) => {
            const sh = shipByOrder.get(o.id) ?? null;
            const aff = affByVendor.get(o.vendor_id);
            const visitUrl = buildAffiliateUrl(o.vendors?.homepage, aff);

            return (
              <section key={o.id} className="rounded-xl border p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">{o.vendors?.name ?? "Vendor"}</h2>
                    <div className="text-xs text-gray-500">
                      Created {new Date(o.created_at).toLocaleString()}
                      {o.placed_at ? ` • Placed ${new Date(o.placed_at).toLocaleString()}` : ""}
                      {o.received_at ? ` • Received ${new Date(o.received_at).toLocaleString()}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {visitUrl !== "#" ? (
                      <a
                        href={visitUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline"
                        title="Visit vendor"
                      >
                        Visit site
                      </a>
                    ) : null}
                    <Badge status={o.status} />
                    <form action={deleteOrderAction}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <button
                        type="submit"
                        className="ml-2 rounded px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white"
                        title="Delete order"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Mark Placed */}
                  <form action={markPlacedAction} className="flex items-center gap-3 rounded border p-3">
                    <input type="hidden" name="order_id" value={o.id} />
                    <div className="text-sm font-medium">Mark as Placed</div>
                    <div className="ml-auto">
                      <button
                        type="submit"
                        className="rounded px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Placed
                      </button>
                    </div>
                  </form>

                  {/* Add/Update Tracking */}
                  <form action={addTrackingAction} className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded border p-3 items-center">
                    <input type="hidden" name="order_id" value={o.id} />
                    <label className="text-sm md:col-span-2">
                      Tracking #
                      <input
                        name="tracking_number"
                        type="text"
                        defaultValue={sh?.tracking_number ?? ""}
                        className="mt-1 w-full rounded border px-2 py-2"
                        placeholder="1Z..."
                      />
                    </label>
                    <label className="text-sm">
                      Carrier
                      <input
                        name="carrier"
                        type="text"
                        defaultValue={sh?.carrier ?? ""}
                        className="mt-1 w-full rounded border px-2 py-2"
                        placeholder="UPS/USPS/FedEx"
                      />
                    </label>
                    <button
                      type="submit"
                      className="self-end rounded px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Save
                    </button>
                    {sh?.last_status || sh?.eta_date ? (
                      <div className="md:col-span-4 text-xs text-gray-600">
                        {sh?.last_status ? `Last status: ${sh.last_status}` : ""}
                        {sh?.eta_date ? ` • ETA: ${new Date(sh.eta_date).toLocaleDateString()}` : ""}
                      </div>
                    ) : null}
                  </form>

                  {/* Mark Received */}
                  <form action={markReceivedAction} className="flex items-center gap-3 rounded border p-3">
                    <input type="hidden" name="order_id" value={o.id} />
                    <div className="text-sm font-medium">Mark as Received</div>
                    <div className="ml-auto">
                      <button
                        type="submit"
                        className="rounded px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white"
                      >
                        Received
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
