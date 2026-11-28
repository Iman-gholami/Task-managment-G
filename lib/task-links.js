/** Only ordinary web links are accepted in work evidence; never render script/file URLs. */
export function normalizeTaskLinks(value) {
  if (!Array.isArray(value) || value.length > 10) return null;
  const links = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const raw = item.trim();
    if (!raw || raw.length > 2048) return null;
    try {
      const url = new URL(raw);
      if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
      if (!links.includes(url.href)) links.push(url.href);
    } catch { return null; }
  }
  return links;
}
