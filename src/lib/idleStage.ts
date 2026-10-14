import { DEFAULT_BASE_PRICE } from './pricing';

export const DEFAULT_STEAL_PRICE = DEFAULT_BASE_PRICE.toFixed(2);
export const LINE_ROTATION_MS = 7000;

export const IDLE_LINES: readonly string[] = [

  'The stage is ${price} , your product deserves it.',
  'Next price: ${price}. Cheaper than most bad decisions.',
  'Put your clickable hyperlink on the main stage.',
  'Drop an interactive link. Steal the traffic loop.',
  'Your destination link. Total focus. Right now.',
  'Broadcast your URL. Capture the immediate traffic flow.',
  'Turn this live window into your clickable billboard.',
  'One click away from your project. Claim the slot.',
  'Redirect this entire traffic highway to your website.',
  'Your landing page, pinned live on the main stage.',
  'Deploy an active, interactive link to the masses.',
  'Direct massive clickable traffic to your project.',
  'Your landing page deserves an audience.',
  'Imagine your link here. Now stop imagining.',
  '${price} to own the screen.',
  'The ultimate internet funnel. Own it for ${price}.',
  'Unfused focus. Your brand on the global monitor.',
  'Don’t let your link get buried in chat. Own the screen.',
  'Maximum impression density, starting right now.',
  'The whole venue is staring at this slot. Capitalize.',
  'Every single eye is looking here. Capitalize.',
  'You could be on this screen right now.',
  'Free real estate, ${price} down.',
  'Plot twist: you take the stage.',
  'Fame is just a checkout away.',
  'The crowd is there. The stage is yours.',
];

export function getIdleLine(index: number, price: string = DEFAULT_STEAL_PRICE): string {
  const total = IDLE_LINES.length;
  const line = IDLE_LINES[((index % total) + total) % total];
  return line.replace(/\$\{price\}/g, `$${price}`);
}

export const HEADLINE_ROTATION_MS = 6000;

export const HEADLINES: readonly string[] = [
  'Put your site on the big screen',
  'Your link. Everyone\'s screen.',
  'The stage is open. Take it.',
  'Own the screen for ${price}',
  'Turn this window into your billboard',
  'One click from your project. Claim the slot.',
  'Every eye is on this stage. Use it.',
  'Your landing page deserves an audience',
  'Be the next name on the ledger',
  'Take the stage before someone else does',
  'Free real estate, ${price} down',
  'Your brand, live, right now',
];

export function getHeadline(index: number, price: string = DEFAULT_STEAL_PRICE): string {
  const total = HEADLINES.length;
  const line = HEADLINES[((index % total) + total) % total];
  return line.replace(/\$\{price\}/g, `$${price}`);
}

export function stripProtocol(url: string): string {
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/$/, '');
}

export function formatTimeAgo(value: string | number | Date | null | undefined, now: number = Date.now()): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const MAX_PRESENCE_DOTS = 12;

export function getPresenceDots(viewerCount: number | null | undefined, max: number = MAX_PRESENCE_DOTS): number {
  if (typeof viewerCount !== 'number' || !Number.isFinite(viewerCount) || viewerCount <= 0) return 0;
  return Math.min(max, Math.floor(viewerCount));
}

export interface ProofHistoryItem {
  currentBid?: string;
  currentUrl?: string;
  displayName?: string;
  createdAt?: string;
}

export interface ProofHallOfFame {
  longestReign?: { displayName: string; durationMinutes: number } | null;
  highestTakeover?: { displayName: string; bidCents: number } | null;
  mostTakeovers?: { displayName: string; count: number } | null;
}

export interface ProofItem {
  key: string;
  kind: 'takeover' | 'record';
  label: string;
  headline: string;
  detail: string;
}

export function buildProofItems(
  history: readonly ProofHistoryItem[],
  hallOfFame: ProofHallOfFame | null | undefined,
  now: number = Date.now(),
  maxTakeovers = 6,
): ProofItem[] {
  const takeovers: ProofItem[] = history.slice(0, maxTakeovers).map((item, i) => {
    const ago = formatTimeAgo(item.createdAt, now);
    const url = stripProtocol(item.currentUrl || '');
    const name = item.displayName || 'Anonymous';
    return {
      key: `t-${i}-${name}-${url}`,
      kind: 'takeover',
      label: 'Recent takeover',
      headline: url ? `${name} · ${url}` : name,
      detail: `$${item.currentBid ?? ''}${ago ? ` · ${ago}` : ''}`,
    };
  });

  const records: ProofItem[] = [];
  const reign = hallOfFame?.longestReign;
  if (reign) {
    records.push({ key: 'r-reign', kind: 'record', label: 'Longest reign', headline: reign.displayName, detail: formatDuration(reign.durationMinutes) });
  }
  const top = hallOfFame?.highestTakeover;
  if (top) {
    records.push({ key: 'r-top', kind: 'record', label: 'Highest takeover', headline: top.displayName, detail: `$${(top.bidCents / 100).toFixed(2)}` });
  }
  const most = hallOfFame?.mostTakeovers;
  if (most) {
    records.push({ key: 'r-most', kind: 'record', label: 'Most takeovers', headline: most.displayName, detail: `${most.count} takeovers` });
  }

  const result: ProofItem[] = [];
  const total = takeovers.length + records.length;
  let t = 0;
  let r = 0;
  while (result.length < total) {
    if (t < takeovers.length) result.push(takeovers[t++]);
    if (r < records.length) result.push(records[r++]);
  }
  return result;
}
