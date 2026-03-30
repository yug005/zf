import { ComparisonPage } from '../components/ComparisonPage';

export default function VsBetterStack() {
  return (
    <ComparisonPage
      title="Zer0Friction vs Better Stack | Monitoring Comparison"
      description="Compare Zer0Friction vs Better Stack for uptime monitoring, status pages, incident visibility, and team workflow."
      canonicalPath="/vs-better-stack"
      competitor="Better Stack"
      heroTitle="Zer0Friction vs Better Stack"
      heroDescription="Better Stack has strong market visibility across uptime, logs, and incident workflows. Zer0Friction is a tighter alternative for teams that want a focused monitoring product without absorbing a broader platform."
      rows={[
        {
          category: 'Product shape',
          zer0friction: 'Focused monitoring workspace with changes, incidents, and status pages.',
          competitor: 'Broader operational platform with uptime and other observability surfaces.',
        },
        {
          category: 'Operational simplicity',
          zer0friction: 'Opinionated flow designed to feel smaller and faster.',
          competitor: 'Richer surface area, but more platform to learn.',
        },
        {
          category: 'Deploy-aware monitoring',
          zer0friction: 'Built to connect incidents and changes directly.',
          competitor: 'Known for uptime and operational tooling, but not positioned solely around deploy-aware simplicity.',
        },
        {
          category: 'Best fit',
          zer0friction: 'Teams that want a leaner product for uptime and incident context.',
          competitor: 'Teams that want a larger operations platform footprint.',
        },
        {
          category: 'Status communication',
          zer0friction: 'Status pages tie directly to monitor and incident workflows.',
          competitor: 'Strong status and uptime capabilities in a broader product family.',
        },
      ]}
      summary={[
        'Choose Zer0Friction if you want a more focused uptime-and-incidents experience.',
        'Choose Better Stack if you want broader operational tooling in one vendor surface.',
        'Zer0Friction is the better fit when you care more about clarity and speed than platform breadth.',
      ]}
    />
  );
}
