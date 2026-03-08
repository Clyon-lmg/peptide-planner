"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md p-6 mt-12">
      <div className="rounded-xl border p-8 space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Your trial has ended</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Subscribe to keep tracking your peptide protocols.
          </p>
        </div>

        <div className="rounded-lg bg-muted/40 p-6 text-left space-y-3">
          <div className="text-3xl font-bold">$3.99<span className="text-base font-normal text-muted-foreground">/month</span></div>
          <ul className="space-y-2 text-sm">
            {[
              "Unlimited protocols & dose tracking",
              "Injection site rotation",
              "Inventory management",
              "Dose reminders",
              "Calendar export",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full rounded px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Subscribe now"}
        </button>

        <p className="text-xs text-muted-foreground">
          Secure payment via Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
