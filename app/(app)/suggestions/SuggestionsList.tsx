"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/layout/Card";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { useSupabaseUser } from "@/lib/useSupabaseUser";

export default function SuggestionsList({ initial }: { initial: any[] }) {
  const [suggestions, setSuggestions] = useState(initial);
  const supabase = getSupabaseBrowser();
  const { userId, ready } = useSupabaseUser();

  useEffect(() => {
    if (!ready || !userId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("suggestions")
        .select("id,title,type,status")
        .eq("user_id", userId)
        .eq("status", "PENDING")
        .order("id", { ascending: false });
      setSuggestions(data || []);
    }, 5000);
    return () => clearInterval(interval);
  }, [supabase, userId, ready]);

  if ((suggestions || []).length === 0) return <Card>No pending suggestions</Card>;

  return (
    <div className="grid gap-4">
      {suggestions.map((s: any) => (
        <Card key={s.id}>
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold">{s.title}</div>
              <div className="pp-subtle">{s.type}</div>
            </div>
            <Link className="btn" href={`/suggestions/${s.id}`}>
              View <span className="ml-1 text-[10px] uppercase">Beta</span>
            </Link>
            </div>
        </Card>
      ))}
    </div>
  );
}