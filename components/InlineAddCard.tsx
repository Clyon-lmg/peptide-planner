"use client";

import * as React from "react";
import { useFormState } from "react-dom";

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
    <form action={formAction} className={`rounded-2xl border p-4 space-y-3 ${className ?? ""}`}>
      <div className="font-medium">{title}</div>
      <input
        name={name}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2"
      />
      <button className="rounded-xl border px-3 py-2">Add</button>
      {state.message && <div className="text-sm text-red-600">{state.message}</div>}
      {state.ok && <div className="text-sm text-green-600">Added.</div>}
    </form>
  );
}
