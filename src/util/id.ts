export function buildSafeId(str: string): string {
  return str
    .normalize("NFKD") // split accented characters
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-+|-+$/g, "") // trim hyphens
    .replace(/^[^a-z]+/, ""); // remove leading non-letters // fallback if empty
}
