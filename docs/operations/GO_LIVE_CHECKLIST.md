# 🚀 Zer0Friction: Go-Live Security & Feature Checklist (2026 Edition)

This document outlines the critical missing features and security vulnerabilities identified in the current Zer0Friction codebase that are essential for a production launch in 2026.

---

## 🛡️ 1. Security & Vulnerabilities (High Priority)

| Vulnerability / Risk | Severity | Proposed Solution |
| :--- | :--- | :--- |
| **Lack of MFA (Multi-Factor Auth)** | **Critical** | Implement TOTP (Google Authenticator) or WebAuthn (TouchID/FaceID). In 2026, single-password auth is insufficient for infrastructure tools. |
| **Broad API Key Scoping** | **High** | Currently, API keys have "all-or-nothing" access. Add **Scoped Permissions** (e.g., `read:monitors`, `create:monitors`) to restrict individual keys. |
| **CSRF & Session Fixation** | **Medium** | Ensure the backend uses double-submit cookies or SameSite=Strict for session cookies. Add a CSRF protection middleware to NestJS. |
| **Refresh Token Rotation** | **Medium** | Current tokens are static until expiry. Implement **Token Rotation**: every time a refresh token is used, issue a *new* one and invalidate the old one to prevent replay attacks. |
| **Password Complexity Enforcement** | **Low** | Backend currently accepts anything for local accounts. Add a strict regex in `RegisterDto` (numbers, symbols, uppercase, no common words). |
| **IDOR Check Coverage** | **Low** | While service checks ownership, ensure a central **Guard or Pipe** verifies that a User owns a Resource (e.g., Project/Monitor) before reaching the controller logic. |

---

## ✨ 2. Missing Core Features for 2026 Market

### **A. Advanced Monitoring (Beyond simple HTTP)**
*   **Current State**: Basic HTTP/UP check.
*   **Must Have**: 
    *   **SSL/TLS Expiry Tracking**: Alert users when their certificates are about to expire.
    *   **DNS Monitoring**: Check for unauthorized changes to DNS records (A/CNAME).
    *   **Heaver Headers**: Support for more complex authentication (Bearer tokens/Custom Headers) in the monitoring pinger.

### **B. Team & Organization Management**
*   **Current State**: Single user / One account.
*   **Must Have**: 
    *   **RBAC (Role Based Access Control)**: Admin, Editor, Viewer roles within a project.
    *   **Teams/Orgs**: Allowing a company to have 10 developers manage the same set of monitors under one billing account.

### **C. Public Status Pages**
*   **Current State**: Internal dashboard only.
*   **Must Have**: A feature to generate a `status.zer0friction.in/company-name` page so *their* customers can see if the site is up.

### **D. Interactive Incident Management**
*   **Current State**: Basic Alert model.
*   **Must Have**: 
    *   **Acknowledgement Workflow**: A way for a developer to click "Acknowledged" on an alert to stop the notification noise.
    *   **Post-Mortem Log**: A text field to write notes on what caused the downtime.

---

## 📈 3. Platform Longevity & Scalability

-   **Observability (For the Devs)**: Currently, there is no **Sentry** or **Datadog** integration. If the backend crashes, the team won't know unless they check the logs manually.
-   **Rate Limiting Quotas**: Implement tiered rate limiting based on the `SubscriptionPlan` (e.g., Free: 1 api call/sec, Pro: 10/sec).
-   **Log Cleanup Automation**: While we have a cleanup cron, it should be configurable from the UI per-user (e.g., "Keep logs for 30 days").

---

## 🧑‍💻 4. The "Zen" User Experience (UX Analysis)

*What would a developer feel is "missing" during their first 10 minutes of use in 2026?*

| The Gap | The User Perspective | Current Feeling |
| :--- | :--- | :--- |
| **Instant Onboarding** | Need a **"Magic Setup" wizard** to create the first monitor in < 5 seconds. | "Too much setup work." |
| **Root Cause Analysis** | Show a **trace snapshot** (headers/body) of why a request failed. | "It's down, but why?" |
| **Slack/Discord/Telegram** | Alerts where developers actually live. | "Notification isolation." |
| **Regional Validation** | Confirm downtime from **London, Mumbai, and NY** simultaneously. | "False positives wake me up." |
| **Alert Throttling** | Don't send 50 emails for 1 outage. Send 1 for "Down", 1 for "Up". | "Notification fatigue." |
| **Mobile PWA** | A "Big Red Button" to pause monitors from a phone during an emergency. | "Clunky mobile control." |

---

## 🚀 Proposed Immediate Roadmap

1.  **Phase 1 (Security Fix):** Implement MFA and Refresh Token Rotation.
2.  **Phase 3 (Enterprise):** Introduce Team seats and RBAC.
3.  **Phase 2 (UX/Pro-grade):** Build the Public Status Page generator.

---
Prepared by **Antigravity AI**
*Current Date: March 20, 2026*
