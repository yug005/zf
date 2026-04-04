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
    <footer className="relative bg-void-950 border-t border-white/[0.06] pt-20 pb-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Explore pages grid */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
              Explore Zer0Friction
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {EXPLORE_PAGES.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]
                  hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300
                  text-center"
              >
                <page.icon className="w-5 h-5 text-white/30 mx-auto mb-2
                  group-hover:text-aurora-teal transition-colors" />
                <div className="text-xs font-semibold text-white/60 group-hover:text-white transition-colors">
                  {page.title}
                </div>
                <div className="text-[9px] text-white/20 mt-1 uppercase tracking-wider">
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
              <BrandLogo theme="dark" />
            </div>
            <p className="text-sm text-white/30 mb-6 max-w-xs leading-relaxed">
              Platform-independent uptime monitoring. Resolving infrastructure complexity for teams that ship fast.
            </p>
            <div className="flex gap-3">
              <a
                href="https://github.com/yug005"
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]
                  text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="mailto:yug@zer0friction.in"
                className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]
                  text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-[10px] font-bold text-white/50 mb-5 uppercase tracking-[0.2em]">Product</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/website-monitoring" className="text-white/30 hover:text-white transition-colors">Website Monitoring</Link></li>
              <li><Link to="/api-monitoring" className="text-white/30 hover:text-white transition-colors">API Monitoring</Link></li>
              <li><Link to="/ssl-monitoring" className="text-white/30 hover:text-white transition-colors">SSL Monitoring</Link></li>
              <li><Link to="/status-pages-feature" className="text-white/30 hover:text-white transition-colors">Status Pages</Link></li>
              <li><Link to="/pricing" className="text-white/30 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/cli" className="text-white/30 hover:text-white transition-colors">CLI for npm</Link></li>
              <li><Link to="/how-to-use" className="text-white/30 hover:text-white transition-colors">User Manual</Link></li>
              <li><Link to="/login" className="text-white/30 hover:text-white transition-colors">Dashboard Login</Link></li>
            </ul>
          </div>

          {/* Compare */}
          <div>
            <h3 className="text-[10px] font-bold text-white/50 mb-5 uppercase tracking-[0.2em]">Compare</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/vs-uptimerobot" className="text-white/30 hover:text-white transition-colors">vs UptimeRobot</Link></li>
              <li><Link to="/vs-grafana" className="text-white/30 hover:text-white transition-colors">vs Grafana</Link></li>
              <li><Link to="/vs-better-stack" className="text-white/30 hover:text-white transition-colors">vs Better Stack</Link></li>
              <li><Link to="/vs-pingdom" className="text-white/30 hover:text-white transition-colors">vs Pingdom</Link></li>
              <li><Link to="/api-monitoring-tools" className="text-white/30 hover:text-white transition-colors">Monitoring Tools</Link></li>
              <li><a href="https://github.com/yug005" target="_blank" rel="noreferrer" className="text-white/30 hover:text-white transition-colors">About the Founder</a></li>
              <li><a href="mailto:yug@zer0friction.in" className="text-white/30 hover:text-white transition-colors">Contact Support</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-[10px] font-bold text-white/50 mb-5 uppercase tracking-[0.2em]">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/terms" className="text-white/30 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-white/30 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><span className="text-white/30">14-Day Refund Guarantee</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/20 font-medium">
            © {new Date().getFullYear()} Zer0Friction. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-white/20 font-medium">
            <Globe className="w-3.5 h-3.5" />
            India (Remote-first)
          </div>
        </div>
      </div>
    </footer>
  );
}
