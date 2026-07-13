// Turns a subcategory's pricing_model + base_price into the short label
// shown on its catalog card, e.g. "From ₱12.00 / sq ft". Each pricing model
// implies a different unit — see lib/jo-helpers.ts's computeLineTotal in
// penfixads-OS for how these same models compute a final line total.
export function formatPriceLabel(pricingModel: string, basePrice: number, unit?: string | null): string {
  const price = `₱${basePrice.toFixed(2)}`
  switch (pricingModel) {
    case 'area':
    case 'dimension':
      return `From ${price} / ${unit || 'sq ft'}`
    case 'area_cube':
      return `From ${price} / ${unit || 'cu ft'}`
    case 'per_piece':
      return `From ${price} / pc`
    case 'per_set':
      return `From ${price} / set`
    case 'per_sheet':
      return `From ${price} / ${unit || 'sheet'}`
    case 'per_minute':
      return `From ${price} / min`
    case 'per_lettersqft':
      return `From ${price} / letter-sqft`
    case 'starts_with':
      return `Starts at ${price}`
    case 'fixed':
      return price
    default:
      return `From ${price}`
  }
}

// The `unit` column stores the pricing unit (e.g. "sqin", "sqft", "cuft"), not the
// linear measurement unit a client types into a Width/Height/Depth field — so a
// cabinet priced "per sqin" still needs its dimension inputs labeled "in", not "sqin".
export function linearUnitLabel(unit?: string | null): string {
  if (!unit) return 'ft'
  const stripped = unit.trim().replace(/^(sq|cu)\s*/i, '')
  return stripped || unit
}

export const PRICING_LABELS: Record<string, string> = {
  per_piece: 'Per Piece',
  area: 'Area (W × H × Price)',
  dimension: 'Dimension (W × H × Price)',
  per_set: 'Per Set',
  fixed: 'Fixed Price',
  area_cube: 'Area Cube (W × H × D × Price)',
  per_sheet: 'Per Sheet',
  per_minute: 'Per Minute',
  starts_with: 'Starts With',
  per_lettersqft: 'Per Letter Sq Ft',
}

// Ported verbatim from penfixads-OS/lib/jo-helpers.ts's computeLineTotal —
// same pricing models must compute the same way here so a shop-drafted
// quote matches what the real job_order_item ends up costing once staff
// process it.
export function computeLineTotal(
  pricingModel: string,
  basePrice: number,
  width?: number,
  height?: number,
  depth?: number,
  quantity: number = 1,
  noOfMins?: number,
  letterCount?: number,
  discount: number = 0
): number {
  let total = 0
  switch (pricingModel) {
    case 'per_piece':
    case 'fixed':
    case 'per_set':
    case 'per_sheet':
    case 'starts_with':
      total = basePrice * quantity
      break
    case 'area':
    case 'dimension':
      total = basePrice * (width || 0) * (height || 0) * quantity
      break
    case 'area_cube':
      total = basePrice * (width || 0) * (height || 0) * (depth || 0) * quantity
      break
    case 'per_minute':
      total = basePrice * (noOfMins || 0) * quantity
      break
    case 'per_lettersqft':
      total = basePrice * (letterCount || 0) * (width || 0) * (height || 0)
      break
    default:
      total = basePrice * quantity
  }
  return Math.max(0, total - discount)
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
