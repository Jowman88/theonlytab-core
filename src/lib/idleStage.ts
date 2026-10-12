export const DEFAULT_STEAL_PRICE = '19.00';
export const LINE_ROTATION_MS = 7000;

export const IDLE_LINES: readonly string[] = [
  'Nobody\'s here. Suspicious.',
  'Still empty. Someone could be famous for 90 minutes.',
  'The stage is ${price} and your ego is free.',
  'Next price: ${price}. Cheaper than most bad decisions.',
  'Somewhere, a website is waiting to be seen.',
  'Be the main character. ${price} only.',
  'Zero viewers pay attention to empty stages. Fix that.',
  'The spotlight is on. Nobody is standing in it.',
  'Your landing page deserves an audience.',
  'Is anyone going to take this stage, or are we just vibing?',
  'Ninety minutes of fame, no talent required.',
  'This tab is lonely. Put something on it.',
  'Imagine your link here. Now stop imagining.',
  'The stage is open. The bar is low.',
  'Whoever takes the stage next becomes the only tab.',
  'Hit SEIZE THE STAGE below. We will pretend we are not watching.',
  '${price} to own the screen. Rent in this city is worse.',
  'You could be on this screen right now.',
  'Free real estate, ${price} down.',
  'Plot twist: you take the stage.',
  'Our stage manager is on a coffee break. Forever.',
  'Nothing to see here. Yet.',
  'The only tab is currently the only empty tab.',
  'Fame is just a checkout away.',
  'Ninety seconds of protection once you are live. Use them wisely.',
  'Somebody unlocks the potential. Why not you?',
  'The crowd is there. The stage is real.',
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
