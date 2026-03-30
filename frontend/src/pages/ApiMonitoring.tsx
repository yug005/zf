import { MarketingFeaturePage } from '../components/MarketingFeaturePage';

export default function ApiMonitoring() {
  return (
    <MarketingFeaturePage
      title="API Monitoring | Zer0Friction"
      description="API monitoring for uptime, latency, incidents, alerting, and deploy-aware diagnostics with Zer0Friction."
      canonicalPath="/api-monitoring"
      eyebrow="API Monitoring"
      heroTitle="API monitoring built for teams that need fast incident clarity, not noisy charts."
      heroDescription="Monitor API uptime, status codes, latency, and outage history with a cleaner workflow for backend-heavy products."
      keyword="API monitoring"
      benefits={[
        'Monitor API endpoints with clear status, timing, and failure history.',
        'Connect incidents to likely deploys so debugging starts with better context.',
        'Manage alerts, projects, and API keys from the same workspace.',
      ]}
      sections={[
        {
          title: 'Latency and status-code tracking',
          description:
            'API monitoring should show both hard failures and creeping performance degradation. Zer0Friction highlights response-time trends alongside availability so you can catch problems earlier.',
        },
        {
          title: 'Deploy-aware troubleshooting',
          description:
            'When an API fails right after a release, your team needs that context immediately. Zer0Friction connects change events and incidents to reduce guesswork.',
        },
        {
          title: 'Monitoring for real product teams',
          description:
            'Use a dashboard that is focused on uptime, incidents, checks, and actionability instead of making every reliability task feel like a custom observability project.',
        },
      ]}
    />
  );
}
