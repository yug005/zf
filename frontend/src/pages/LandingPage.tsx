import { PageMeta } from '../components/PageMeta';
import { SeoJsonLd } from '../components/SeoJsonLd';
import Navbar from './landing/Navbar';
import HeroSection from './landing/HeroSection';
import LiveDashboard from './landing/LiveDashboard';
import SpeedSection from './landing/SpeedSection';
import FeatureConstellation from './landing/FeatureConstellation';
import ArchitectureFlow from './landing/ArchitectureFlow';
import SocialProof from './landing/SocialProof';
import PricingPortal from './landing/PricingPortal';
import FaqSection from './landing/FaqSection';
import FinalCta from './landing/FinalCta';
import FooterSection from './landing/FooterSection';

/* ─── SEO Schemas ────────────────────────────────────── */
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does the real-time monitoring work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Zer0Friction runs a globally distributed engine that constantly pings your API endpoints at specific intervals (as low as 1 second). It evaluates HTTP status codes, payload structures, and latency constraints instantly.',
      },
    },
    {
      '@type': 'Question',
      name: 'How fast are alerts actually sent?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Milliseconds. As soon as an outage is verified across multiple nodes to eliminate false positives, our BullMQ-powered alerting system dispatches the notification instantly.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do you support Slack and Email alerts?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! You can configure direct notifications to your personal inbox, or route critical infrastructure alerts straight into a dedicated engineering Slack or Discord channel.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is there a free trial?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Every account starts with a 14-day trial that includes 5 monitors. After expiry, your dashboard and history stay visible, but active monitoring pauses until you upgrade.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I cancel anytime?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "You can cancel your subscription inside the billing dashboard at any time. We also offer a strict 14-day no-questions-asked refund guarantee if you aren't completely satisfied.",
      },
    },
  ],
};

const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Zer0Friction',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://www.zer0friction.in/',
  description:
    'Uptime monitoring for websites, APIs, SSL, DNS, incidents, deploy tracking, and status pages.',
  offers: [
    { '@type': 'Offer', price: '0', priceCurrency: 'INR', name: 'Trial' },
    { '@type': 'Offer', price: '149', priceCurrency: 'INR', name: 'Lite' },
    { '@type': 'Offer', price: '499', priceCurrency: 'INR', name: 'Pro' },
  ],
  provider: {
    '@type': 'Organization',
    name: 'Zer0Friction',
    url: 'https://www.zer0friction.in/',
    email: 'yug@zer0friction.in',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Zer0Friction',
  url: 'https://www.zer0friction.in/',
  logo: 'https://www.zer0friction.in/favicon.svg',
  email: 'yug@zer0friction.in',
  sameAs: ['https://github.com/yug005'],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Zer0Friction',
  url: 'https://www.zer0friction.in/',
  description:
    'Uptime monitoring for websites, APIs, incidents, deploy tracking, and status pages.',
  publisher: { '@type': 'Organization', name: 'Zer0Friction' },
};

/* ─── Main Landing Page ──────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-void-950 dark:bg-void-950 font-sans overflow-x-hidden selection:bg-aurora-teal/30">
      <PageMeta
        title="Zer0Friction | Uptime Monitoring for Websites, APIs, SSL, DNS, and Status Pages"
        description="Monitor websites, APIs, SSL, DNS, incidents, status pages, and deploy health with Zer0Friction's focused uptime platform."
        canonicalPath="/"
      />
      <SeoJsonLd id="landing-faq" data={faqSchema} />
      <SeoJsonLd id="landing-product" data={productSchema} />
      <SeoJsonLd id="landing-organization" data={organizationSchema} />
      <SeoJsonLd id="landing-website" data={websiteSchema} />

      <Navbar />

      <main>
        <HeroSection />
        <LiveDashboard />
        <SpeedSection />
        <FeatureConstellation />
        <ArchitectureFlow />
        <SocialProof />
        <PricingPortal />
        <FaqSection />
        <FinalCta />
      </main>

      <FooterSection />
    </div>
  );
}
