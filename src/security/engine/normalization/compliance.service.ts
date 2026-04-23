import { Injectable } from '@nestjs/common';

/**
 * Compliance mapping service — maps security findings to SOC2 / ISO 27001 controls.
 *
 * This provides automatic compliance reporting without manual mapping.
 * Each finding category is associated with relevant control frameworks.
 */

export interface ComplianceControl {
  framework: 'SOC2' | 'ISO27001' | 'OWASP_TOP10' | 'PCI_DSS';
  controlId: string;
  controlTitle: string;
  description: string;
}

export interface ComplianceMapping {
  category: string;
  controls: ComplianceControl[];
}

export interface ComplianceScore {
  framework: string;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  partialControls: number;
  score: number; // 0-100
  controlDetails: Array<{
    controlId: string;
    controlTitle: string;
    status: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED';
    relatedFindings: number;
    severity: string;
  }>;
}

// ─── Control Mapping Database ────────────────────────────────────

const CATEGORY_TO_CONTROLS: Record<string, ComplianceControl[]> = {
  AUTH_POSTURE: [
    { framework: 'SOC2', controlId: 'CC6.1', controlTitle: 'Logical Access Security', description: 'Logical access security over information assets.' },
    { framework: 'SOC2', controlId: 'CC6.3', controlTitle: 'Role-Based Access', description: 'Role-based access and least privilege enforcement.' },
    { framework: 'ISO27001', controlId: 'A.9.2.3', controlTitle: 'Management of Privileged Access Rights', description: 'Allocation and use of privileged access rights shall be restricted and controlled.' },
    { framework: 'ISO27001', controlId: 'A.9.4.2', controlTitle: 'Secure Log-on Procedures', description: 'Access shall be controlled by a secure log-on procedure.' },
    { framework: 'OWASP_TOP10', controlId: 'A07:2021', controlTitle: 'Identification and Authentication Failures', description: 'Confirmation of identity, authentication, and session management.' },
    { framework: 'PCI_DSS', controlId: '8.3', controlTitle: 'Multi-Factor Authentication', description: 'Secure all individual non-console administrative access and remote access.' },
  ],
  BROKEN_ACCESS_CONTROL: [
    { framework: 'SOC2', controlId: 'CC6.1', controlTitle: 'Logical Access Security', description: 'Logical access security over information assets.' },
    { framework: 'SOC2', controlId: 'CC6.2', controlTitle: 'Access Provisioning', description: 'Prior to issuing credentials, registration and authorization processes are in place.' },
    { framework: 'ISO27001', controlId: 'A.9.1.2', controlTitle: 'Access to Networks and Network Services', description: 'Users shall only be provided with access they have been specifically authorized to use.' },
    { framework: 'OWASP_TOP10', controlId: 'A01:2021', controlTitle: 'Broken Access Control', description: 'Restrictions on what authenticated users are allowed to do.' },
    { framework: 'PCI_DSS', controlId: '7.1', controlTitle: 'Limit Access', description: 'Limit access to system components and cardholder data.' },
  ],
  INJECTION_DETECTION: [
    { framework: 'SOC2', controlId: 'CC7.1', controlTitle: 'Vulnerability Management', description: 'Detect and address security vulnerabilities.' },
    { framework: 'ISO27001', controlId: 'A.14.2.5', controlTitle: 'Secure System Engineering', description: 'Principles for engineering secure systems shall be established and applied.' },
    { framework: 'OWASP_TOP10', controlId: 'A03:2021', controlTitle: 'Injection', description: 'Prevention of SQL, NoSQL, OS, and LDAP injection.' },
    { framework: 'PCI_DSS', controlId: '6.5.1', controlTitle: 'Injection Flaws', description: 'Address common coding vulnerabilities in software development processes.' },
  ],
  SECURITY_MISCONFIGURATION: [
    { framework: 'SOC2', controlId: 'CC7.1', controlTitle: 'Vulnerability Management', description: 'Detect and address security vulnerabilities.' },
    { framework: 'SOC2', controlId: 'CC8.1', controlTitle: 'Change Management', description: 'Changes to infrastructure and software are authorized, tested, approved, implemented, and documented.' },
    { framework: 'ISO27001', controlId: 'A.12.6.1', controlTitle: 'Management of Technical Vulnerabilities', description: 'Information about technical vulnerabilities shall be obtained and appropriate measures taken.' },
    { framework: 'OWASP_TOP10', controlId: 'A05:2021', controlTitle: 'Security Misconfiguration', description: 'Missing hardening, improperly configured permissions, unnecessary features enabled.' },
  ],
  SENSITIVE_DATA_EXPOSURE: [
    { framework: 'SOC2', controlId: 'CC6.7', controlTitle: 'Data-in-Transit Protection', description: 'Restrict the transmission of data to authorized channels.' },
    { framework: 'SOC2', controlId: 'CC6.8', controlTitle: 'Data Loss Prevention', description: 'Controls to prevent data loss.' },
    { framework: 'ISO27001', controlId: 'A.10.1.1', controlTitle: 'Cryptographic Controls', description: 'A policy on the use of cryptographic controls for protection of information.' },
    { framework: 'ISO27001', controlId: 'A.18.1.3', controlTitle: 'Protection of Records', description: 'Records shall be protected from loss, destruction, falsification.' },
    { framework: 'OWASP_TOP10', controlId: 'A02:2021', controlTitle: 'Cryptographic Failures', description: 'Failures related to cryptography which often lead to sensitive data exposure.' },
    { framework: 'PCI_DSS', controlId: '3.4', controlTitle: 'Render PAN Unreadable', description: 'Render PAN unreadable anywhere it is stored.' },
  ],
  CORS_MISCONFIGURATION: [
    { framework: 'SOC2', controlId: 'CC6.1', controlTitle: 'Logical Access Security', description: 'Logical access security over information assets.' },
    { framework: 'ISO27001', controlId: 'A.13.1.1', controlTitle: 'Network Controls', description: 'Networks shall be managed and controlled to protect information.' },
    { framework: 'OWASP_TOP10', controlId: 'A05:2021', controlTitle: 'Security Misconfiguration', description: 'Missing hardening, improperly configured permissions.' },
  ],
  HEADER_SECURITY: [
    { framework: 'SOC2', controlId: 'CC7.1', controlTitle: 'Vulnerability Management', description: 'Detect and address security vulnerabilities.' },
    { framework: 'ISO27001', controlId: 'A.14.1.2', controlTitle: 'Securing Application Services', description: 'Information on public networks shall be protected from fraudulent activity.' },
    { framework: 'OWASP_TOP10', controlId: 'A05:2021', controlTitle: 'Security Misconfiguration', description: 'Missing hardening, improperly configured permissions.' },
  ],
  TLS_POSTURE: [
    { framework: 'SOC2', controlId: 'CC6.7', controlTitle: 'Data-in-Transit Protection', description: 'Restrict the transmission of data to authorized channels.' },
    { framework: 'ISO27001', controlId: 'A.10.1.1', controlTitle: 'Cryptographic Controls', description: 'A policy on the use of cryptographic controls for protection of information.' },
    { framework: 'ISO27001', controlId: 'A.14.1.2', controlTitle: 'Securing Application Services', description: 'Information on public networks shall be protected from fraudulent activity.' },
    { framework: 'PCI_DSS', controlId: '4.1', controlTitle: 'Strong Cryptography', description: 'Use strong cryptography and security protocols to safeguard sensitive data during transmission.' },
  ],
  MASS_ASSIGNMENT: [
    { framework: 'SOC2', controlId: 'CC6.1', controlTitle: 'Logical Access Security', description: 'Logical access security over information assets.' },
    { framework: 'ISO27001', controlId: 'A.14.2.5', controlTitle: 'Secure System Engineering', description: 'Principles for engineering secure systems.' },
    { framework: 'OWASP_TOP10', controlId: 'A04:2021', controlTitle: 'Insecure Design', description: 'Missing or ineffective control design.' },
  ],
  RESOURCE_ABUSE: [
    { framework: 'SOC2', controlId: 'CC7.2', controlTitle: 'Monitoring Activities', description: 'Security events are monitored and analyzed.' },
    { framework: 'ISO27001', controlId: 'A.12.1.3', controlTitle: 'Capacity Management', description: 'The use of resources shall be monitored and tuned.' },
    { framework: 'OWASP_TOP10', controlId: 'A04:2021', controlTitle: 'Insecure Design', description: 'Missing or ineffective control design.' },
  ],
  DEBUG_EXPOSURE: [
    { framework: 'SOC2', controlId: 'CC6.8', controlTitle: 'Data Loss Prevention', description: 'Controls to prevent data loss.' },
    { framework: 'ISO27001', controlId: 'A.12.6.1', controlTitle: 'Management of Technical Vulnerabilities', description: 'Technical vulnerabilities shall be managed.' },
    { framework: 'OWASP_TOP10', controlId: 'A05:2021', controlTitle: 'Security Misconfiguration', description: 'Missing hardening, unnecessary features enabled.' },
  ],
  TECH_DISCLOSURE: [
    { framework: 'SOC2', controlId: 'CC7.1', controlTitle: 'Vulnerability Management', description: 'Detect and address security vulnerabilities.' },
    { framework: 'ISO27001', controlId: 'A.12.6.1', controlTitle: 'Management of Technical Vulnerabilities', description: 'Technical vulnerabilities shall be managed.' },
  ],
  SSRF_POSTURE: [
    { framework: 'SOC2', controlId: 'CC6.6', controlTitle: 'System Boundaries', description: 'Restrict system access to authorized users and prevent unauthorized access.' },
    { framework: 'ISO27001', controlId: 'A.13.1.1', controlTitle: 'Network Controls', description: 'Networks shall be managed and controlled to protect information.' },
    { framework: 'OWASP_TOP10', controlId: 'A10:2021', controlTitle: 'Server-Side Request Forgery (SSRF)', description: 'Prevention of SSRF flaws.' },
  ],
  BUSINESS_LOGIC: [
    { framework: 'SOC2', controlId: 'CC6.1', controlTitle: 'Logical Access Security', description: 'Logical access security over information assets.' },
    { framework: 'ISO27001', controlId: 'A.14.2.5', controlTitle: 'Secure System Engineering', description: 'Principles for engineering secure systems.' },
    { framework: 'OWASP_TOP10', controlId: 'A04:2021', controlTitle: 'Insecure Design', description: 'Missing or ineffective control design in business logic workflows.' },
    { framework: 'PCI_DSS', controlId: '6.5', controlTitle: 'Application Development Best Practices', description: 'Application development follows secure coding practices.' },
  ],
  DOM_XSS: [
    { framework: 'SOC2', controlId: 'CC7.1', controlTitle: 'Vulnerability Management', description: 'Detect and address security vulnerabilities.' },
    { framework: 'ISO27001', controlId: 'A.14.2.5', controlTitle: 'Secure System Engineering', description: 'Principles for engineering secure systems.' },
    { framework: 'OWASP_TOP10', controlId: 'A03:2021', controlTitle: 'Injection', description: 'DOM-based cross-site scripting via client-side injection.' },
    { framework: 'PCI_DSS', controlId: '6.5.7', controlTitle: 'Cross-Site Scripting', description: 'Address XSS vulnerabilities in software development.' },
  ],
  SECRET_EXPOSURE: [
    { framework: 'SOC2', controlId: 'CC6.8', controlTitle: 'Data Loss Prevention', description: 'Controls to prevent data loss.' },
    { framework: 'ISO27001', controlId: 'A.9.2.4', controlTitle: 'Management of Secret Authentication', description: 'Allocation of secret authentication information shall be controlled.' },
    { framework: 'OWASP_TOP10', controlId: 'A02:2021', controlTitle: 'Cryptographic Failures', description: 'Exposed secrets and credentials due to improper handling.' },
    { framework: 'PCI_DSS', controlId: '3.4', controlTitle: 'Render PAN Unreadable', description: 'Protect stored secrets and sensitive authentication data.' },
  ],
  CLOUD_MISCONFIG: [
    { framework: 'SOC2', controlId: 'CC6.6', controlTitle: 'System Boundaries', description: 'Restrict system access to authorized users.' },
    { framework: 'ISO27001', controlId: 'A.13.1.1', controlTitle: 'Network Controls', description: 'Networks shall be managed and controlled.' },
    { framework: 'OWASP_TOP10', controlId: 'A05:2021', controlTitle: 'Security Misconfiguration', description: 'Cloud infrastructure misconfiguration and exposed services.' },
  ],
  API_ABUSE: [
    { framework: 'SOC2', controlId: 'CC6.1', controlTitle: 'Logical Access Security', description: 'Logical access security over information assets.' },
    { framework: 'ISO27001', controlId: 'A.14.2.5', controlTitle: 'Secure System Engineering', description: 'Principles for engineering secure systems.' },
    { framework: 'OWASP_TOP10', controlId: 'A01:2021', controlTitle: 'Broken Access Control', description: 'API property-level access control failures.' },
  ],
  PERFORMANCE_RISK: [
    { framework: 'SOC2', controlId: 'CC7.2', controlTitle: 'Monitoring Activities', description: 'Security events are monitored and analyzed.' },
    { framework: 'ISO27001', controlId: 'A.12.1.3', controlTitle: 'Capacity Management', description: 'The use of resources shall be monitored.' },
    { framework: 'OWASP_TOP10', controlId: 'A04:2021', controlTitle: 'Insecure Design', description: 'Performance vulnerabilities enabling resource abuse.' },
  ],
};

@Injectable()
export class ComplianceService {
  /**
   * Get all compliance mappings for a set of finding categories.
   */
  getMappings(categories: string[]): ComplianceMapping[] {
    const result: ComplianceMapping[] = [];

    for (const category of categories) {
      const controls = CATEGORY_TO_CONTROLS[category];
      if (controls) {
        result.push({ category, controls });
      }
    }

    return result;
  }

  /**
   * Calculate compliance scores across all frameworks.
   */
  calculateComplianceScores(
    findings: Array<{ category: string; severity: string; falsePositive: boolean }>,
  ): ComplianceScore[] {
    const activeFindings = findings.filter(f => !f.falsePositive);
    const failedCategories = new Set(activeFindings.map(f => f.category));
    const severityByCategory: Record<string, string> = {};
    for (const f of activeFindings) {
      const current = severityByCategory[f.category];
      if (!current || SEVERITY_RANK[f.severity] > (SEVERITY_RANK[current] ?? 0)) {
        severityByCategory[f.category] = f.severity;
      }
    }

    const frameworks = ['SOC2', 'ISO27001', 'OWASP_TOP10', 'PCI_DSS'] as const;
    const result: ComplianceScore[] = [];

    for (const framework of frameworks) {
      const controlMap = new Map<string, {
        controlId: string;
        controlTitle: string;
        status: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED';
        relatedFindings: number;
        severity: string;
      }>();

      // Enumerate all controls for this framework
      for (const [category, controls] of Object.entries(CATEGORY_TO_CONTROLS)) {
        for (const control of controls) {
          if (control.framework !== framework) continue;

          const existing = controlMap.get(control.controlId);
          const categoryFailed = failedCategories.has(category);
          const findingCount = activeFindings.filter(f => f.category === category).length;
          const maxSeverity = severityByCategory[category] ?? 'INFORMATIONAL';

          if (!existing) {
            controlMap.set(control.controlId, {
              controlId: control.controlId,
              controlTitle: control.controlTitle,
              status: categoryFailed
                ? (SEVERITY_RANK[maxSeverity] >= 3 ? 'FAIL' : 'PARTIAL')
                : 'PASS',
              relatedFindings: findingCount,
              severity: maxSeverity,
            });
          } else {
            // Merge — worst status wins
            if (categoryFailed) {
              if (SEVERITY_RANK[maxSeverity] >= 3) {
                existing.status = 'FAIL';
              } else if (existing.status === 'PASS') {
                existing.status = 'PARTIAL';
              }
              existing.relatedFindings += findingCount;
              if (SEVERITY_RANK[maxSeverity] > (SEVERITY_RANK[existing.severity] ?? 0)) {
                existing.severity = maxSeverity;
              }
            }
          }
        }
      }

      const controlDetails = Array.from(controlMap.values());
      const passed = controlDetails.filter(c => c.status === 'PASS').length;
      const failed = controlDetails.filter(c => c.status === 'FAIL').length;
      const partial = controlDetails.filter(c => c.status === 'PARTIAL').length;
      const total = controlDetails.length;

      result.push({
        framework,
        totalControls: total,
        passedControls: passed,
        failedControls: failed,
        partialControls: partial,
        score: total > 0 ? Math.round(((passed + partial * 0.5) / total) * 100) : 100,
        controlDetails: controlDetails.sort((a, b) => {
          const statusOrder = { FAIL: 0, PARTIAL: 1, PASS: 2, NOT_TESTED: 3 };
          return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
        }),
      });
    }

    return result;
  }
}

const SEVERITY_RANK: Record<string, number> = {
  INFORMATIONAL: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};
