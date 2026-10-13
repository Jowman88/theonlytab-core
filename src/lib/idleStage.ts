export const DEFAULT_STEAL_PRICE = '19.00';
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
