/** Opens the Payme checkout page reliably, including from inside the preview iframe. */
export function openPaymeCheckout(url: string) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) return;

  // Popup blocked: try to escape the iframe, then fall back to same-frame navigation.
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // Cross-origin parent: fall through.
  }
  window.location.href = url;
}
