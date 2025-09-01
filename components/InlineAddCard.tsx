"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import Card from "./layout/Card";

type ActionState = { ok: boolean; message?: string };

export function InlineAddCard({
    title,
    name,
    action,
    placeholder,
    className,
}: {
    title: string;
    name: string;
    action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
    placeholder: string;
    className?: string;
}) {
    const [state, formAction] = useFormState(action, { ok: false } as ActionState);

    return (
        <Card className={className}>
            <form action={formAction} className="space-y-3">
                <div className="font-medium">{title}</div>
                <input
                    name={name}
                    placeholder={placeholder}
                    className="w-full rounded-lg border px-3 py-2 text-foreground"
                />
                <button className="rounded-xl border px-3 py-2">Add</button>
                {state.message && <div className="text-sm text-destructive">{state.message}</div>}
                {state.ok && <div className="text-sm text-success">Added.</div>}
            </form>
        </Card>
    );
}