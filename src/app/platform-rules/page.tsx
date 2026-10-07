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
            These rules explain how paid takeovers, submitted destinations, public streaming, and platform access are expected to work. This is product policy copy, not legal advice, and it must be reviewed by a lawyer before use as binding terms.
          </p>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-300">
            <p>
              <span className="font-semibold text-white">Stats:</span> See the <Link className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="/hall-of-fame">Hall of Fame</Link>.
            </p>
            <p>
              <span className="font-semibold text-white">Effective date:</span> October 7, 2026
            </p>
            <p>
              <span className="font-semibold text-white">Support:</span> Visit the <Link className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="/contact">contact page</Link> or email <a className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="mailto:support@theonlytab.io">support@theonlytab.io</a>.
            </p>
          </div>
        </header>

        <section className={sectionClassName} aria-labelledby="eligibility-heading">
          <h2 id="eligibility-heading" className="text-2xl font-black tracking-tight text-white">
            Eligibility
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <li>You must be at least 18 years old, the age of majority where you live, and legally able to enter a binding contract. If the age of majority in your jurisdiction is higher than 18, that higher age applies.</li>
            <li>Minors may not use the service, create or pay for takeovers, or submit destinations, even with a parent or guardian&apos;s permission.</li>
            <li>By using the service, you represent that you meet these requirements and may lawfully use the service from your location.</li>
          </ul>
        </section>

        <section className={sectionClassName} aria-labelledby="takeover-rules-heading">
          <h2 id="takeover-rules-heading" className="text-2xl font-black tracking-tight text-white">
            Takeover rules
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <li>
              <span className="font-semibold text-white">Payments and refunds:</span> payments are processed by Stripe, our payment processor. All sales are final and non-refundable except where a refund is required by applicable law or expressly stated by the operator. Stripe&apos;s terms may also apply.
            </li>
            <li>
              <span className="font-semibold text-white">Stage duration and availability:</span> a takeover grants time on the stage only while capacity, system health, and platform availability allow. The platform may delay, shorten, pause, or end a session if needed to keep the service running safely.
            </li>
            <li>
              <span className="font-semibold text-white">Pricing and competition:</span> prices, bidding, and steal mechanics may change at any time. The price presented for your checkout applies to that transaction; later prices may differ. A takeover does not guarantee any minimum audience, view count, click, or traffic.
            </li>
            <li>
              <span className="font-semibold text-white">Viewer likes:</span> each active like raises the next steal price by 1%, up to 50%; likes expire after 10 minutes. Reported stages do not receive a crowd price increase. The price shown when checkout starts is locked for that payment.
            </li>
            <li>
              <span className="font-semibold text-white">Free protection:</span> every takeover receives a 90-second protection window. After it expires, the stage can be stolen at the displayed price.
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
              <span className="font-semibold text-white">Rights and authorization:</span> submit only a URL and content you are authorized to access, publicly display, stream, and direct viewers to. You are responsible for obtaining all necessary permissions and for the content and operation of your destination.
            </li>
            <li>
              <span className="font-semibold text-white">Illegal and exploitative content:</span> no content or activity that violates applicable law, including child sexual abuse material (CSAM). CSAM is strictly prohibited and may be reported to law enforcement and the National Center for Missing &amp; Exploited Children (NCMEC), where applicable.
            </li>
            <li>
              <span className="font-semibold text-white">Violence and exploitation:</span> no terrorism or violent-extremism content, credible threats, incitement to violence, non-consensual intimate imagery, sexual exploitation, harassment, or hateful abuse.
            </li>
            <li>
              <span className="font-semibold text-white">Intellectual property:</span> no content that infringes copyright, trademark, privacy, publicity, or other rights. Rights holders may use the takedown process below.
            </li>
            <li>
              <span className="font-semibold text-white">Malware, phishing, and fraud:</span> no malware, viruses, phishing, credential theft, deceptive impersonation, scams, fraudulent schemes, or links designed to compromise, mislead, or exploit viewers.
            </li>
            <li>
              <span className="font-semibold text-white">Unlawful promotion:</span> no spam or schemes, or advertising, products, or claims that violate applicable advertising, consumer-protection, or disclosure laws.
            </li>
            <li>
              <span className="font-semibold text-white">Safety and legal risk:</span> the operator may reject or remove content it reasonably believes creates legal, security, or safety risks, even if a specific category is not listed here.
            </li>
          </ul>
        </section>

        <section className={sectionClassName} aria-labelledby="third-party-sites-heading">
          <h2 id="third-party-sites-heading" className="text-2xl font-black tracking-tight text-white">
            Third-party destinations
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <p>
              The service may use an automated browser to load and publicly stream the URL you submit. The operator does not control, endorse, or assume responsibility for third-party websites, their content, availability, security, or privacy practices.
            </p>
            <p>
              Viewers access third-party destinations at their own risk. You are responsible for the destination you submit and must not use the service to cause unlawful access or display.
            </p>
          </div>
        </section>

        <section className={sectionClassName} aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="text-2xl font-black tracking-tight text-white">
            Privacy
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <p>
              To provide and secure the service, the platform may process your target URL (including its start path), display name, checkout and payment-session metadata, takeover and pricing data, and operational records. IP addresses may be used for rate limiting; hashed or derived IP-based buckets may be recorded in security logs.
            </p>
            <p>
              This information may be used to operate the public stream and checkout, prevent abuse, maintain security, troubleshoot issues, and comply with law. Payment details are handled through the checkout provider and are subject to its privacy terms. This summary is not a complete privacy notice; the operator should publish a separate notice describing applicable collection, retention, sharing, and privacy rights.
            </p>
            <p>
              Do not submit secrets, credentials, payment card data outside the intended checkout flow, or unnecessary personal information in fields meant for takeover configuration.
            </p>
            <p>
              As an operator in the European Union, we handle personal data in accordance with GDPR. For data subject requests, contact <a className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="mailto:support@theonlytab.io">support@theonlytab.io</a>.
            </p>
          </div>
        </section>

        <section className={sectionClassName} aria-labelledby="dmca-heading">
          <h2 id="dmca-heading" className="text-2xl font-black tracking-tight text-white">
            Copyright and takedown notices
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <p>
              If you believe content submitted by a user infringes your copyright, send a notice to <a className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="mailto:support@theonlytab.io">support@theonlytab.io</a> with: your physical or electronic signature; identification of the copyrighted work; the URL or other information sufficient to locate the allegedly infringing material; your contact information; a statement of good-faith belief that the use is unauthorized; and a statement, under penalty of perjury, that the notice is accurate and you are authorized to act for the rights holder.
            </p>
            <p>
              The operator may remove or disable access to reported material, notify the submitting user, and terminate repeat infringers. Counsel should adapt this process and add any required counter-notice procedure and designated-agent details for the operator&apos;s jurisdiction.
            </p>
          </div>
        </section>

        <section className={sectionClassName} aria-labelledby="warranty-heading">
          <h2 id="warranty-heading" className="text-2xl font-black tracking-tight text-white">
            No warranties
          </h2>
          <p className="mt-4 text-sm leading-6 text-neutral-300 sm:text-base">
            To the maximum extent permitted by law, the service, streams, stage availability, uptime, and any audience or traffic are provided “as is” and “as available,” without warranties of any kind, express, implied, or statutory, including merchantability, fitness for a particular purpose, non-infringement, uninterrupted availability, or error-free operation. The operator does not warrant that a submitted destination will load or remain available.
          </p>
        </section>

        <section className={sectionClassName} aria-labelledby="liability-heading">
          <h2 id="liability-heading" className="text-2xl font-black tracking-tight text-white">
            Limitation of liability
          </h2>
          <p className="mt-4 text-sm leading-6 text-neutral-300 sm:text-base">
            To the maximum extent permitted by law, the operator and its personnel will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or lost profits, data, goodwill, audience, or traffic. To the maximum extent permitted by law, the operator&apos;s total liability for claims relating to the service will not exceed the amount you paid for the transaction giving rise to the claim, or, if no single transaction gives rise to the claim, the amount you paid for the service during the 12 months before the event. These limits do not apply where prohibited by law or to liability that cannot legally be limited.
          </p>
        </section>

        <section className={sectionClassName} aria-labelledby="indemnity-heading">
          <h2 id="indemnity-heading" className="text-2xl font-black tracking-tight text-white">
            Indemnification
          </h2>
          <p className="mt-4 text-sm leading-6 text-neutral-300 sm:text-base">
            To the extent permitted by law, you agree to defend, indemnify, and hold harmless the operator and its personnel from third-party claims, losses, liabilities, and reasonable costs arising from your submitted URL or content, your use of the service, or your violation of these rules or applicable law. Counsel should review the scope and enforceability of this clause.
          </p>
        </section>

        <section className={sectionClassName} aria-labelledby="termination-heading">
          <h2 id="termination-heading" className="text-2xl font-black tracking-tight text-white">
            Suspension and termination
          </h2>
          <p className="mt-4 text-sm leading-6 text-neutral-300 sm:text-base">
            The operator may suspend or terminate access, refuse service, remove a destination, or forfeit remaining stage time if it reasonably believes there is a rule violation, suspected fraud, chargeback, security issue, or legal or safety risk. Where access is terminated for cause, the operator is not liable for lost stage time, subject to any non-waivable rights under applicable law.
          </p>
        </section>

        <section className={sectionClassName} aria-labelledby="governing-law-heading">
          <h2 id="governing-law-heading" className="text-2xl font-black tracking-tight text-white">
            Governing law and disputes
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <p>
              Before starting formal proceedings, the parties should first attempt to resolve a dispute informally by sending a description of the issue and proposed resolution to <a className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="mailto:support@theonlytab.io">support@theonlytab.io</a> and allowing 30 days for a response.
            </p>
            <p>
              Disputes arising from these rules shall be governed by and construed in accordance with the laws of the Netherlands, without regard to its conflict of law principles. You agree to submit to the exclusive jurisdiction of the courts of Amsterdam, Netherlands.
            </p>
          </div>
        </section>

        <section className={sectionClassName} aria-labelledby="changes-heading">
          <h2 id="changes-heading" className="text-2xl font-black tracking-tight text-white">
            Changes and severability
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-300 sm:text-base">
            <p>
              The operator may update these rules at any time and will update the effective date when doing so. Continued use after an updated version is posted constitutes acceptance of the changes to the extent permitted by law. The operator should provide any additional notice required by law.
            </p>
            <p>
              If a provision is found unenforceable, it will be limited or removed only to the extent necessary, and the remaining provisions will remain in effect.
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
            Questions, legal notices, or copyright reports? Visit the <Link className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="/contact">contact page</Link> or email <a className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="mailto:support@theonlytab.io">support@theonlytab.io</a>. Include your account or session details where relevant, but do not send payment-card data or sensitive credentials. The operator should add and verify its legal name and notice address before publishing these rules.
          </p>
          <p className="mt-3">
            <Link className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="/">Back to dashboard</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
