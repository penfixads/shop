'use server'

import bcrypt from 'bcryptjs'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { generateClientId, generateJobOrderId, generateItemId, getNextJOSequence } from '@/lib/ids'
import { computeLineTotal, isQuoteOnlyCategory } from '@/lib/pricing'
import { extractClientIdFromQr } from '@/lib/qr'
import { getPhilippineDateStr } from '@/lib/date'
import { findLikelyDuplicateClients, normalizeContact } from '@/lib/client-dedupe'
import type { DraftItem } from './CreateSpecsModal'

type ActionResult =
  | { success: true; clientId: string; clientName: string; returning: boolean }
  | { success: false; message: string; possibleDuplicate?: boolean }

export async function registerClient(data: {
  contactNumber: string
  password: string
  clientName: string
  email: string
  messenger: string
  viber: string
  whatsapp: string
  // Set once the client has been warned about a likely-duplicate name match
  // (different/no contact info) and chosen to proceed anyway — see the
  // fuzzy-match block below.
  confirmNew?: boolean
}): Promise<ActionResult> {
  const contactNumber = data.contactNumber.trim()
  const clientName = data.clientName.trim()
  const password = data.password
  if (!contactNumber) return { success: false, message: 'Mobile number is required.' }
  if (!clientName) return { success: false, message: 'Customer name is required.' }
  if (!password || password.length < 6) return { success: false, message: 'Password must be at least 6 characters.' }
  if (!data.messenger.trim() && !data.viber.trim()) return { success: false, message: 'Please provide at least a Messenger or Viber account.' }

  const admin = createSupabaseAdminClient()

  // Compare against every existing client (normalized contact/email first, then
  // fuzzy name) so a client re-registering with a slightly different phone format
  // ("0917-123-4567" vs "639171234567") — or one staff already entered manually
  // for a walk-in JO — doesn't end up with a second, disconnected record.
  const { data: allClients } = await admin
    .from('clients')
    .select('client_id, client_name, company_name, contact_number, email, password_hash')
  const matches = findLikelyDuplicateClients(clientName, null, allClients || [], {
    contactNumber,
    email: data.email.trim() || undefined,
  })

  const contactMatch = matches.find(m => m.reason === 'contact')
  if (contactMatch) {
    const existing = allClients!.find(c => c.client_id === contactMatch.client.client_id)!
    // Same phone/email already on file — treat as a returning client instead of
    // creating a duplicate. Backfill a password for pre-existing clients (e.g.
    // staff-created in penfixads-OS, or registered before login existed) the
    // first time they come through here — but never silently overwrite one
    // that's already set, and never log someone in without checking it, since
    // that would let anyone hijack an account just by knowing the phone number.
    if (!existing.password_hash) {
      const password_hash = await bcrypt.hash(password, 10)
      await admin.from('clients').update({ password_hash }).eq('client_id', existing.client_id)
      return { success: true, clientId: existing.client_id, clientName: existing.client_name || clientName, returning: true }
    }
    const passwordMatches = await bcrypt.compare(password, existing.password_hash)
    if (!passwordMatches) {
      return { success: false, message: 'This mobile number is already registered. Please use "Log In" instead, or contact us if you forgot your password.' }
    }
    return { success: true, clientId: existing.client_id, clientName: existing.client_name || clientName, returning: true }
  }

  // No contact/email match, but the name looks like an existing (likely
  // staff-entered) client under a different or missing phone number. Don't
  // expose any of that other client's details to a stranger typing a similar
  // name — just pause once for a plain yes/no; confirmNew lets them proceed
  // if they're sure this is genuinely a new registration.
  if (matches.length > 0 && !data.confirmNew) {
    return {
      success: false,
      possibleDuplicate: true,
      message: 'It looks like you may already have an account with us. If you’ve ordered here before (even in-store), please try "Log In" first or contact our staff to link your history. Otherwise, you can continue registering as new.',
    }
  }

  const clientId = generateClientId()
  const password_hash = await bcrypt.hash(password, 10)
  const { error } = await admin.from('clients').insert({
    client_id: clientId,
    client_type: 'Individual',
    client_name: clientName,
    contact_number: contactNumber,
    password_hash,
    email: data.email.trim() || null,
    messenger: data.messenger.trim() || null,
    viber: data.viber.trim() || null,
    whatsapp: data.whatsapp.trim() || null,
  })
  if (error) return { success: false, message: error.message }

  return { success: true, clientId, clientName, returning: false }
}

type LoginResult =
  | { success: true; clientId: string; clientName: string }
  | { success: false; message: string }

// Lets a returning client identify themselves on a device/browser that
// doesn't already have them in localStorage — the counterpart to
// registerClient's "remember this browser" shortcut for new sign-ups.
export async function loginClient(data: { contactNumber: string; password: string }): Promise<LoginResult> {
  const contactNumber = data.contactNumber.trim()
  if (!contactNumber || !data.password) return { success: false, message: 'Mobile number and password are required.' }

  const admin = createSupabaseAdminClient()
  // Normalized comparison (not a raw .eq()) so a client who registered as
  // "0917-123-4567" can still log in typing "09171234567" — same drift
  // registerClient now guards against on the way in.
  const normInput = normalizeContact(contactNumber)
  const { data: candidates } = await admin
    .from('clients')
    .select('client_id, client_name, password_hash, contact_number')
  const client = (candidates || []).find(c => normalizeContact(c.contact_number) === normInput) || null

  if (!client || !client.password_hash) {
    return { success: false, message: "We couldn't find an account with that mobile number. Please register first." }
  }
  const valid = await bcrypt.compare(data.password, client.password_hash)
  if (!valid) return { success: false, message: 'Incorrect password.' }

  return { success: true, clientId: client.client_id, clientName: client.client_name }
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

type UploadResult =
  | { success: true; path: string }
  | { success: false; message: string }

// Uploads the client's actual attached file (full resolution, whether it's their
// print-ready art or just a layout reference) to a temporary "pending/" location
// as soon as they attach it in Create Specs — before the job order (and its real
// item_id) exists yet. submitJobOrder moves it into its final dated folder once
// the order is actually placed. This has to be its own action taking a FormData:
// Server Actions can't accept a raw File nested inside a larger object/array
// argument, only FormData (or a File) as a top-level argument.
export async function uploadOriginalFile(formData: FormData): Promise<UploadResult> {
  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, message: 'No file provided.' }

  const admin = createSupabaseAdminClient()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `pending/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  const { error } = await admin.storage.from('jo-print-files').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
  })
  if (error) return { success: false, message: error.message }
  return { success: true, path }
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

  // Quote-only status is decided server-side from the subcategory's real category —
  // the browser's own quote_only flag is display-only and never trusted, otherwise a
  // tampered cart could submit any priced item at ₱0 by flagging it "for quotation".
  const subIds = Array.from(new Set(data.items.map(i => i.subcategory_id)))
  const { data: subRows } = await admin
    .from('subcategories')
    .select('subcategory_id, category_id')
    .in('subcategory_id', subIds)
  const quoteOnlySubs = new Set(
    (subRows || []).filter(r => isQuoteOnlyCategory(r.category_id)).map(r => r.subcategory_id)
  )

  // Never trust the browser's own line_total — recompute every item's price
  // server-side from its stored pricing model so a tampered cart can't submit a
  // real job order at the wrong price. Quote-only (signage) items land at ₱0 with
  // a [FOR QUOTATION] marker; staff price them in penfixads-OS before payment.
  const recomputedItems = data.items.map(item => {
    if (quoteOnlySubs.has(item.subcategory_id)) {
      return {
        ...item,
        computed_line_total: 0,
        notes: `[FOR QUOTATION]${item.needs_layout_help ? ' (needs layout/design help)' : ''}${item.notes ? ' ' + item.notes : ''}`,
      }
    }
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

    // Best-effort: relocate the client's actual uploaded file (full resolution,
    // already sitting in storage under a temporary "pending/" path — see
    // uploadOriginalFile below) into its final dated folder now that we know
    // the real item_id — separate from item_preview above, which is only a
    // small compressed thumbnail. Grouped by calendar day so staff can browse
    // "today's" prints. Never blocks or fails the JO save if this errors out
    // (same policy as the tracking email below).
    if (item.original_file_path) {
      try {
        const folder = getPhilippineDateStr(receivedAt)
        const originalName = item.original_file_path.split('/').pop()
        const finalPath = `${folder}/${itemId}-${originalName}`
        const { error: moveErr } = await admin.storage.from('jo-print-files').move(item.original_file_path, finalPath)
        if (!moveErr) {
          await admin.from('job_order_items').update({ original_file_path: finalPath }).eq('item_id', itemId)
        }
      } catch {
        // Ignore — printing file is a nice-to-have, not a checkout blocker.
      }
    }

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
