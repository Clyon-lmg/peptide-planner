"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import Card from "./layout/Card";

type ActionState = { ok: boolean; message?: string };

export function InlineAddCustomCard({
    action,
    className,
}: {
    action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
    className?: string;
}) {
    const [state, formAction] = useFormState(action, { ok: false } as ActionState);
    const [type, setType] = React.useState<"peptide" | "capsule">("peptide");

    return (
        <Card className={className}>
            <form action={formAction} className="space-y-3">
                <div className="font-medium">Add Custom</div>

                <input
                    name="custom_name"
                    placeholder="Custom item name"
                    className="w-full rounded-lg border px-3 py-2 !max-w-[22ch]"
                    maxLength={22}
                />

                <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="custom_type_radio"
                            checked={type === "peptide"}
                            onChange={() => setType("peptide")}
                        />
                        Peptide
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="custom_type_radio"
                            checked={type === "capsule"}
                            onChange={() => setType("capsule")}
                        />
                        Capsule
                    </label>
                </div>

                {/* hidden field server action reads */}
                <input type="hidden" name="custom_type" value={type} />

                <button className="rounded-xl border px-3 py-2">Add</button>

                {state.message && <div className="text-sm text-destructive">{state.message}</div>}
                {state.ok && <div className="text-sm text-success">Added.</div>}
            </form>
        </Card>
    );
}