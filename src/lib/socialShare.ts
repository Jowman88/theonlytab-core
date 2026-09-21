interface ShareCardParams {
  xHandle: string;
  displayName: string;
  finalBid: number;
  durationMinutes: number;
}

export function generateXShareUrl(params: ShareCardParams): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://theonlytab.io";
  const shareText = `I held the crown on @TheOnlyTab for ${params.durationMinutes} mins before getting outbid at \$${params.finalBid.toFixed(2)}.\n\nWho has the stack to take it back? 👑👇\n\n${appUrl}`;
  return `https://x.com{encodeURIComponent(shareText)}`;
}
