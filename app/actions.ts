'use server'

import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { generateClientId, generateJobOrderId, generateItemId, getNextJOSequence } from '@/lib/ids'
import { computeLineTotal } from '@/lib/pricing'
import { extractClientIdFromQr } from '@/lib/qr'
import type { DraftItem } from './CreateSpecsModal'

type ActionResult =
  | { success: true; clientId: string; clientName: string; returning: boolean }
  | { success: false; message: string }

export async function registerClient(data: {
  contactNumber: string
  clientName: string
  email: string
  messenger: string
  viber: string
  whatsapp: string
}): Promise<ActionResult> {
  const contactNumber = data.contactNumber.trim()
  const clientName = data.clientName.trim()
  if (!contactNumber) return { success: false, message: 'Mobile number is required.' }
  if (!clientName) return { success: false, message: 'Customer name is required.' }

  const admin = createSupabaseAdminClient()

  // Same phone number registering again — treat as a returning visitor
  // instead of creating a duplicate client record.
  const { data: existing } = await admin
    .from('clients')
    .select('client_id, client_name')
    .eq('contact_number', contactNumber)
    .maybeSingle()
  if (existing) {
    return { success: true, clientId: existing.client_id, clientName: existing.client_name, returning: true }
  }

  const clientId = generateClientId()
  const { error } = await admin.from('clients').insert({
    client_id: clientId,
    client_type: 'Individual',
    client_name: clientName,
    contact_number: contactNumber,
    email: data.email.trim() || null,
    messenger: data.messenger.trim() || null,
    viber: data.viber.trim() || null,
    whatsapp: data.whatsapp.trim() || null,
  })
  if (error) return { success: false, message: error.message }

  return { success: true, clientId, clientName, returning: false }
}

type RewardsResult =
  | { success: true; points: number }
  | { success: false; message: string }

// Rewards balance is read fresh each time the modal opens rather than
// cached in localStorage alongside clientId/clientName — points change
// server-side (redemptions, future purchases) and should never go stale.
//
// Reads rewards_ledger (1% of each fully-paid JO's grand_total, credited by
// lib/jo-completion.ts in penfixads-OS) rather than clients.earned_rewards/
// claimed_rewards — those columns are set to 0 on client creation and never
// updated again anywhere in the codebase. rewards_ledger is the table
// penfixads-OS's own Clients page already sums for its "Rewards: ₱X" display.
export async function getClientRewards(clientId: string): Promise<RewardsResult> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('rewards_ledger')
    .select('type, amount')
    .eq('client_id', clientId)
  if (error) return { success: false, message: error.message }
  const points = (data ?? []).reduce((sum, row) => sum + (row.type === 'earned' ? row.amount : -row.amount), 0)
  return { success: true, points: Math.max(0, points) }
}

type QrLookupResult =
  | { success: true; clientId: string; clientName: string }
  | { success: false; message: string }

// Checkout requires scanning the client's QR every time, not just being registered
// in this browser — same policy as penfixads-OS's New JO flow. Resolves whatever
// the uploaded QR image decoded to into a real, currently-existing client.
export async function lookupClientForCheckout(qrValue: string): Promise<QrLookupResult> {
  const clientId = extractClientIdFromQr(qrValue)
  if (!clientId) return { success: false, message: "Couldn't read a QR code in that image." }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('clients')
    .select('client_id, client_name, company_name')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) return { success: false, message: error.message }
  if (!data) return { success: false, message: "This QR doesn't match a registered client. Please register first." }

  return { success: true, clientId: data.client_id, clientName: data.client_name || data.company_name || data.client_id }
}

type CheckoutResult =
  | { success: true; jobOrderId: string }
  | { success: false; message: string }

// Writes directly into the same job_orders/job_order_items tables penfixads-OS
// uses — same ID format (lib/ids.ts), same retry-on-duplicate-key pattern, so a
// shop-submitted order looks identical to one staff created internally. Lands as
// "Pending Payment" since no payment is collected here.
export async function submitJobOrder(data: {
  clientId: string
  items: DraftItem[]
}): Promise<CheckoutResult> {
  if (!data.items.length) return { success: false, message: 'Your cart is empty.' }

  const admin = createSupabaseAdminClient()

  const { data: client } = await admin.from('clients').select('client_id').eq('client_id', data.clientId).maybeSingle()
  if (!client) return { success: false, message: 'Client not found — please scan your QR again.' }

  // Never trust the browser's own line_total — recompute every item's price
  // server-side from its stored pricing model so a tampered cart can't submit a
  // real job order at the wrong price.
  const recomputedItems = data.items.map(item => {
    const base = computeLineTotal(
      item.pricing_model,
      item.base_price,
      item.width ?? undefined,
      item.height ?? undefined,
      item.depth ?? undefined,
      item.quantity,
      item.no_of_mins ?? undefined,
      item.letter_count ?? undefined,
    )
    return { ...item, computed_line_total: base + (item.needs_layout_help ? item.layout_fee : 0) }
  })
  const grandTotal = recomputedItems.reduce((sum, i) => sum + i.computed_line_total, 0)

  const receivedAt = new Date()
  const mm = String(receivedAt.getMonth() + 1).padStart(2, '0')
  const dd = String(receivedAt.getDate()).padStart(2, '0')
  const yyyy = receivedAt.getFullYear()
  const dateStr = `${mm}${dd}${yyyy}`

  let joId = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await admin.from('job_orders').select('job_order_id').like('job_order_id', `JO-${dateStr}-%`)
    const seq = getNextJOSequence((existing || []).map(j => j.job_order_id), dateStr)
    joId = generateJobOrderId(seq, receivedAt)
    const { error: joErr } = await admin.from('job_orders').insert({
      job_order_id: joId,
      user_email: 'shop@penfixads.com',
      client_id: data.clientId,
      date_time_received: receivedAt.toISOString(),
      payment_status: 'Pending Payment',
      grand_total: grandTotal,
      total_amount_paid: 0,
      discount: 0,
      cashback_discount: 0,
      received_by: 'Online Shop',
      is_for_billing: false,
      is_fully_paid: false,
    })
    if (!joErr) break
    if (joErr.code !== '23505' || attempt === 4) return { success: false, message: joErr.message }
  }

  for (let i = 0; i < recomputedItems.length; i++) {
    const item = recomputedItems[i]
    const itemId = generateItemId(joId, i + 1)
    const { error: itemErr } = await admin.from('job_order_items').insert({
      item_id: itemId,
      job_order_id: joId,
      subcategory_id: item.subcategory_id,
      pricing_model: item.pricing_model,
      base_price: item.base_price,
      width: item.width,
      height: item.height,
      depth: item.depth,
      quantity: item.quantity,
      no_of_mins: item.no_of_mins,
      letter_count: item.letter_count,
      production_specs: item.production_specs,
      notes: item.notes,
      date_time_needed: item.date_time_needed,
      computed_line_total: item.computed_line_total,
      item_preview: item.item_preview,
      job_status: 'Received',
    })
    if (itemErr) return { success: false, message: itemErr.message }

    await admin.from('job_order_item_status_log').insert({
      item_id: itemId,
      job_order_id: joId,
      status_name: 'Received',
      changed_by_email: 'shop@penfixads.com',
      changed_by_name: 'Online Shop',
      changed_by_role: 'Shop',
    })
  }

  return { success: true, jobOrderId: joId }
}
