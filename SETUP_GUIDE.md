# CertiFlow Developer Onboarding & Setup Guide

Welcome to **CertiFlow**! This comprehensive guide is designed to help new recruits and team members get the entire enterprise certification platform running on their local machines smoothly without encountering common setup pitfalls or port conflicts.

---

## 🛠️ Prerequisites

Before starting, ensure you have the following software installed on your development machine:
1. **Node.js** (v20+ recommended) & **npm**
2. **Docker Desktop** (must be installed and actively running)
3. **Git**
4. **LibreOffice** *(Required for backend DOCX-to-PDF template rendering and conversion)*
   - **Windows**: Install from the official site. Default installation path is `C:\Program Files\LibreOffice\program\soffice.exe`.
   - **macOS**: Install via Homebrew (`brew install --cask libreoffice`) or official installer. Path is `/Applications/LibreOffice.app/Contents/MacOS/soffice` or `soffice`.
   - **Linux**: Install via package manager (`sudo apt install libreoffice`). Path is `soffice`.

---

## 🚀 Step-by-Step Setup Instructions

### Step 1: Clone & Configure Environment Variables (`.env`)
In the root directory of the project, copy the template environment file to create your local `.env`:

```powershell
# Windows PowerShell / macOS / Linux
cp .env.example .env
```

#### 🔑 Why our `.env.example` is configured differently:
We have customized `.env.example` with specific defaults to prevent common setup errors:
- **Database Port `5434`**: Many developers already have PostgreSQL locally installed on port `5432` or `5433`. To prevent **Docker port conflicts**, our `docker-compose.yml` and `.env` map Docker's PostgreSQL container to port **`5434`**.
- **Redis Host `127.0.0.1`**: When running outside Docker in local development, connecting to `redis://redis:6379` fails. We default to `redis://127.0.0.1:6379`.
- **Uploads Directory**: We use relative path `./apps/api/uploads` so Windows and Mac systems don't fail trying to write to root filesystem paths (`/app/uploads`).
- **SMTP Setup**: Fill in your `SMTP_USER` and `SMTP_PASS` (e.g., Gmail App Password) to enable local testing of OTP verification and password reset workflows.

---

### Step 2: Start Docker Containers (Database & Cache)
With Docker Desktop running, spin up the required PostgreSQL and Redis services in the background:

```powershell
docker compose up -d postgres redis
```

> [!TIP]
> You can verify that the containers are running cleanly by checking Docker Desktop's dashboard or running `docker ps`. You should see `certiflow-postgres-1` (mapped to port 5434) and `certiflow-redis-1` (mapped to port 6379).

---

### Step 3: Install Workspace Dependencies & Build Packages
CertiFlow is structured as a modern npm monorepo workspace. Install all dependencies from the root directory:

```powershell
npm install
```

Next, build the core shared TypeScript libraries and API definitions:

```powershell
npm run build --workspace @certiflow/shared; npm run build --workspace @certiflow/api
```

---

### Step 4: Run Database Schema Migrations & Seed Admin
We have created an automated database utility script that executes all PostgreSQL migrations, creates required tables (including `users`, `companies`, `batches`, and `password_resets`), and seeds the default Super Admin account:

```powershell
npm run db:reset --workspace @certiflow/api
```

Once completed, your database is seeded with:
- **Super Admin Email**: `alishad846@gmail.com`
- **Super Admin Password**: `ChangeMe123!`

---

### Step 5: Start the Development Server
Launch the entire stack (Next.js frontend, Express API server, and background BullMQ worker) with a single command:

```powershell
npm run dev
```

- **Web Application (UI)**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)

You can now open [http://localhost:3000](http://localhost:3000) in your browser, click **Get started** or **Create an account** to register your organization, or log in as Super Admin!

---

## ⚠️ Known Setup Issues & Troubleshooting Guide

When recruiting new team members, here are the most common gotchas and how to solve them instantly:

### 1. PostgreSQL Docker Port Conflict (`Bind for 0.0.0.0:5433 failed: port is already allocated`)
- **Cause**: The developer has another PostgreSQL instance or service running on port 5433 or 5432.
- **Solution**: In `docker-compose.yml`, change the port mapping under `postgres:` from `'5434:5432'` to an unused port like `'5444:5432'`. Then update `DATABASE_URL` in `.env` to match: `postgres://postgres:postgres@127.0.0.1:5444/certiflow`.

### 2. Next.js App Router Structure (`apps/web/app/` vs `apps/web/src/app/`)
- **Important Note**: In Next.js App Router, if both `app/` (in root) and `src/app/` exist, Next.js **prioritizes `app/` and ignores `src/app/`**.
- **Rule**: Always create new pages and routes inside **`apps/web/app/`**! Do not place page components in `apps/web/src/app/` as they will not be compiled.

### 3. Client-Side Loading Errors / Accessing via Local Network (`192.168.x.x`)
- **Cause**: Next.js 15 implements strict dev server origin protection against cross-site scripting and DNS rebinding.
- **Solution**: If testing from a mobile device or another laptop across your Wi-Fi/LAN, add your machine's IP address (e.g., `'192.168.1.50'`, `'192.168.1.50:3000'`, `'http://192.168.1.50:3000'`) to the `allowedDevOrigins` array inside `apps/web/next.config.mjs`.

### 4. Webpack HMR Error (`__webpack_require__.n is not a function`)
- **Cause**: Running `npm run build` while `npm run dev` is active overwrites the `.next/` development cache with production artifacts.
- **Solution**: Simply stop your dev server (`Ctrl + C`) and restart `npm run dev` in your terminal. Next.js will automatically regenerate a clean development cache.

### 5. LibreOffice Conversion Error (`soffice not found` during certificate generation)
- **Cause**: The backend API cannot find the LibreOffice executable to render PDF certificates from DOCX templates.
- **Solution**: Verify the `SOFFICE_PATH` variable in your `.env`. On Windows, ensure LibreOffice is installed at `C:\Program Files\LibreOffice\program\soffice.exe` or update `.env` with your custom installation path.

---

## 📁 Repository Architecture Overview
- **`apps/web`**: Next.js 15 frontend application (App Router located in `apps/web/app`).
- **`apps/api`**: Express.js REST API server, PostgreSQL database pool, Nodemailer SMTP service, and BullMQ background queue workers.
- **`packages/shared`**: Shared TypeScript types, Zod schemas, and utility functions used across both frontend and backend.
- **`docker`**: PostgreSQL initialization SQL scripts (`001_schema.sql`).
