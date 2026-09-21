export function cleanUrlForScan(inputUrl: string): string {
  try {
    const parsed = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
    return parsed.href;
  } catch {
    throw new Error("Invalid structure formatting specified on targeted domain.");
  }
}

export async function checkUrlSafety(targetUrl: string): Promise<{ isSafe: boolean; threatType?: string }> {
  const apiKey = process.env.GOOGLE_WEB_RISK_API_KEY;
  if (!apiKey) return { isSafe: true };

  const cleanUrl = cleanUrlForScan(targetUrl);
  const queryParams = new URLSearchParams({ key: apiKey, uri: cleanUrl });
  ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'].forEach(type => queryParams.append('threatTypes', type));

  try {
    const response = await fetch(`https://googleapis.com{queryParams.toString()}`);
    if (!response.ok) return { isSafe: true };
    const data = await response.json();
    if (data.threat && data.threat.threatTypes && data.threat.threatTypes.length > 0) {
      return { isSafe: false, threatType: data.threat.threatTypes[0] };
    }
    return { isSafe: true };
  } catch {
    return { isSafe: true };
  }
}
