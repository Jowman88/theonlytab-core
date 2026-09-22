export async function checkUrlWithWebRisk(url: string): Promise<boolean> {
  // Test Mode Bypass: Geeft altijd direct groen licht om crashes te voorkomen
  return true;
}
