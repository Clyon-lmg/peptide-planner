'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';

/**
 * Use auth-helpers for Server Actions to avoid session issues.
 */
function sb() {
  return createServerActionClient({ cookies });
}

/* ========== Dropdown data ========== */

export async function getKnownPeptides() {
  const supabase = sb();
  const { data, error } = await supabase
    .from('v_known_peptides')
    .select('peptide_id, canonical_name')
    .order('canonical_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getKnownCapsules() {
  const supabase = sb();
  const { data, error } = await supabase
    .from('v_known_capsules')
    .select('peptide_id, canonical_name')
    .order('canonical_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* ========== Create inventory rows ========== */

export async function addInventoryVial(peptide_id: number) {
  const supabase = sb();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) throw uerr ?? new Error('Not authenticated');

  const { data, error } = await supabase
    .from('inventory_items')
    .upsert(
      { user_id: user.id, peptide_id, vials: 0, mg_per_vial: 0, bac_ml: 0 },
      { onConflict: 'user_id,peptide_id' }
    )
    .select('id')
    .single();
  if (error) throw error;

  revalidatePath('/inventory');
  return { id: data?.id };
}

export async function addInventoryCapsule(peptide_id: number) {
  const supabase = sb();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) throw uerr ?? new Error('Not authenticated');

  const { data, error } = await supabase
    .from('inventory_capsules')
    .upsert(
      { user_id: user.id, peptide_id, bottles: 0, caps_per_bottle: 0, mg_per_cap: 0 },
      { onConflict: 'user_id,peptide_id' }
    )
    .select('id')
    .single();
  if (error) throw error;

  revalidatePath('/inventory');
  return { id: data?.id };
}

export async function addInventoryCustom(name: string, kind: 'vial' | 'capsule') {
  const supabase = sb();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) throw uerr ?? new Error('Not authenticated');

  const normalized_key = name.replace(/[-\s]/g, '').toLowerCase();
  const { data: pep, error: perr } = await supabase
    .from('peptides')
    .upsert(
      { canonical_name: name, aliases: [], normalized_key },
      { onConflict: 'normalized_key' }
    )
    .select('id, canonical_name')
    .single();
  if (perr) throw perr;

  if (kind === 'vial') {
    const { error } = await supabase.from('inventory_items').upsert(
      { user_id: user.id, peptide_id: pep.id, vials: 0, mg_per_vial: 0, bac_ml: 0 },
      { onConflict: 'user_id,peptide_id' }
    );
    if (error) throw error;
  } else {
    const { error } = await supabase.from('inventory_capsules').upsert(
      { user_id: user.id, peptide_id: pep.id, bottles: 0, caps_per_bottle: 0, mg_per_cap: 0 },
      { onConflict: 'user_id,peptide_id' }
    );
    if (error) throw error;
  }

  revalidatePath('/inventory');
  return { peptide_id: pep.id, canonical_name: pep.canonical_name };
}

/* ========== Delete inventory cards ========== */

export async function deleteInventoryItem(peptide_id: number, kind: 'vial' | 'capsule') {
  const supabase = sb();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) throw uerr ?? new Error('Not authenticated');

  if (kind === 'vial') {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .match({ user_id: user.id, peptide_id });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('inventory_capsules')
      .delete()
      .match({ user_id: user.id, peptide_id });
    if (error) throw error;
  }

  revalidatePath('/inventory');
  return { ok: true };
}

/* ========== Update inventory fields inline ========== */

export async function updateVialFields(
  peptide_id: number,
  fields: { vials?: number; mg_per_vial?: number; bac_ml?: number }
) {
  const supabase = sb();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('inventory_items')
    .update(fields)
    .match({ user_id: user.id, peptide_id });
  if (error) throw error;

  revalidatePath('/inventory');
  return { ok: true };
}

export async function updateCapsuleFields(
  peptide_id: number,
  fields: { bottles?: number; caps_per_bottle?: number; mg_per_cap?: number }
) {
  const supabase = sb();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('inventory_capsules')
    .update(fields)
    .match({ user_id: user.id, peptide_id });
  if (error) throw error;

  revalidatePath('/inventory');
  return { ok: true };
}

/* ========== Pricing: top 3 offers (coupon-aware) ========== */

export async function getTopOffers(peptide_id: number, kind: 'vial' | 'capsule') {
  const supabase = sb();
  const { data, error } = await supabase
    .from('v_offer_effective')
    .select('*')
    .eq('peptide_id', peptide_id)
    .eq('kind', kind)
    .order('unit_effective_price', { ascending: true })
    .limit(3);
  if (error) throw error;
  return data ?? [];
}

/* ========== Cart & Orders tie-ins ========== */

export async function addToCart({
  peptide_id,
  vendor_id,
  offer_id, // v_offer_effective.id
  kind,
  quantity,
}: {
  peptide_id: number;
  vendor_id: number;
  offer_id: number;
  kind: 'vial' | 'capsule';
  quantity: number;
}) {
  const supabase = sb();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: offer, error: oerr } = await supabase
    .from('v_offer_effective')
    .select('coupon_id')
    .eq('id', offer_id)
    .single();
  if (oerr) throw oerr;

  const { error } = await supabase.from('cart_items').insert({
    user_id: user.id,
    vendor_id,
    peptide_id,
    quantity_vials: quantity, // using this as the unit column per your schema
    prefer_coupon_id: offer?.coupon_id ?? null,
    // If you have a 'kind' column on cart_items, also persist it:
    // kind,
  });
  if (error) throw error;

  // If you display cart status on /inventory, also revalidate it:
  revalidatePath('/inventory');
  return { ok: true };
}

export async function placeOrderForVendor(vendor_id: number) {
  const supabase = sb();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: cartItems, error: ciErr } = await supabase
    .from('cart_items')
    .select('id, peptide_id, quantity_vials, prefer_coupon_id')
    .eq('user_id', user.id)
    .eq('vendor_id', vendor_id);
  if (ciErr) throw ciErr;
  if (!cartItems?.length) return { ok: true, order_id: null };

  const { data: orderRow, error: oErr } = await supabase
    .from('orders')
    .insert({ user_id: user.id, vendor_id, status: 'DRAFT' })
    .select('id')
    .single();
  if (oErr) throw oErr;

  const orderId = orderRow.id as number;

  for (const it of cartItems) {
    const { data: best, error: bErr } = await supabase
      .from('v_offer_effective')
      .select('effective_price, coupon_id, id, mg_per_vial, bac_ml')
      .eq('vendor_id', vendor_id)
      .eq('peptide_id', it.peptide_id)
      .order('effective_price', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (bErr) throw bErr;

    const { data: aff, error: aErr } = await supabase
      .from('affiliate_links')
      .select('id')
      .eq('vendor_id', vendor_id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (aErr) throw aErr;

    const unitPrice = best?.effective_price ?? 0;
    const mgPerVial = best?.mg_per_vial ?? 0;
    const bacMl = best?.bac_ml ?? 0;
    const couponId = it.prefer_coupon_id ?? best?.coupon_id ?? null;
    const affiliateLinkId = aff?.id ?? null;

    const { error: oiErr } = await supabase.from('order_items').insert({
      order_id: orderId,
      peptide_id: it.peptide_id,
      quantity_vials: it.quantity_vials,
      mg_per_vial: mgPerVial,
      bac_ml: bacMl,
      unit_price: unitPrice,
      coupon_id: couponId,
      affiliate_link_id: affiliateLinkId,
    });
    if (oiErr) throw oiErr;
  }

  const { error: delErr } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', user.id)
    .eq('vendor_id', vendor_id);
  if (delErr) throw delErr;

  // Revalidate pages that reflect cart/order state
  revalidatePath('/inventory');
  return { ok: true, order_id: orderId };
}
