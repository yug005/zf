import { ComparisonPage } from '../components/ComparisonPage';

export default function VsPingdom() {
  return (
    <ComparisonPage
      title="Zer0Friction vs Pingdom | Monitoring Comparison"
      description="Compare Zer0Friction vs Pingdom for website monitoring, synthetic workflows, status visibility, and incident handling."
      canonicalPath="/vs-pingdom"
      competitor="Pingdom"
      heroTitle="Zer0Friction vs Pingdom"
      heroDescription="Pingdom is widely known for synthetic monitoring, transaction checks, and website performance visibility. Zer0Friction is built for teams who want a more focused uptime and incident workflow with status pages and deploy context."
      rows={[
        {
          category: 'Monitoring style',
          zer0friction: 'Focused reliability workspace for uptime, incidents, and deploy context.',
          competitor: 'Known for website monitoring and synthetic monitoring capabilities.',
        },
        {
          category: 'Incident workflow',
          zer0friction: 'Changes, monitor history, and incident visibility live together.',
          competitor: 'Monitoring-first experience with stronger emphasis on synthetic capabilities.',
        },
        {
          category: 'Team experience',
          zer0friction: 'Built for a tighter, more product-like workflow.',
          competitor: 'Strong monitoring heritage with a more traditional tooling posture.',
        },
        {
          category: 'Best fit',
          zer0friction: 'Teams that want a cleaner reliability product surface.',
          competitor: 'Teams prioritizing established synthetic and website monitoring depth.',
        },
        {
          category: 'Tradeoff',
          zer0friction: 'Simpler and more opinionated.',
          competitor: 'Broader monitoring depth, but potentially heavier for teams wanting a narrow workflow.',
        },
      ]}
      summary={[
        'Choose Zer0Friction if you want a smaller, cleaner uptime and incident workflow for your product team.',
        'Choose Pingdom if your team is primarily shopping for established website and synthetic monitoring depth.',
        'Zer0Friction is strongest when the goal is operational clarity, not tool sprawl.',
      ]}
    />
  );
}
