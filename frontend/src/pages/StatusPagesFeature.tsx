import { MarketingFeaturePage } from '../components/MarketingFeaturePage';

export default function StatusPagesFeature() {
  return (
    <MarketingFeaturePage
      title="Status Pages | Zer0Friction"
      description="Create public status pages for websites, APIs, and services with uptime visibility and incident communication."
      canonicalPath="/status-pages-feature"
      eyebrow="Status Pages"
      heroTitle="Public status pages that help you communicate clearly during downtime."
      heroDescription="Build status pages for your website, API, or service so customers can see operational state, component health, and incident updates."
      keyword="status pages"
      benefits={[
        'Reduce support load by giving customers one place to check service health.',
        'Pair status pages with uptime monitoring and incident workflows from the same product.',
        'Show recent incidents and component state without sending users into a support spiral.',
      ]}
      sections={[
        {
          title: 'Status communication without extra tools',
          description:
            'Instead of stitching together separate monitoring and communication products, Zer0Friction keeps monitors, incidents, and status pages connected.',
        },
        {
          title: 'Built for SaaS trust',
          description:
            'During outages, customers want clarity. A clean status page with current service state and recent updates reduces confusion and improves confidence.',
        },
        {
          title: 'Operational consistency',
          description:
            'Your team sees the same incident and monitor context that customers see externally, which makes updates faster and more consistent.',
        },
      ]}
    />
  );
}
