# 🚀 ComplianceBot - GST & TDS Automation SaaS

🟢 **Live Demo:** [Coming Soon - Deploying to Vercel/Render]

ComplianceBot is an enterprise-grade SaaS platform designed to automate tax compliance for Indian SMEs. It simplifies the tracking, calculation, and filing of GST (Goods and Services Tax) and TDS (Tax Deducted at Source), saving businesses hundreds of hours in manual accounting.

---

## ✨ Key Features

### 📊 Tax Automation
- **GST Module:** Automatically tracks B2B/B2C invoices and generates **GSTR-1** (Sales) and **GSTR-3B** (Liability) JSON/PDF summaries.
- **TDS Module:** Tracks vendor payments, calculates category-wise deductions (10%, 15%, etc.), and generates **Form 26Q** PDF summaries.
- **Bulk Uploads:** Drag-and-drop CSV imports with downloadable templates for rapid data entry.

### 🏢 Multi-Tenancy & Collaboration
- **Workspace Management:** Manage multiple companies/GSTINs from a single account.
- **Role-Based Access Control (RBAC):** Invite team members as `OWNER`, `ADMIN`, `EDITOR`, or `VIEWER`.

### 🔐 Enterprise Security
- **Two-Factor Authentication (2FA):** TOTP integration (Google Authenticator) with 8-character emergency backup codes.
- **Session Management:** 15-minute expiring JWT access tokens with 30-day silent refresh rotation.
- **Data Privacy:** GDPR-compliant cascading account deletion.

### 📈 Dashboards & Alerts
- **Financial Analytics:** Real-time Bar charts tracking Revenue vs. GST vs. TDS.
- **Smart Calendar:** Auto-generating compliance deadlines (e.g., GSTR-3B due on the 20th).
- **Email Reminders:** Automated SMTP notifications for upcoming tax deadlines and team invites.

---

## 🛠️ Tech Stack

**Frontend:**
- React 18 (with TypeScript)
- Vite
- Redux Toolkit (State Management)
- Tailwind CSS (Styling)
- Recharts (Data Visualization)
- html2pdf.js (Report Generation)

**Backend:**
- Node.js & Express.js (with TypeScript)
- Prisma ORM
- PostgreSQL
- JSON Web Tokens (JWT) & bcryptjs
- Speakeasy (2FA) & Nodemailer (Emails)

---

## ⚙️ Environment Variables

To run this project, you will need to add the following environment variables to your `backend/.env` file:

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Your PostgreSQL connection string |
| `PORT` | Backend port (default: 5000) |
| `NODE_ENV` | `development` or `production` |
| `FRONTEND_URL` | `http://localhost:5173` (or your live Vercel URL) |
| `JWT_SECRET` | A secure random 64-character string |
| `SMTP_HOST` | e.g., `smtp.gmail.com` |
| `SMTP_PORT` | e.g., `587` |
| `SMTP_SECURE` | `false` (for TLS) |
| `SMTP_USER` | Your email address |
| `SMTP_PASS` | Your App Password |
| `GOOGLE_CLIENT_ID` | OAuth Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret from Google |
| `GITHUB_CLIENT_ID` | OAuth Client ID from GitHub |
| `GITHUB_CLIENT_SECRET` | OAuth Client Secret from GitHub |

---

## 💻 Local Setup Instructions

**1. Clone the repository**
```bash
git clone https://github.com/your-username/compliance-automation.git
cd compliance-automation
```

**2. Install dependencies**
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

**3. Setup the Database**
Ensure PostgreSQL is running locally, then push the Prisma schema:
```bash
cd backend
npx prisma db push
npx prisma generate
```

**4. Start the Application**
Open two terminals:
```bash
# Terminal 1 (Backend)
cd backend
npm run dev

# Terminal 2 (Frontend)
cd frontend
npm run dev
```
