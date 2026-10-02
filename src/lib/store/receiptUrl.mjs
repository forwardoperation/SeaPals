export function stripeReceiptUrl(session) {
  const candidate = [
    session?.receiptUrl,
    session?.receipt_url,
    session?.invoice?.hosted_invoice_url,
    session?.payment_intent?.latest_charge?.receipt_url,
  ].find((value) => typeof value === "string" && value.trim());
  if (!candidate || candidate.length > 4096) return null;

  try {
    const url = new URL(candidate.trim());
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password &&
      (host === "stripe.com" || host.endsWith(".stripe.com"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
