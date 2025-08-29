﻿﻿// components/NavCartButton.tsx
import Link from "next/link";
import { createServerComponentSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * Small nav button that links to /cart and shows a badge with the
 * current cart item count for the signed-in user.
 *
 * - Pure server component (no client hooks).
 * - No external UI libs; simple Tailwind.
 * - Safe if user is not signed in (no badge).
 */
export default async function NavCartButton() {
  const supabase = createServerComponentSupabase();  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;

  let count = 0;
  if (uid) {
    const { count: c } = await supabase
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid);
    count = typeof c === "number" ? c : 0;
  }

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
      title="Cart"
    >
      {/* Simple cart glyph */}
      <span className="mr-2" aria-hidden="true">🛒</span>
      <span>Cart</span>

      {uid && count > 0 && (
        <span
          className="
            absolute -top-2 -right-2
            inline-flex min-w-[20px] items-center justify-center
            rounded-full bg-green-600 px-1.5 py-0.5
            text-xs font-semibold leading-none text-white
          "
          aria-label={`${count} items in cart`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
