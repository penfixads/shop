import fs from 'fs'
import path from 'path'

const BANNERS_DIR = path.join(process.cwd(), 'public', 'product_catalog')

// Product photos get dropped into public/product_catalog with whatever folder layout is
// convenient at upload time (flat, grouped by category, extra nesting) — so instead of
// depending on that structure, this walks every file and matches purely by filename
// (subcategory_id.ext).
export function getBannerImageMap(): Record<string, string> {
  const map: Record<string, string> = {}

  function walk(dir: string, relParts: string[]) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...relParts, entry.name])
      } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
        const id = entry.name.replace(/\.[^.]+$/, '')
        if (!map[id]) {
          map[id] = '/product_catalog/' + [...relParts, entry.name].map(encodeURIComponent).join('/')
        }
      }
    }
  }

  walk(BANNERS_DIR, [])
  return map
}
