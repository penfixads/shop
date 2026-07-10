const MAX_LAYOUT_BYTES = 20 * 1024

// Resizes/re-encodes as JPEG, backing off dimensions then quality, until the data URL's
// underlying byte size is under the target (20KB) — ported verbatim from
// penfixads-OS/app/(app)/jos/today/JOItemForm.tsx so shop-submitted previews land in
// job_order_items.item_preview (a text column) the same way staff-uploaded ones do.
export async function compressImageToDataUrl(file: File, maxBytes = MAX_LAYOUT_BYTES): Promise<{ dataUrl: string; bytes: number }> {
  const objectUrl = URL.createObjectURL(file)
  let img: HTMLImageElement
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not read image file.'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  let maxDim = Math.min(1200, Math.max(img.width, img.height))
  let quality = 0.85
  let dataUrl = ''
  let bytes = Infinity

  for (let i = 0; i < 25 && bytes > maxBytes && maxDim >= 20; i++) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) break
    ctx.drawImage(img, 0, 0, w, h)
    dataUrl = canvas.toDataURL('image/jpeg', quality)
    bytes = Math.round((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75)

    if (bytes > maxBytes) {
      if (quality > 0.35) quality -= 0.1
      else maxDim = Math.round(maxDim * 0.85)
    }
  }
  return { dataUrl, bytes }
}
