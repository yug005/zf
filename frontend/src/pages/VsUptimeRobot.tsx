import { ComparisonPage } from '../components/ComparisonPage';

export default function VsUptimeRobot() {
  return (
    <ComparisonPage
      title="Zer0Friction vs UptimeRobot | Monitoring Comparison"
      description="Compare Zer0Friction vs UptimeRobot for uptime monitoring, incident context, deploy tracking, status pages, and team workflow."
      canonicalPath="/vs-uptimerobot"
      competitor="UptimeRobot"
      heroTitle="Zer0Friction vs UptimeRobot"
      heroDescription="UptimeRobot is well known for lightweight uptime checks. Zer0Friction is built for teams that want monitoring plus incident clarity, deploy-aware context, and a tighter product workflow."
      rows={[
        {
          category: 'Core positioning',
          zer0friction: 'Focused uptime and incident workspace for product teams.',
          competitor: 'Popular uptime monitoring tool with broad awareness in the market.',
        },
        {
          category: 'Incident context',
          zer0friction: 'Built around incidents, checks, changes, and ownership metadata in one product.',
          competitor: 'Primarily known for monitoring and alerts.',
        },
        {
          category: 'Deploy awareness',
          zer0friction: 'Tracks change events and correlates outages with recent deploys.',
          competitor: 'Not positioned around deploy-aware incident workflows.',
        },
        {
          category: 'Public status experience',
          zer0friction: 'Status pages connect directly with monitor and incident context.',
          competitor: 'Status and uptime communication are available, but the core product is widely recognized for monitoring first.',
        },
        {
          category: 'Best fit',
          zer0friction: 'SaaS teams that want a cleaner all-in-one reliability workflow.',
          competitor: 'Teams looking for a familiar, straightforward uptime monitoring option.',
        },
      ]}
      summary={[
        'Choose Zer0Friction if you want uptime monitoring tied closely to incidents, deploy changes, and operational visibility.',
        'Choose UptimeRobot if your main need is a familiar lightweight uptime-checking experience.',
        'Zer0Friction is the better fit when your team wants product-level context, not only a list of monitor states.',
      ]}
    />
  );
}
