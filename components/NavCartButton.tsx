// components/NavCartButton.tsx (Server Component)
import Link from "next/link";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export default async function NavCartButton() {
  const supabase = createServerComponentClient({ cookies });

  // Count current user's cart lines
  const { count } = await supabase
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    // Tag this fetch so we can surgically revalidate on add-to-cart
    .maybeSingle({ head: true, count: "exact" } as any); // keeps TS happy

  const c = typeof count === "number" ? count : 0;

  return (
    <Link href="/cart" className="relative inline-flex items-center gap-2">
      {/* your cart icon here */}
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="opacity-80">
        <path d="M7 4h-2l-1 2v2h2l3.6 7.59-1.35 2.41c-.49.87.16 1.99 1.15 1.99h9v-2h-8.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h5.74c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1h-14.31l-.94-2h-3.75v2h2l3.6 7.59" fill="currentColor"/>
      </svg>

      {/* Badge */}
      {c > 0 && (
        <span className="absolute -top-1 -right-2 min-w-[1.25rem] h-5 rounded-full text-xs px-1.5 flex items-center justify-center
                         bg-red-600 text-white shadow">
          {c > 99 ? "99+" : c}
        </span>
      )}
    </Link>
  );
}
