export async function checkUrlWithwebRisk(url: string): Promise<boolean> {
  const apiKey = process.env.GOOGLE_WEB_RISK_API_KEY;
  if (!apiKey) {
    console.warn("Google Web Risk API key is missing. Skipping safety check.");
    return true;
  }
  try {
    const endpoint = `https://googleapis.com{apiKey}&threatTypes=MALWARE&threatTypes=SOCIAL_ENGINEERING&threatTypes=UNWANTED_SOFTWARE&uri=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint);
    const data = await response.json();
    return !(data.threat && data.threat.threatTypes && data.threat.threatTypes.length > 0);
  } catch (error) {
    console.error("Web Risk API error:", error);
    return true;
  }
}
