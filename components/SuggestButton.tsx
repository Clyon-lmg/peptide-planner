"use client";
import { useState } from "react";

export default function SuggestButton({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Suggest <span className="ml-1 text-[10px] uppercase">Beta</span>
      </button>
    );
}
  return (
    <form action={async (fd) => { await action(fd); setOpen(false); }} className="flex gap-2 items-center">
      <input className="input" name="title" placeholder="Title" />
      <input className="input" name="note" placeholder="Note" />
      <button className="btn" type="submit">Send</button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}