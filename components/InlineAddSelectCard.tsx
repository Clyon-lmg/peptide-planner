"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import Card from "./layout/Card";

type ActionState = { ok: boolean; message?: string };

export function InlineAddSelectCard({
    title,
    fieldName,          // "peptide_name" | "capsule_name"
    options,            // known names
    action,             // server action
    placeholder,
    className,
}: {
    title: string;
    fieldName: string;
    options: string[];
    action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
    placeholder: string;
    className?: string;
}) {
    const [state, formAction] = useFormState(action, { ok: false } as ActionState);
    const [value, setValue] = React.useState<string>("");

    return (
        <Card className={className}>
            <form action={formAction} className="space-y-3">
                <div className="font-medium">{title}</div>

                <select
                    className="w-full rounded-lg border px-3 py-2"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                >
                    <option value="">{placeholder}</option>
                    {options.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>

                {/* Hidden field that server action expects */}
                <input type="hidden" name={fieldName} value={value} />

                <button className="rounded-xl border px-3 py-2" disabled={!value}>
                    Add
                </button>

                {state.message && <div className="text-sm text-red-600">{state.message}</div>}
                {state.ok && <div className="text-sm text-green-600">Added.</div>}
            </form>
        </Card>
    );
}