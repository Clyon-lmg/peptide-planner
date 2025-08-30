import { createServerComponentSupabase } from "@/lib/supabaseServer";
import Card from "@/components/layout/Card";
export const dynamic = "force-dynamic"
export default async function SuggestionsPage() {
    const supabase = createServerComponentSupabase();
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <Card>Please sign in.</Card>
    const { data: suggestions, error } = await supabase.from("suggestions").select("id, title, note, status, created_at").eq("user_id", user.id).order("id", { ascending: false })
    if (error) return <Card>Error: {error.message}</Card>
    return <div className="grid gap-6">
        <Card>
            <div className="pp-h2">New Suggestion</div>
            <form action={async (fd) => {
                "use server"; const a = await import("./server");
                await a.createSuggestion(String(fd.get('title') || ''), String(fd.get('note') || ''))
            }} className="grid md:grid-cols-3 gap-2 mt-3">
                <input className="input" name="title" placeholder="Title" />
                <input className="input" name="note" placeholder="Note" />
                <button className="btn">Add</button>
            </form>
        </Card>
        <div className="grid-cards">
            {(suggestions ?? []).map((s: any) => <Card key={s.id}>
                <div className="text-lg font-semibold">{s.title}</div>
                <div className="pp-subtle mt-1">{s.note}</div>
                <div className="pp-subtle">Status: {s.status}</div>
                <div className="flex gap-2 mt-3">
                    <form action={async () => { "use server"; const a = await import("./server"); await a.updateSuggestionStatus(s.id, "OPEN") }}><button className="btn">Open</button></form>
                    <form action={async () => { "use server"; const a = await import("./server"); await a.updateSuggestionStatus(s.id, "IN_REVIEW") }}><button className="btn">Review</button></form>
                    <form action={async () => { "use server"; const a = await import("./server"); await a.updateSuggestionStatus(s.id, "DONE") }}><button className="btn">Done</button></form>
                    <form action={async () => { "use server"; const a = await import("./server"); await a.deleteSuggestion(s.id) }}><button className="btn">Delete</button></form>
                </div>
            </Card>)}
        </div>
    </div>
}