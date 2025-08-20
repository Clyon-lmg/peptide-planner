// app/(app)/cart/PlaceOrderButton.tsx
"use client";
import { useState } from "react";

export default function PlaceOrderButton({ vendorId }: { vendorId: number }) {
  const [loading, setLoading] = useState(false);

  async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    const win = window.open("about:blank", "_blank", "noopener,noreferrer");
    const hadFocus = document.hasFocus();

    // If some wrapper also opens a tab, the current tab usually loses focus immediately.
    const loseFocusTimer = setTimeout(() => {}, 0); // placeholder; we’ll clear it

    try {
      setLoading(true);

      const res = await fetch(`/cart/checkout?vendor_id=${vendorId}`, { method: "GET" });
      const data = await res.json();

      if (!data?.ok) {
        if (win) win.close();
        alert(data?.error || "Checkout failed");
        return;
      }

      if (data.outbound) {
        if (win) {
          win.location.href = data.outbound;
        } else {
          window.open(data.outbound, "_blank", "noopener,noreferrer");
        }
      } else {
        if (win) win.close();
        alert("Order created. No external vendor link available.");
      }
    } catch (err: any) {
      if (win) win.close();
      alert(err?.message || "Unexpected error");
    } finally {
      clearTimeout(loseFocusTimer);

      // If we lost focus before we navigated our pre-opened tab, a wrapper likely opened a second tab.
      // Close our pre-opened tab to avoid leaving a blank.
      if (win && hadFocus && !document.hasFocus()) {
        try { win.close(); } catch {}
      }

      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="px-3 py-2 rounded-lg bg-primary text-primary-foreground"
    >
      {loading ? "Placing…" : "Place order"}
    </button>
  );
}
