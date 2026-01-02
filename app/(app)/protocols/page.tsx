import React from 'react';
import { createServerActionSupabase } from "@/lib/supabaseServer";
import ProtocolsView from './ProtocolsView';

// Force dynamic so we always get the latest list
export const dynamic = "force-dynamic";

export default async function Page() {
    const supabase = createServerActionSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return <div>Please log in</div>;
    }

    // Fetch protocols securely on the server
    const { data: protocols } = await supabase
        .from('protocols')
        .select('*')
        .eq('user_id', user.id)
        .order('is_active', { ascending: false }) // Active first
        .order('created_at', { ascending: false });

    return (
        <ProtocolsView initialProtocols={protocols || []} />
    );
}
