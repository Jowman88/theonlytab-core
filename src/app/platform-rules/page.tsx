import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Platform Rules — The Only Tab',
  description: 'Plain-language platform rules for takeovers, content, privacy, and acceptable use on The Only Tab.',
};

const sectionClassName =
  'rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] ring-1 ring-white/5 sm:p-7';

export default function PlatformRulesPage() {
  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.12),_transparent_28%),linear-gradient(180deg,_#090b10,_#05070b)] text-neutral-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-emerald-300/40 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b10]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <header className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,_rgba(18,22,29,0.96),_rgba(9,11,16,0.92))] px-6 py-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300/85">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Platform rules
            </span>
            <span className="text-white/40">THE ONLY TAB</span>
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">Plain-language rules for using the platform</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300 sm:text-base">
            These rules explain how takeovers, submitted content, and platform access are expected to work. This is product policy copy, not legal advice.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            <p className="font-semibold text-amber-200">Important:</p>
            <p>
              Before relying on this page, obtain legal advice for your jurisdiction. Requirements can vary based on where you operate, what you publish, and the laws that apply to you.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-300">
            <p>
              <span className="font-semibold text-white">Effective date:</span> September 28, 2026
            </p>
            <p>
              <span className="font-semibold text-white">Support:</span> Contact the service operator through the support channel provided with your account or deployment.
            </p>
          </div>
        </header>

        <section className={sectionClassName} aria-labelledby="takeover-rules-heading">
          <h2 id="takeover-rules-heading" className="text-2xl font-black tracking-tight text-white">
            Takeover rules
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <li>
              <span className="font-semibold text-white">Non-refundable checkout:</span> once you start checkout for a takeover, treat the fee as final and non-refundable unless the service operator expressly says otherwise.
            </li>
            <li>
              <span className="font-semibold text-white">Stage duration and availability:</span> a takeover grants time on the stage only while capacity, system health, and platform availability allow. The platform may delay, shorten, pause, or end a session if needed to keep the service running safely.
            </li>
            <li>
              <span className="font-semibold text-white">Pricing and competition:</span> takeover pricing can change over time, and your checkout does not stop others from competing for later stage access once your session ends or platform rules allow a new takeover.
            </li>
            <li>
              <span className="font-semibold text-white">No prohibited interference:</span> do not disrupt another user&apos;s active session, attempt to manipulate timers or bids, or interfere with checkout, stream delivery, or platform operations.
            </li>
            <li>
              <span className="font-semibold text-white">Platform discretion:</span> the service operator may pause, reject, or refuse a takeover request when there are safety, abuse, policy, operational, payment, or legal concerns.
            </li>
          </ul>
        </section>

        <section className={sectionClassName} aria-labelledby="content-rules-heading">
          <h2 id="content-rules-heading" className="text-2xl font-black tracking-tight text-white">
            Content rules
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <li>
              <span className="font-semibold text-white">Lawful content only:</span> submit and display only content you are legally allowed to use, publish, and direct traffic toward.
            </li>
            <li>
              <span className="font-semibold text-white">No abuse or harm:</span> do not use the platform for harassment, hate, threats, intimidation, or sexual exploitation.
            </li>
            <li>
              <span className="font-semibold text-white">No illegal offers:</span> do not promote illegal goods, illegal services, or activity that would make access to the destination unlawful.
            </li>
            <li>
              <span className="font-semibold text-white">No malware or deception:</span> do not submit destinations, overlays, or related material that deliver malware, phishing, deceptive impersonation, or other fraudulent experiences.
            </li>
            <li>
              <span className="font-semibold text-white">Respect intellectual property:</span> do not use content that infringes another party&apos;s copyright, trademark, or similar rights.
            </li>
          </ul>
        </section>

        <section className={sectionClassName} aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="text-2xl font-black tracking-tight text-white">
            Privacy
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <p>
              To provide the service, the platform may process configuration data you submit, such as your target URL, display name, overlay label, start path, payment or session metadata, and operational logs connected to the takeover flow.
            </p>
            <p>
              That processing may be used to operate the service, prevent abuse, maintain security, troubleshoot issues, and comply with law.
            </p>
            <p>
              Do not submit secrets, credentials, payment card data outside the intended checkout flow, or unnecessary personal information in fields meant for takeover configuration.
            </p>
          </div>
        </section>

        <section className={sectionClassName} aria-labelledby="acceptable-use-heading">
          <h2 id="acceptable-use-heading" className="text-2xl font-black tracking-tight text-white">
            Acceptable use
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <li>No abuse of checkout flows, APIs, or automation intended to create unfair access or service disruption.</li>
            <li>No rate-limit evasion, traffic flooding, or scraping that materially degrades the service for others.</li>
            <li>No SSRF attempts, malicious payloads, exploit delivery, or probing for internal systems.</li>
            <li>No unauthorized access, credential attacks, or attempts to bypass authentication or other security controls.</li>
            <li>No attempts to disable, circumvent, or reverse-engineer protections used to keep the platform stable and safe.</li>
          </ul>
        </section>

        <footer className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-5 text-sm leading-6 text-neutral-300 ring-1 ring-white/5">
          <p>
            Questions about these rules or whether a planned use is appropriate? Contact the service operator through the support channel provided with your account or deployment before launching a takeover.
          </p>
        </footer>
      </div>
    </main>
  );
}
