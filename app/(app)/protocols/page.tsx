// app/(app)/protocols/page.tsx
"use client";
import React from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import Card from "@/components/layout/Card";
import ProtocolEditor from "./ProtocolEditor";

type Protocol = {
  id: number;
  user_id: string;
  is_active: boolean;
  name: string;
  start_date: string;
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
  const supabase = React.useMemo(() => getSupabaseBrowser(), []);
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
              <h1 className="pp-h1">Protocols</h1>
              <button
                  className="btn bg-success hover:bg-success/90 text-white disabled:opacity-60"
                  onClick={createProtocol}
                  disabled={creating}
              >
                  {creating ? "Creating…" : "New Protocol"}
              </button>
          </div>

          <div className="grid grid-cols-12 gap-4">
              <aside className="col-span-12 md:col-span-4 pp-card p-3">
                  <h2 className="font-semibold mb-2">Your Protocols</h2>
                  <ul className="space-y-1">
                      {protocols.map((p) => (
                          <li key={p.id}>
                              <RowButton
                                  className={
                                      "w-full text-left px-2 py-2 rounded hover:bg-card " +
                                      (selectedId === p.id ? "bg-card" : "")
                                  }
                                  onClick={() => setSelectedId(p.id)}
                              >
                                  <div className="flex items-center justify-between">
                                      <div>
                                          <div className="font-medium">{p.name}</div>
                                          {p.is_active && (
                                              <div className="text-xs text-success">Active</div>
                                          )}
                                      </div>
                                      <div className="flex gap-2">
                                          <button
                                              type="button"
                                              className="btn text-xs"
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  renameProtocol(p);
                                              }}
                                          >
                                              Rename
                                          </button>
                                          <button
                                              type="button"
                                              className="btn text-xs bg-destructive text-white hover:bg-destructive/90"
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
                          <div className="pp-card p-6 text-muted">
              Select or create a protocol to begin.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
