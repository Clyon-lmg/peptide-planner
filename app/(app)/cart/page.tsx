// app/(app)/cart/page.tsx
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import CartVendorCard from "./CartVendorCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CartPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: ures } = await supabase.auth.getUser();

  if (!ures?.user) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Cart</h1>
        <p className="text-sm text-muted-foreground">
          Please sign in to view your cart.
        </p>
      </main>
    );
  }

  const user_id = ures.user.id as string;
  const { data: rows } = await supabase
    .from("cart_items")
    .select("vendor_id")
    .eq("user_id", user_id);

  const vendorIds = Array.from(new Set((rows ?? []).map((r) => r.vendor_id as number)));

  return (
    <main
      className="
        max-w-5xl mx-auto p-6 space-y-6
      "
    >
      <h1 className="text-2xl font-semibold">Cart</h1>

      {vendorIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
      ) : (
        vendorIds.map((vid) => <CartVendorCard key={vid} vendorId={vid} />)
      )}
    </main>
  );
}
