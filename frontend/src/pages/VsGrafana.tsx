import { ComparisonPage } from '../components/ComparisonPage';

export default function VsGrafana() {
  return (
    <ComparisonPage
      title="Zer0Friction vs Grafana | Monitoring Comparison"
      description="Compare Zer0Friction vs Grafana for uptime monitoring, synthetic monitoring workflows, status pages, and operational simplicity."
      canonicalPath="/vs-grafana"
      competitor="Grafana"
      heroTitle="Zer0Friction vs Grafana"
      heroDescription="Grafana is a broad observability platform with dashboards, alerting, synthetic monitoring, and incident tooling. Zer0Friction is built for teams who want a narrower uptime and incident workflow with less complexity."
      rows={[
        {
          category: 'Platform scope',
          zer0friction: 'Narrower, simpler monitoring and incident surface.',
          competitor: 'Broad observability platform spanning dashboards, alerts, testing, and more.',
        },
        {
          category: 'Ease of use',
          zer0friction: 'Opinionated and faster to understand for product teams.',
          competitor: 'Extremely flexible, but often heavier to configure and operate.',
        },
        {
          category: 'Uptime workflow',
          zer0friction: 'Built around monitors, incidents, changes, and status pages.',
          competitor: 'Can support uptime use cases, but as part of a much larger platform.',
        },
        {
          category: 'Best fit',
          zer0friction: 'Teams that want a focused SaaS reliability product.',
          competitor: 'Teams that need a wider observability and dashboard ecosystem.',
        },
        {
          category: 'Product tradeoff',
          zer0friction: 'Less platform sprawl, more opinionated workflows.',
          competitor: 'More power and breadth, but also more complexity.',
        },
      ]}
      summary={[
        'Choose Zer0Friction if your main problem is uptime, incident clarity, and deploy-aware reliability workflows.',
        'Choose Grafana if you need a much broader observability platform with dashboards and multi-signal tooling.',
        'Zer0Friction wins when simplicity, team speed, and a tighter monitoring workflow matter more than platform breadth.',
      ]}
    />
  );
}
