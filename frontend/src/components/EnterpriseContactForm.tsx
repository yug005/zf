import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Building2, Headphones, ShieldCheck } from 'lucide-react';

type EnterpriseContactFormProps = {
  className?: string;
};

export function EnterpriseContactForm({ className = '' }: EnterpriseContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [requirements, setRequirements] = useState('');
  const [hasOpenedDraft, setHasOpenedDraft] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const subject = `Enterprise plan inquiry from ${company || name}`;
    const body = [
      'Hello Zer0Friction team,',
      '',
      'I want to discuss the Enterprise plan.',
      '',
      `Name: ${name}`,
      `Work Email: ${email}`,
      `Company: ${company}`,
      '',
      'Requirements:',
      requirements,
      '',
      'Please contact me with the next steps.',
    ].join('\n');

    window.location.href = `mailto:yug@zer0friction.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setHasOpenedDraft(true);
  };

  return (
    <div className={`relative flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm ${className}`}>
      <div className="mb-6 inline-flex w-fit items-center rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-white">
        Enterprise
      </div>

      <h3 className="text-2xl font-bold text-slate-900">Contact Support</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        Need higher volumes, custom onboarding, or a tailored monitoring setup? Share your details and our team will contact you.
      </p>

      <ul className="mt-6 space-y-3 text-sm text-slate-700">
        <li className="flex items-start">
          <Building2 className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
          Custom monitor volume and enterprise onboarding
        </li>
        <li className="flex items-start">
          <ShieldCheck className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
          Dedicated support for larger customer-facing infrastructure
        </li>
        <li className="flex items-start">
          <Headphones className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
          Rollout help for bigger teams and production workloads
        </li>
      </ul>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Name
          </label>
          <input
            required
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Work Email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Company
          </label>
          <input
            required
            type="text"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Company name"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Requirements
          </label>
          <textarea
            required
            rows={4}
            value={requirements}
            onChange={(event) => setRequirements(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Tell us about monitor volume, team size, or any custom needs."
          />
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Contact support
          <ArrowRight className="ml-2 h-4 w-4" />
        </button>
      </form>

      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {hasOpenedDraft
          ? 'Your enterprise request email is ready. Send it and our team will contact you.'
          : 'Fill this form and we will prepare your enterprise contact request.'}
      </div>
    </div>
  );
}
