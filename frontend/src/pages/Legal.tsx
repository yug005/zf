import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

export function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 py-4 px-6 fixed top-0 inset-x-0 bg-white z-50">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Activity className="w-6 h-6 text-gray-900" />
          <Link to="/" className="font-bold tracking-tight text-gray-900 text-xl hover:opacity-80 transition-opacity">Zer0Friction</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-32 text-gray-600 space-y-8 leading-relaxed">
        <h1 className="text-4xl font-bold text-gray-900 mb-12">Terms of Service</h1>
        <p>Effective Date: {new Date().toLocaleDateString()}</p>
        <h2 className="text-2xl font-bold text-gray-900 pt-8">1. Acceptance of Terms</h2>
        <p>By accessing and using Zer0Friction, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
        <h2 className="text-2xl font-bold text-gray-900 pt-8">2. Description of Service</h2>
        <p>Zer0Friction provides API monitoring, latency tracking, and incident alerting software tailored for complex SaaS architectures.</p>
        <h2 className="text-2xl font-bold text-gray-900 pt-8">3. Communication</h2>
        <p>If you encounter issues or have questions about these Terms, you can contact us securely at <a href="mailto:yug@zer0friction.in" className="text-blue-600 hover:text-blue-800 font-medium">yug@zer0friction.in</a>.</p>
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 py-4 px-6 fixed top-0 inset-x-0 bg-white z-50">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Activity className="w-6 h-6 text-gray-900" />
          <Link to="/" className="font-bold tracking-tight text-gray-900 text-xl hover:opacity-80 transition-opacity">Zer0Friction</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-32 text-gray-600 space-y-8 leading-relaxed">
        <h1 className="text-4xl font-bold text-gray-900 mb-12">Privacy Policy</h1>
        <p>Effective Date: {new Date().toLocaleDateString()}</p>
        <h2 className="text-2xl font-bold text-gray-900 pt-8">1. Information We Collect</h2>
        <p>We strictly collect the necessary information required to monitor your endpoints reliably. This includes your endpoint URLs, ping frequencies, and email addresses utilized specifically for routing alerts.</p>
        <h2 className="text-2xl font-bold text-gray-900 pt-8">2. Use of Information</h2>
        <p>We do not aggregate, sell, or distribute your private infrastructure metrics natively or externally. All monitoring data is securely bound to your tenant configuration exclusively.</p>
        <h2 className="text-2xl font-bold text-gray-900 pt-8">3. Contact Us</h2>
        <p>For questions or requests to purge your infrastructure data, please contact our team immediately at <a href="mailto:yug@zer0friction.in" className="text-blue-600 hover:text-blue-800 font-medium">yug@zer0friction.in</a>.</p>
      </main>
    </div>
  );
}
