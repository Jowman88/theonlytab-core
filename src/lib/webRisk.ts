export async function checkUrlWithWebRisk(url: string): Promise<boolean> {
  // Test Mode Bypass: Altijd direct doorsturen naar Stripe
  return true;
}
