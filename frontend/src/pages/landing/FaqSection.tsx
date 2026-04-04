import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    question: 'How does the real-time monitoring work?',
    answer: 'Zer0Friction runs a globally distributed engine that constantly pings your API endpoints at specific intervals (as low as 1 second). It evaluates HTTP status codes, payload structures, and latency constraints instantly.',
  },
  {
    question: 'How fast are alerts actually sent?',
    answer: "Milliseconds. As soon as an outage is verified across multiple nodes to eliminate false positives, our BullMQ-powered alerting system dispatches the notification instantly.",
  },
  {
    question: 'Do you support Slack and Email alerts?',
    answer: "Yes! You can configure direct notifications to your personal inbox, or route critical infrastructure alerts straight into a dedicated engineering Slack or Discord channel.",
  },
  {
    question: 'Is there a free trial?',
    answer: "Yes. Every account starts with a 14-day trial that includes 5 monitors. After expiry, your dashboard and history stay visible, but active monitoring pauses until you upgrade.",
  },
  {
    question: 'Can I cancel anytime?',
    answer: "You can cancel your subscription inside the billing dashboard at any time. We also offer a strict 14-day no-questions-asked refund guarantee if you aren't completely satisfied.",
  },
];

/* ─── FAQ Item ───────────────────────────────────────── */
function FaqItem({
  faq, isOpen, toggle, index,
}: {
  faq: typeof FAQS[0]; isOpen: boolean; toggle: () => void; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05 * index, duration: 0.5 }}
      className="border-b border-white/[0.06] last:border-0"
    >
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between py-6 text-left group"
      >
        <span className={`text-base font-semibold pr-8 transition-colors duration-300
          ${isOpen ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
          {faq.question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-white/30 shrink-0 transition-transform duration-300
            ${isOpen ? 'rotate-180 text-aurora-teal' : ''}`}
        />
      </button>
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
        className="overflow-hidden"
      >
        <p className="pb-6 text-sm text-white/40 leading-relaxed max-w-2xl">
          {faq.answer}
        </p>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main FAQ Section ───────────────────────────────── */
export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-32 px-6 bg-void-950 overflow-hidden">
      <div className="max-w-3xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Questions?{' '}
            <span className="text-white/30">Answers.</span>
          </h2>
          <p className="mt-4 text-white/40">
            Don't see your question?{' '}
            <a href="mailto:yug@zer0friction.in" className="text-aurora-teal hover:underline transition-colors">
              Email us
            </a>
          </p>
        </motion.div>

        <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm p-2 md:p-6">
          {FAQS.map((faq, i) => (
            <FaqItem
              key={i}
              faq={faq}
              index={i}
              isOpen={openIndex === i}
              toggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
