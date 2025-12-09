"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Card from "@/components/layout/Card";
import { addCustomAction } from "../actions";

export default function AddRow() {
    const router = useRouter();
    const [isPending, startTransition] = React.useTransition();
    const [name, setName] = React.useState("");
    const [kind, setKind] = React.useState<"peptide" | "capsule">("peptide");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        startTransition(async () => {
            const fd = new FormData();
            fd.set("name", name);
            fd.set("kind", kind);
            await addCustomAction(fd);
            setName("");
            router.refresh();
        });
    };

    return (
        <Card className="max-w-xl">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="flex-1 w-full sm:w-auto">
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        Item Name
                    </label>
                    <input
                        name="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. BPC-157"
                        className="input h-10"
                        disabled={isPending}
                        required
                    />
                </div>

                <div className="flex bg-muted/20 p-1 rounded-xl shrink-0">
                    <button
                        type="button"
                        onClick={() => setKind("peptide")}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${kind === "peptide" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Vial
                    </button>
                    <button
                        type="button"
                        onClick={() => setKind("capsule")}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${kind === "capsule" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Capsule
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={isPending || !name.trim()}
                    className="btn bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full sm:w-auto min-w-[80px]"
                >
                    {isPending ? "..." : <><Plus className="w-4 h-4 mr-1" /> Add</>}
                </button>
            </form>
        </Card>
    );
}