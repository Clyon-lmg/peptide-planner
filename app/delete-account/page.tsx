"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAccountPage() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmed = confirmText === "delete me";
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    if (res.status === 401) {
      // Not signed in — send them to sign-in with a redirect back here
      router.push("/sign-in?redirect=/delete-account");
      return;
    }
    if (!res.ok) {
      setError("Something went wrong. Please try again or contact support.");
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold text-white">Account deleted</h1>
          <p className="text-slate-400">
            Your account and all associated data have been permanently deleted.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">Delete your account</h1>
          <p className="text-slate-400 text-sm">
            Permanently deletes your Peptide Planner account and all data associated with it.
            This action cannot be undone.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-slate-300">The following data will be deleted:</p>
          <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>All protocols and dose schedules</li>
            <li>Inventory (vials and capsules)</li>
            <li>Dose history and logs</li>
            <li>Weight logs</li>
            <li>Injection site preferences</li>
            <li>Consultation records</li>
            <li>Account credentials and subscription</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">
            Type <span className="font-mono text-red-400">delete me</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete me"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-red-500"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleDelete}
          disabled={!confirmed || loading}
          className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {loading ? "Deleting…" : "Delete my account"}
        </button>

        <p className="text-xs text-slate-500 text-center">
          You must be signed in to complete this request. If you&apos;re not signed in,
          you&apos;ll be redirected to the sign-in page first.
        </p>
      </div>
    </main>
  );
}
