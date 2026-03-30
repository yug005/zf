import { MarketingFeaturePage } from '../components/MarketingFeaturePage';

export default function WebsiteMonitoring() {
  return (
    <MarketingFeaturePage
      title="Website Monitoring | Zer0Friction"
      description="Website monitoring for uptime, response time, incidents, and public status visibility with Zer0Friction."
      canonicalPath="/website-monitoring"
      eyebrow="Website Monitoring"
      heroTitle="Website monitoring that tells you when your site slows down, breaks, or goes fully down."
      heroDescription="Monitor website uptime, response time, availability trends, and alert history from one focused dashboard built for modern teams."
      keyword="website monitoring"
      benefits={[
        'Track website uptime and response-time changes before customers complain.',
        'Catch downtime with alerts routed to email and Slack-friendly workflows.',
        'Use incident context, deploy history, and public status pages from one product.',
      ]}
      sections={[
        {
          title: 'Uptime checks that stay readable',
          description:
            'Zer0Friction keeps website monitoring understandable: uptime, latest checks, alert activity, and historical context live together so your team spends less time decoding the dashboard.',
        },
        {
          title: 'Response-time visibility',
          description:
            'Website monitoring is not only about outages. Track latency drift, recurring slowness, and failed responses over time to understand whether the issue is temporary or systemic.',
        },
        {
          title: 'Status pages that improve trust',
          description:
            'When your website has an incident, a public status page helps you communicate clearly with customers instead of leaving them guessing.',
        },
      ]}
    />
  );
}
