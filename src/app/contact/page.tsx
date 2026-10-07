'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';

const sectionClassName =
  'rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] ring-1 ring-white/5 sm:p-7';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

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
            <Mail className="h-3.5 w-3.5" />
            Contact support
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">How can we help?</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-300 sm:text-base">
            Use this form to prepare a support request, bug report, copyright or DMCA notice, or legal inquiry.
          </p>
        </header>

        <section className={sectionClassName} aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading" className="sr-only">Contact form</h2>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="contact-name" className="text-sm font-semibold text-neutral-100">Name</label>
                <input
                  autoComplete="name"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-500 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20 sm:text-sm"
                  id="contact-name"
                  name="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="contact-email" className="text-sm font-semibold text-neutral-100">Email</label>
                <input
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-500 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20 sm:text-sm"
                  id="contact-email"
                  name="email"
                  required
                  type="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="contact-subject" className="text-sm font-semibold text-neutral-100">Subject</label>
              <select
                className="w-full rounded-2xl border border-white/10 bg-[#101318] px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20 sm:text-sm"
                id="contact-subject"
                name="subject"
                required
                defaultValue=""
              >
                <option disabled value="">Choose a subject</option>
                <option>Support</option>
                <option>Bug Report</option>
                <option>Copyright/DMCA</option>
                <option>Legal Notice</option>
                <option>Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="contact-message" className="text-sm font-semibold text-neutral-100">Message</label>
              <textarea
                className="min-h-40 w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-500 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20 sm:text-sm"
                id="contact-message"
                name="message"
                required
                rows={6}
              />
            </div>

            <p className="text-xs leading-5 text-neutral-400">
              This form does not send or store messages. Do not include passwords, payment-card data, or other sensitive information.
            </p>
            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-[#07100d] transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b10] sm:w-auto"
              type="submit"
            >
              Continue
            </button>
          </form>

          {submitted && (
            <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100" role="status" aria-live="polite">
              Thank you for reaching out. Your message has not been sent; please email{' '}
              <a className="font-semibold underline underline-offset-2" href="mailto:support@theonlytab.io">support@theonlytab.io</a>{' '}
              with your request.
            </div>
          )}
        </section>

        <footer className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-5 text-sm leading-6 text-neutral-300 ring-1 ring-white/5">
          <p>
            For reports, legal notices, or copyright concerns, email <a className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="mailto:support@theonlytab.io">support@theonlytab.io</a>.
          </p>
          <p className="mt-3">
            <Link className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200" href="/platform-rules">Read the platform rules</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
