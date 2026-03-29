import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle,
  ArrowRight,
  MonitorPlay,
  Globe,
  ChevronDown,
  Github,
  Mail,
  Zap,
  Bell,
  ShieldCheck,
  Clock,
  Key,
  HelpCircle
} from 'lucide-react';
import { EnterpriseContactForm } from '../components/EnterpriseContactForm';
import { PageMeta } from '../components/PageMeta';
import { SeoJsonLd } from '../components/SeoJsonLd';

// --- Static Data ---

const FAQS = [
  {
    question: "How does the real-time monitoring work?",
    answer: "Zer0Friction runs a globally distributed engine that constantly pings your API endpoints at specific intervals (as low as 1 second). It evaluates HTTP status codes, payload structures, and latency constraints instantly.",
  },
  {
    question: "How fast are alerts actually sent?",
    answer: "Milliseconds. As soon as an outage is verified across multiple nodes to eliminate false positives, our BullMQ-powered alerting system dispatches the notification instantly.",
  },
  {
    question: "Do you support Slack and Email alerts?",
    answer: "Yes! You can configure direct notifications to your personal inbox, or route critical infrastructure alerts straight into a dedicated engineering Slack or Discord channel.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes. Every account starts with a 14-day trial that includes 5 monitors. After expiry, your dashboard and history stay visible, but active monitoring pauses until you upgrade.",
  },
  {
    question: "Can I cancel anytime? What is the refund policy?",
    answer: "You can cancel your subscription inside the billing dashboard gracefully at any time. We also offer a strict 14-day no-questions-asked refund guarantee if you aren't completely satisfied.",
  }
];

const LANDING_PLANS = [
  {
    name: 'Trial',
    price: '0',
    currency: 'INR',
    monitorLimit: '5 monitors for 14 days',
    apiKeyLimit: '2 API keys',
    interval: '300s minimum interval',
    popular: false,
    cta: 'Start Trial',
  },
  {
    name: 'Lite',
    price: '149',
    currency: 'INR',
    monitorLimit: '5 monitors',
    apiKeyLimit: '2 API keys',
    interval: '300s minimum interval',
    popular: false,
    cta: 'Choose Lite',
  },
  {
    name: 'Pro',
    price: '499',
    currency: 'INR',
    monitorLimit: '50 monitors',
    apiKeyLimit: '10 API keys',
    interval: '60s minimum interval',
    popular: true,
    cta: 'Choose Pro',
  },
  {
    name: 'Business',
    price: '1499',
    currency: 'INR',
    monitorLimit: '200 monitors',
    apiKeyLimit: '50 API keys',
    interval: '30s minimum interval',
    popular: false,
    cta: 'Choose Business',
  },
];

// --- Sub Components ---

const FaqAccordion = ({ 
  faq, 
  isOpen, 
  toggle 
}: { 
  faq: typeof FAQS[0], 
  isOpen: boolean, 
  toggle: () => void 
}) => {
  return (
    <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden transition-all duration-200">
      <button 
        onClick={toggle}
        className="w-full flex justify-between items-center p-6 text-left focus:outline-none"
      >
        <span className="font-semibold text-gray-900 text-lg pr-8">{faq.question}</span>
        <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div 
        className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <p className="text-gray-500 leading-relaxed">{faq.answer}</p>
      </div>
    </div>
  );
};

// --- Main Page Component ---

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0); // First FAQ open by default
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zer0Friction',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://www.zer0friction.in/',
    description:
      'Uptime monitoring for websites, APIs, SSL, DNS, incidents, deploy tracking, and status pages.',
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        name: 'Trial',
      },
      {
        '@type': 'Offer',
        price: '149',
        priceCurrency: 'INR',
        name: 'Lite',
      },
      {
        '@type': 'Offer',
        price: '499',
        priceCurrency: 'INR',
        name: 'Pro',
      },
    ],
    provider: {
      '@type': 'Organization',
      name: 'Zer0Friction',
      url: 'https://www.zer0friction.in/',
      email: 'yug@zer0friction.in',
    },
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-primary-100 selection:text-primary-900 overflow-x-hidden">
      <PageMeta
        title="Zer0Friction | Uptime Monitoring for Websites, APIs, SSL, DNS, and Status Pages"
        description="Monitor websites, APIs, SSL, DNS, incidents, status pages, and deploy health with Zer0Friction's focused uptime platform."
        canonicalPath="/"
      />
      <SeoJsonLd id="landing-faq" data={faqSchema} />
      <SeoJsonLd id="landing-product" data={productSchema} />
      
      {/* Navigation Bar */}
      <nav className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-gray-900" />
            <span className="text-xl font-bold tracking-tight">Zer0Friction</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#how-to" className="hover:text-gray-900 transition-colors">How it Works</a>
            <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/login" className="text-gray-600 hover:text-gray-900 transition-colors">Sign In</Link>
            <Link to="/register" className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* 1. Hero Section */}
        <section className="relative pt-40 pb-20 md:pt-48 md:pb-32 px-6">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-gray-600 blur-[120px] rounded-full mix-blend-multiply" />
          </div>

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-8 leading-[1.1]">
              Stop letting your users <br className="hidden md:block" />
              <span className="text-gray-400">find your API outages.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-500 mb-10 max-w-3xl mx-auto leading-relaxed">
              Zer0Friction provides real-time API monitoring, millisecond-precise latency tracking, and instant alerts the second your endpoints degrade.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/20 hover:-translate-y-0.5">
                Start 14-Day Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-8 py-4 rounded-xl text-lg font-medium hover:bg-gray-50 transition-colors shadow-sm">
                <MonitorPlay className="w-5 h-5 text-gray-400" />
                View Demo Tour
              </button>
            </div>
            <p className="mt-8 text-sm text-gray-400 font-medium">No credit card required • Connect in 2 minutes</p>
          </div>
        </section>

        {/* 2. Problem Section */}
        <section className="py-24 bg-gray-50 border-y border-gray-100 px-6 overflow-hidden relative">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 tracking-tight">The silent killer of modern SaaS</h2>
            <div className="grid md:grid-cols-3 gap-8 text-left">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                  <Activity className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">APIs Fail Silently</h3>
                <p className="text-gray-500 leading-relaxed">Services degrade quietly. A 500 error on a crucial webhook won't trigger standard frontend analytics until it's too late.</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-6">
                  <Globe className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Users Notice First</h3>
                <p className="text-gray-500 leading-relaxed">Finding out your platform is broken via angry Twitter threads or support tickets destroys brand trust permanently.</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                  <Activity className="w-6 h-6 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Revenue Loss</h3>
                <p className="text-gray-500 leading-relaxed">Every minute your payment or authentication API is unreachable actively burns through your monthly recurring revenue.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Solution Section */}
        <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight leading-tight">
                  Know exactly when things break. Instantly.
                </h2>
                <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                  Zer0Friction continuously polls your infrastructure globally. When an endpoint drops or latency spikes, our engine dispatches critical notifications directly to your engineering team's Slack and email.
                </p>
                <ul className="space-y-5">
                  {[
                    'Sub-second polling intervals across global edges.',
                    'Direct Resend email integrations and Slack webhook support.',
                    'Fell-swoop setup. Point us at a URL, and we handle the rest.'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-green-500 mr-3 shrink-0" />
                      <span className="text-gray-700 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 bg-gray-100 rounded-[2.5rem] transform rotate-2 scale-105" />
                <div className="relative bg-white border border-gray-200 rounded-[2rem] shadow-2xl overflow-hidden p-2">
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl overflow-hidden h-full">
                    <div className="h-12 border-b border-gray-200 bg-white/50 flex items-center px-6 gap-2">
                       <div className="flex gap-1.5 hover:opacity-80 transition-opacity">
                         <div className="w-3 h-3 rounded-full bg-red-400" />
                         <div className="w-3 h-3 rounded-full bg-yellow-400" />
                         <div className="w-3 h-3 rounded-full bg-green-400" />
                       </div>
                    </div>
                    <div className="p-8 space-y-4">
                      <div className="flex items-center justify-between p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
                        <div>
                          <div className="font-bold text-gray-900">Production Auth API</div>
                          <div className="text-sm font-mono text-gray-500 mt-1">POST /oauth</div>
                        </div>
                        <span className="bg-green-100 text-green-700 border border-green-200 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider">UP</span>
                      </div>
                      <div className="flex items-center justify-between p-5 bg-red-50 border border-red-200 shadow-sm rounded-2xl">
                        <div>
                          <div className="font-bold text-gray-900">Billing Webhook Target</div>
                          <div className="text-sm font-mono text-red-400 mt-1">POST /webhooks/stripe</div>
                        </div>
                        <span className="bg-red-500 text-white border border-red-600 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider animate-pulse shadow-sm shadow-red-500/20">DOWN</span>
                      </div>
                      
                      <div className="h-28 mt-8 flex items-end gap-1.5 px-2 opacity-80">
                        {[40, 50, 30, 20, 60, 45, 60, 80, 100, 20, 35, 40].map((h, i) => (
                          <div key={i} className={`flex-1 rounded-t-sm transition-all duration-500 ${h > 75 ? 'bg-red-400' : 'bg-gray-800'}`} style={{ height: `${h}%` }}></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Features Grid */}
        <section id="features" className="py-24 bg-gray-900 text-white px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">Enterprise-grade toolkit</h2>
              <p className="text-gray-400 text-lg leading-relaxed">Everything you need to ensure 99.999% uptime, natively built inside a single platform.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: ShieldCheck, title: 'API Monitoring', desc: 'Continuous HTTP/HTTPS checks supporting custom payloads, headers, and advanced TLS validations.' },
                { icon: Bell, title: 'Smart Alerting', desc: 'Intelligent configurable debounce logic. Get notified immediately when it matters, completely avoiding alert spam.' },
                { icon: Clock, title: 'Latency Tracking', desc: 'Monitor response time degradation natively. Catch memory leaks before the server entirely crashes.' },
                { icon: Key, title: 'Secure API Keys', desc: 'Generate multi-tenant cryptographic keys to manage your infrastructure invisibly via CI/CD pipelines.' },
              ].map((f, i) => (
                <div key={i} className="p-8 rounded-3xl bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800 transition-colors">
                  <div className="bg-gray-800 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                     <f.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. A Message From The Founder */}
        <section className="py-24 px-6 bg-white overflow-hidden">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-50 border border-gray-100 rounded-[2rem] p-10 md:p-16 relative shadow-sm">
               {/* Decorative Quote Mark */}
               <div className="absolute top-10 left-10 text-gray-200/50 pointer-events-none">
                 <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 32 32">
                   <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H6c0-1.1.9-2 2-2h2V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-8c0-1.1.9-2 2-2h2V8z" />
                 </svg>
               </div>
               
               <div className="relative z-10">
                 <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-8">A Message from the Founder</h2>
                 <blockquote className="text-2xl md:text-3xl font-medium text-gray-900 leading-tight mb-10">
                   "I built Zer0Friction because I was tired of discovering my API failures through angry user complaints instead of real-time server alerts. <br/><br/>
                   I specifically wanted a deeply resilient system that natively catches issues before they actually impact downstream users."
                 </blockquote>
                 
                 <div className="flex items-center justify-between border-t border-gray-200 pt-8">
                   <div>
                     <div className="font-bold text-gray-900 text-lg">Yug Arora</div>
                     <div className="text-gray-500 font-medium">Founder & Backend Engineer</div>
                   </div>
                   <a 
                     href="https://github.com/yug005" 
                     target="_blank" 
                     rel="noreferrer" 
                     className="bg-gray-100 text-gray-800 p-3 rounded-xl hover:bg-gray-200 transition-colors"
                     title="View Yug's GitHub"
                   >
                     <Github className="w-6 h-6" />
                   </a>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* 6. Pricing Preview */}
        <section id="pricing" className="py-32 px-6 bg-gray-50 border-t border-gray-100">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">Fair pricing that scales with you</h2>
            <p className="text-lg text-gray-500 mb-16 max-w-2xl mx-auto leading-relaxed">Simple INR pricing with clear monitor, API-key, and check-interval limits so teams always know when they need to upgrade.</p>
            
            <div className="grid gap-8 text-left md:grid-cols-2 xl:grid-cols-4">
              {LANDING_PLANS.map((plan) => (
                <div key={plan.name} className={`bg-white rounded-[2rem] p-10 border transition-all hover:-translate-y-1 ${plan.popular ? 'border-gray-900 shadow-2xl shadow-gray-900/10 ring-2 ring-gray-900 relative' : 'border-gray-200 shadow-sm'}`}>
                  {plan.popular && <div className="absolute top-0 right-10 -mt-3"><span className="bg-gray-900 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">Most Popular</span></div>}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="my-6">
                    <div className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">{plan.currency}</div>
                    <div className="mt-2 flex items-baseline">
                      <span className="text-5xl font-extrabold text-gray-900 tracking-tight">{plan.price}</span>
                      <span className="text-gray-500 ml-2 font-medium">/mo</span>
                    </div>
                  </div>
                  <ul className="mb-10 space-y-4">
                     <li className="flex items-center text-gray-700 font-medium">
                       <CheckCircle className="w-5 h-5 text-gray-900 mr-4 shrink-0" /> {plan.monitorLimit}
                     </li>
                     <li className="flex items-center text-gray-600">
                       <CheckCircle className="w-5 h-5 text-gray-900 mr-4 shrink-0" /> {plan.apiKeyLimit}
                     </li>
                     <li className="flex items-center text-gray-600">
                       <CheckCircle className="w-5 h-5 text-gray-900 mr-4 shrink-0" /> {plan.interval}
                     </li>
                  </ul>
                  <Link to="/register" className={`flex justify-center items-center w-full py-4 rounded-xl font-bold transition-colors ${plan.popular ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white text-gray-900 hover:bg-gray-50 border-2 border-gray-200'}`}>
                    {plan.cta}
                  </Link>
                </div>
              ))}
              <EnterpriseContactForm />
            </div>
          </div>
        </section>

        {/* 6.5 Interactive "How it Works" Section */}
        <section id="how-to" className="py-32 px-6 bg-white overflow-hidden">
           <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div className="space-y-10 order-2 lg:order-1">
                 <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">Master the platform</div>
                 <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">Zero configuration. <br/><span className="text-indigo-600 underline decoration-indigo-100 decoration-8 underline-offset-8">Infinite control.</span></h2>
                 <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-lg">We designed Zer0Friction to be so simple a junior can deploy it, yet so powerful a senior architect would trust it with their entire API stack.</p>
                 
                 <div className="space-y-6 pt-4">
                    {[
                      { icon: Zap, title: "1. Drop your URL", desc: "No SDKs required. Just give us your API or UI endpoint and we handle the polling logic." },
                      { icon: Bell, title: "2. Route Alerts", desc: "Choose your favorite channel (Slack, Email, Discord) and set your downtime thresholds." },
                      { icon: Activity, title: "3. Monitor Health", desc: "Watch real-time latency graphs, uptime percentages, and global regional performance." }
                    ].map((step, idx) => (
                      <div key={idx} className="flex gap-4 group">
                         <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-all">
                            <step.icon className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                         </div>
                         <div>
                            <h4 className="font-bold text-slate-900 text-lg mb-1">{step.title}</h4>
                            <p className="text-slate-500 font-medium text-sm leading-relaxed">{step.desc}</p>
                         </div>
                      </div>
                    ))}
                 </div>

                 <div className="pt-8">
                    <Link to="/how-to-use" className="inline-flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all hover:translate-x-1 group">
                       Explore Detailed User Manual <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                 </div>
              </div>

              <div className="order-1 lg:order-2 relative">
                 <div className="absolute -inset-10 bg-indigo-600 opacity-5 blur-[120px] rounded-full scale-150" />
                 <div className="relative bg-slate-900 rounded-[3rem] p-3 shadow-2xl overflow-hidden border border-slate-700 shadow-indigo-600/10">
                    <div className="bg-slate-800/80 rounded-[2.5rem] p-12 text-center space-y-8 animate-pulse">
                       <HelpCircle className="w-24 h-24 text-slate-700 mx-auto" />
                       <h3 className="text-white font-black text-2xl tracking-tight leading-snug italic">
                        "Your entire monitoring infrastructure can be live in less than 120 seconds."
                       </h3>
                       <div className="pt-4 flex justify-center gap-3">
                          <div className="w-3 h-3 bg-white/20 rounded-full" />
                          <div className="w-12 h-3 bg-white/40 rounded-full" />
                          <div className="w-3 h-3 bg-white/20 rounded-full" />
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* 7. FAQs */}
        <section id="faq" className="py-24 px-6 bg-white border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight text-center">Frequently asked questions</h2>
            <p className="text-center text-gray-500 mb-12">Don't see your question? Shoot us an email.</p>
            
            <div className="space-y-4">
              {FAQS.map((faq, index) => (
                <FaqAccordion 
                  key={index}
                  faq={faq} 
                  isOpen={openFaq === index} 
                  toggle={() => setOpenFaq(openFaq === index ? null : index)} 
                />
              ))}
            </div>
          </div>
        </section>

        {/* 8. Final CTA */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto bg-gray-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white opacity-5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">Ready to stop guessing?</h2>
              <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">Start monitoring your backend infrastructure natively in minutes. Deploy entirely with confidence.</p>
              <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-2xl text-lg font-bold hover:bg-gray-100 transition-all shadow-xl hover:-translate-y-1">
                Start Your Trial
                <Zap className="w-5 h-5 text-gray-900 fill-gray-900" />
              </Link>
              <p className="text-gray-500 mt-6 text-sm font-medium tracking-wide uppercase">14-Day Trial • No Credit Card</p>
            </div>
          </div>
        </section>

      </main>

      {/* 9. Comprehensive SaaS Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 pt-20 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-6 h-6 text-gray-900" />
                <span className="text-xl font-bold tracking-tight text-gray-900">Zer0Friction</span>
              </div>
              <p className="text-gray-500 mb-8 max-w-xs leading-relaxed">
                Platform-independent uptime monitoring resolving massive infrastructure complexity natively for scale.
              </p>
              <div className="flex gap-4">
                <a href="https://github.com/yug005" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-900 transition-colors">
                  <span className="sr-only">GitHub</span>
                  <Github className="w-5 h-5" />
                </a>
                <a href="mailto:yug@zer0friction.in" className="text-gray-400 hover:text-gray-900 transition-colors">
                  <span className="sr-only">Contact</span>
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-900 mb-6 uppercase tracking-wider text-xs">Product</h3>
              <ul className="space-y-4 text-gray-500 font-medium text-sm">
                <li><a href="#features" className="hover:text-gray-900 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing Options</a></li>
                <li><Link to="/login" className="hover:text-gray-900 transition-colors">Dashboard Login</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-6 uppercase tracking-wider text-xs">Company</h3>
              <ul className="space-y-4 text-gray-500 font-medium text-sm">
                <li><a href="https://github.com/yug005" target="_blank" rel="noreferrer" className="hover:text-gray-900 transition-colors">About the Founder</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">System Status</a></li>
                <li><a href="mailto:yug@zer0friction.in" className="hover:text-gray-900 transition-colors">Contact Support</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-6 uppercase tracking-wider text-xs">Legal</h3>
              <ul className="space-y-4 text-gray-500 font-medium text-sm">
                <li><Link to="/terms" target="_blank" className="hover:text-gray-900 transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" target="_blank" className="hover:text-gray-900 transition-colors">Privacy Policy</Link></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">14-Day Refund Guarantee</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm font-medium text-gray-400">
              © {new Date().getFullYear()} Zer0Friction. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
              <Globe className="w-4 h-4" />
              India (Remote-first)
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
