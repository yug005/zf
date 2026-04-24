import { Link } from 'react-router-dom';
import {
  Globe, Github, Mail, ArrowRight, Terminal,
  Activity, Search, Scale, FileText,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

const EXPLORE_PAGES = [
  { title: 'Pricing', to: '/pricing', icon: FileText, badge: 'Start here' },
  { title: 'API Monitoring Tools', to: '/api-monitoring-tools', icon: Search, badge: 'Research' },
  { title: 'Website Monitoring', to: '/website-monitoring', icon: Globe, badge: 'Feature' },
  { title: 'API Monitoring', to: '/api-monitoring', icon: Activity, badge: 'Feature' },
  { title: 'vs UptimeRobot', to: '/vs-uptimerobot', icon: Scale, badge: 'Compare' },
  { title: 'vs Grafana', to: '/vs-grafana', icon: Scale, badge: 'Compare' },
  { title: 'CLI for npm', to: '/cli', icon: Terminal, badge: 'CLI' },
];

export default function FooterSection() {
  return (
    <footer className="relative border-t pt-20 pb-12 px-6"
      style={{ background: 'var(--color-surface-base)', borderColor: 'var(--color-border-primary)' }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Explore pages grid */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">
              Explore Zer0Friction
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {EXPLORE_PAGES.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                className="group p-4 rounded-xl border transition-all duration-300 text-center"
                style={{ background: 'var(--color-surface-glass)', borderColor: 'var(--color-border-secondary)' }}
              >
                <page.icon className="w-5 h-5 text-[var(--color-text-tertiary)] mx-auto mb-2
                  group-hover:text-aurora-teal transition-colors" />
                <div className="text-xs font-semibold text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                  {page.title}
                </div>
                <div className="text-[9px] text-[var(--color-text-tertiary)] mt-1 uppercase tracking-wider">
                  {page.badge}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Main footer grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
          {/* Brand column */}
          <div className="col-span-2">
            <div className="mb-6">
              <BrandLogo />
            </div>
            <p className="text-sm text-[var(--color-text-tertiary)] mb-6 max-w-xs leading-relaxed">
              Platform-independent uptime monitoring. Resolving infrastructure complexity for teams that ship fast.
            </p>
            <div className="flex gap-3">
              <a
                href="https://github.com/yug005"
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-lg border transition-all text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                style={{ background: 'var(--color-surface-glass)', borderColor: 'var(--color-border-secondary)' }}
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="mailto:yug@zer0friction.in"
                className="p-2.5 rounded-lg border transition-all text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                style={{ background: 'var(--color-surface-glass)', borderColor: 'var(--color-border-secondary)' }}
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-[10px] font-bold text-[var(--color-text-tertiary)] mb-5 uppercase tracking-[0.2em]">Product</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/website-monitoring" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">Website Monitoring</Link></li>
              <li><Link to="/api-monitoring" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">API Monitoring</Link></li>
              <li><Link to="/ssl-monitoring" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">SSL Monitoring</Link></li>
              <li><Link to="/status-pages-feature" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">Status Pages</Link></li>
              <li><Link to="/pricing" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">Pricing</Link></li>
              <li><Link to="/cli" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">CLI for npm</Link></li>
              <li><Link to="/how-to-use" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">User Manual</Link></li>
              <li><Link to="/login" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">Dashboard Login</Link></li>
            </ul>
          </div>

          {/* Compare */}
          <div>
            <h3 className="text-[10px] font-bold text-[var(--color-text-tertiary)] mb-5 uppercase tracking-[0.2em]">Compare</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/vs-uptimerobot" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">vs UptimeRobot</Link></li>
              <li><Link to="/vs-grafana" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">vs Grafana</Link></li>
              <li><Link to="/vs-better-stack" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">vs Better Stack</Link></li>
              <li><Link to="/vs-pingdom" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">vs Pingdom</Link></li>
              <li><Link to="/api-monitoring-tools" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">Monitoring Tools</Link></li>
              <li><a href="https://github.com/yug005" target="_blank" rel="noreferrer" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">About the Founder</a></li>
              <li><a href="mailto:yug@zer0friction.in" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">Contact Support</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-[10px] font-bold text-[var(--color-text-tertiary)] mb-5 uppercase tracking-[0.2em]">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/terms" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">Privacy Policy</Link></li>
              <li><span className="text-[var(--color-text-tertiary)]">14-Day Refund Guarantee</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderColor: 'var(--color-border-primary)' }}
        >
          <p className="text-xs text-[var(--color-text-tertiary)] font-medium">
            © {new Date().getFullYear()} Zer0Friction. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] font-medium">
            <Globe className="w-3.5 h-3.5" />
            India (Remote-first)
          </div>
        </div>
      </div>
    </footer>
  );
}
