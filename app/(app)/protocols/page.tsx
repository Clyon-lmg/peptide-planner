// app/(app)/protocols/page.tsx
"use client";
import React from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import ProtocolEditor from "./ProtocolEditor";

type Protocol = {
  id: number;
  user_id: string;
  is_active: boolean;
  name: string;
};

/** Button-like row wrapper that isn't a <button> (avoids nested button hydration issues) */
function RowButton({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={className}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          // Synthesize a click for keyboard activation
          onClick(e as unknown as React.MouseEvent<HTMLDivElement, MouseEvent>);
        }
      }}
    >
      {children}
    </div>
  );
}

export default function ProtocolsPage() {
  const supabase = React.useMemo(() => createClientComponentClient(), []);
  const [protocols, setProtocols] = React.useState<Protocol[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [creating, setCreating] = React.useState(false);

  const reload = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("protocols")
      .select("*")
      .order("id", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setProtocols(data || []);
    if (!selectedId && (data || []).length > 0) {
      setSelectedId(data[0].id);
    }
  }, [supabase, selectedId]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      await reload();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, _session) => {
      if (!active) return;
      reload();
    });
    return () => {
      active = false;
      sub?.subscription.unsubscribe();
    };
  }, [reload, supabase]);

  const createProtocol = async () => {
    setCreating(true);
    try {
      const name = prompt("Name your protocol");
      if (!name) return;
      // Insert without user_id; DB trigger fills it using auth.uid()
      const { error } = await supabase
        .from("protocols")
        .insert([{ name, is_active: false }]);
      if (error) throw error;
      await reload();
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to create protocol.");
    } finally {
      setCreating(false);
    }
  };

  const renameProtocol = async (p: Protocol) => {
    const name = prompt("Rename protocol", p.name);
    if (!name) return;
    const { error } = await supabase
      .from("protocols")
      .update({ name })
      .eq("id", p.id);
    if (error) {
      console.error(error);
      alert("Rename failed.");
      return;
    }
    await reload();
  };

  const deleteProtocol = async (p: Protocol) => {
    if (
      !confirm(
        `Delete protocol "${p.name}"? This will remove its items and future doses.`
      )
    )
      return;
    const { error } = await supabase.from("protocols").delete().eq("id", p.id);
    if (error) {
      console.error(error);
      alert("Delete failed.");
      return;
    }
    await reload();
    setSelectedId(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Protocols</h1>
        <button
          className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          onClick={createProtocol}
          disabled={creating}
        >
          {creating ? "Creating…" : "New Protocol"}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-4 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <h2 className="font-semibold mb-2">Your Protocols</h2>
          <ul className="space-y-1">
            {protocols.map((p) => (
              <li key={p.id}>
                <RowButton
                  className={
                    "w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 " +
                    (selectedId === p.id ? "bg-gray-100 dark:bg-gray-800" : "")
                }
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      {p.is_active && (
                        <div className="text-xs text-emerald-600">Active</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          renameProtocol(p);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProtocol(p);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </RowButton>
              </li>
            ))}
          </ul>
        </aside>

        <main className="col-span-12 md:col-span-8">
          {selectedId ? (
            <ProtocolEditor
              protocol={protocols.find((p) => p.id === selectedId)!}
              onReload={reload}
            />
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
              Select or create a protocol to begin.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
