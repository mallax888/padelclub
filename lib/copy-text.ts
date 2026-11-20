// Copy text to the clipboard. Returns false when the browser does not allow it (an old browser, or a page
// that is not secure), so the caller can show the text instead.
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
