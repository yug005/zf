import { MarketingFeaturePage } from '../components/MarketingFeaturePage';

export default function SslMonitoring() {
  return (
    <MarketingFeaturePage
      title="SSL Monitoring | Zer0Friction"
      description="SSL monitoring for certificate health, availability checks, and status visibility with Zer0Friction."
      canonicalPath="/ssl-monitoring"
      eyebrow="SSL Monitoring"
      heroTitle="SSL monitoring that helps you catch certificate issues before they become downtime."
      heroDescription="Track SSL-sensitive service health and keep certificate-related failures visible inside the same uptime workflow as your websites and APIs."
      keyword="SSL monitoring"
      benefits={[
        'Keep SSL-related availability issues visible in your normal monitoring workflow.',
        'See certificate-sensitive endpoints in the same dashboard as API and website checks.',
        'Use incidents and status pages to communicate outages caused by TLS or endpoint failures.',
      ]}
      sections={[
        {
          title: 'One place for reliability signals',
          description:
            'Certificate and TLS-related issues are easy to miss when monitoring is fragmented. Zer0Friction keeps SSL-sensitive checks alongside the rest of your service health.',
        },
        {
          title: 'Operational context that matters',
          description:
            'If an SSL-related issue affects production traffic, your team should be able to see the outage, alert history, and current impact without switching tools.',
        },
        {
          title: 'Built for practical uptime workflows',
          description:
            'Use a simpler monitoring surface for certificate-aware service checks, status visibility, and incident tracking without adding unnecessary complexity.',
        },
      ]}
    />
  );
}
