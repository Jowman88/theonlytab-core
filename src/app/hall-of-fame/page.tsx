import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Crown, Repeat, Timer, Trophy, TrendingUp, type LucideIcon } from 'lucide-react';
import { getHallOfFame, type HallOfFameData } from '../../lib/hallOfFame';

export const metadata: Metadata = {
  title: 'Hall of Fame | The Only Tab',
  description: 'Top records on The Only Tab: longest reign, highest takeover, and most takeovers.',
};

export const dynamic = 'force-dynamic';

const sectionClassName =
  'rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] ring-1 ring-white/5 sm:p-7';

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}

function StatCard({
  icon: Icon,
  title,
  record,
  emptyText,
}: {
  icon: LucideIcon;
  title: string;
  record: { name: string; metric: string; caption: string } | null;
  emptyText: string;
}) {
  return (
    <section className={sectionClassName}>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/85">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        {record && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
            <Crown className="h-3.5 w-3.5" />
            #1
          </span>
        )}
      </div>
      {record ? (
        <>
          <p className="mt-5 break-words text-2xl font-black tracking-tight text-white sm:text-3xl">{record.name}</p>
          <p className="mt-2 text-xl font-bold text-emerald-300">{record.metric}</p>
          <p className="mt-3 text-sm text-neutral-400">{record.caption}</p>
        </>
      ) : (
        <p className="mt-5 text-sm text-neutral-400">{emptyText}</p>
      )}
    </section>
  );
}

export default async function HallOfFamePage() {
  let data: HallOfFameData | null = null;
  try {
    data = await getHallOfFame();
  } catch {
    data = null;
  }

  const { longestReign, highestTakeover, mostTakeovers } = data ?? {
    longestReign: null,
    highestTakeover: null,
    mostTakeovers: null,
  };

  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.12),_transparent_28%),linear-gradient(180deg,_#090b10,_#05070b)] text-neutral-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-emerald-300/40 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b10]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <header className={`${sectionClassName} sm:px-8`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/85">
            <Trophy className="h-3.5 w-3.5" />
            Hall of Fame
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">Top records</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-300 sm:text-base">
            The longest reign, the highest takeover, and the most takeovers on The Only Tab.
          </p>
        </header>

        <StatCard
          icon={Timer}
          title="Longest reign"
          emptyText="No reigns yet"
          record={
            longestReign && {
              name: longestReign.displayName,
              metric: formatDuration(longestReign.durationMinutes),
              caption: `Reign ended ${formatDate(longestReign.endedAt)}`,
            }
          }
        />
        <StatCard
          icon={TrendingUp}
          title="Highest takeover"
          emptyText="No takeovers yet"
          record={
            highestTakeover && {
              name: highestTakeover.displayName,
              metric: `€${(highestTakeover.bidCents / 100).toFixed(2)}`,
              caption: `Set ${formatDate(highestTakeover.createdAt)}`,
            }
          }
        />
        <StatCard
          icon={Repeat}
          title="Most takeovers"
          emptyText="No takeovers yet"
          record={
            mostTakeovers && {
              name: mostTakeovers.displayName,
              metric: `${mostTakeovers.count} takeover${mostTakeovers.count === 1 ? '' : 's'}`,
              caption: `Latest ${formatDate(mostTakeovers.lastTakeoverAt)}`,
            }
          }
        />

        <p className="text-center text-xs leading-5 text-neutral-500">
          Display names are submitted by users. To request removal of your name, email{' '}
          <a className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="mailto:support@theonlytab.io">
            support@theonlytab.io
          </a>
          .
        </p>
      </div>
    </main>
  );
}
