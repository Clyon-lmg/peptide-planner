// app/(app)/orders/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import {
  createServerComponentClient,
  createServerActionClient,
} from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

type Vendor = { name: string; homepage: string | null };
type VendorsRelation = Vendor | Vendor[] | null;

type OrderRaw = {
  id: number;
  vendor_id: number;
  status: "DRAFT" | "PLACED" | "RECEIVED";
  created_at: string | null;
  placed_at: string | null;
  received_at: string | null;
  vendors: VendorsRelation; // may be array or object
};

type Shipment = {
  id: number;
  order_id: number;
  carrier: string | null;
  tracking_number: string | null;
  eta: string | null;
  status: string | null;
};

type AffiliateLink = {
  id: number;
  vendor_id: number;
  base_url: string;
  param_key: string | null;
  param_value: string | null;
  active: boolean;
};

function getVendor(rel: VendorsRelation): Vendor | null {
  if (!rel) return null;
  if (Array.isArray(rel)) {
    const first = rel[0];
    if (first && typeof first.name === "string") {
      return { name: first.name, homepage: first.homepage ?? null };
    }
    return null;
  }
  const v = rel as Vendor;
  if (typeof v.name === "string") return { name: v.name, homepage: v.homepage ?? null };
  return null;
}

function buildAffiliateUrl(vendorHomepage: string | null | undefined, aff?: AffiliateLink) {
  let url = aff?.base_url || vendorHomepage || "#";
  try {
    const u = new URL(url);
    if (aff?.param_key && aff.param_value) u.searchParams.set(aff.param_key, aff.param_value);
    return u.toString();
  } catch {
    return url || "#";
  }
}

async function getUser() {
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null };
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

  const [{ data: rawOrders }, { data: shipments }, { data: affLinks }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, vendor_id, status, created_at, placed_at, received_at, vendors(name, homepage)"
      )
      .eq("user_id", user.id)
      .order("id", { ascending: false }),
    supabase.from("shipments").select("id, order_id, carrier, tracking_number, eta, status"),
    supabase
      .from("affiliate_links")
      .select("id, vendor_id, base_url, param_key, param_value, active")
      .eq("active", true),
  ]);

  const affByVendor = new Map<number, AffiliateLink>(
    (affLinks ?? []).map((a: any) => [a.vendor_id, a as AffiliateLink])
  );

  // Normalize vendors relation into a single object for each order
  const orders = (rawOrders ?? []).map((o: OrderRaw) => {
    const vendor = getVendor(o.vendors);
    return {
      ...o,
      vendor, // { name, homepage } | null
    };
  });

  const shipByOrder = new Map<number, Shipment | null>();
  (shipments ?? []).forEach((s: any) => {
    if (!shipByOrder.has(s.order_id)) shipByOrder.set(s.order_id, s as Shipment);
  });

  // ---- Inline server actions (must return Promise<void>) ----------------
  const setStatus = async (formData: FormData) => {
    "use server";
    const orderId = Number(formData.get("order_id") || 0);
    const next = String(formData.get("status") || "");
    if (!orderId || !["DRAFT", "PLACED", "RECEIVED"].includes(next)) return;

    const sb = createServerActionClient({ cookies });
    const { data: auth } = await sb.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;

    // Update timestamps according to status
    const now = new Date().toISOString();
    let patch: any = { status: next };
    if (next === "DRAFT") {
      patch.placed_at = null;
      patch.received_at = null;
    } else if (next === "PLACED") {
      patch.placed_at = now;
      patch.received_at = null;
    } else if (next === "RECEIVED") {
      patch.received_at = now;
    }

    await sb.from("orders").update(patch).eq("id", orderId).eq("user_id", uid);
  };

  const deleteOrder = async (formData: FormData) => {
    "use server";
    const orderId = Number(formData.get("order_id") || 0);
    if (!orderId) return;

    const sb = createServerActionClient({ cookies });
    const { data: auth } = await sb.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;

    // Delete order; assume FK cascade removes order_items (or handle separately if not)
    await sb.from("orders").delete().eq("id", orderId).eq("user_id", uid);
  };
  // ----------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link href="/cart" className="text-sm underline">
          Back to Cart
        </Link>
      </header>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const shipment = shipByOrder.get(o.id) ?? null;
            const aff = affByVendor.get(o.vendor_id);
            const visitUrl = buildAffiliateUrl(o.vendor?.homepage, aff);

            return (
              <section key={o.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {o.vendor?.name ?? "Vendor"} — Order #{o.id}
                    </h2>
                    <div className="mt-1 text-xs text-gray-500">
                      Created: {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                      {" · "}Placed: {o.placed_at ? new Date(o.placed_at).toLocaleString() : "—"}
                      {" · "}Received: {o.received_at ? new Date(o.received_at).toLocaleString() : "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {visitUrl !== "#" && (
                      <a
                        href={visitUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline"
                        title="Visit vendor (affiliate link)"
                      >
                        Visit site
                      </a>
                    )}

                    {/* Delete button (top-right near status selector) */}
                    <form action={deleteOrder}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <button
                        type="submit"
                        className="rounded px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white"
                        title="Delete order"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="text-sm">
                    <span className="font-medium">Status:</span>{" "}
                    <span
                      className={
                        o.status === "RECEIVED"
                          ? "text-green-700"
                          : o.status === "PLACED"
                          ? "text-blue-700"
                          : "text-gray-700"
                      }
                    >
                      {o.status}
                    </span>
                  </div>

                  <form action={setStatus} className="flex items-center gap-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <label className="text-sm">
                      Change to
                      <select
                        name="status"
                        defaultValue=""
                        className="ml-2 rounded border px-2 py-1"
                      >
                        <option value="">Select…</option>
                        {o.status !== "DRAFT" && <option value="DRAFT">Draft</option>}
                        {o.status !== "PLACED" && <option value="PLACED">Placed</option>}
                        {o.status !== "RECEIVED" && <option value="RECEIVED">Received</option>}
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="rounded px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Save
                    </button>
                  </form>
                </div>

                {/* Shipment block */}
                <div className="rounded-lg border p-3 text-sm">
                  <div className="font-medium mb-1">Shipment</div>
                  {shipment ? (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <div className="text-xs text-gray-500">Carrier</div>
                        <div>{shipment.carrier || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Tracking #</div>
                        <div>{shipment.tracking_number || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">ETA</div>
                        <div>{shipment.eta ? new Date(shipment.eta).toLocaleDateString() : "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Status</div>
                        <div>{shipment.status || "—"}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500">No shipment info.</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
