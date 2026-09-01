# 🚀 Production Deployment Guide: Supabase + Fly.io + Cloudflare Pages

This guide walks you through deploying your omnichannel inventory system using **100% free/low-cost tiers** with zero hardware management required.

---

## 🏗️ Architecture Overview

| Layer | Platform | Free Tier Quota | Purpose |
|---|---|---|---|
| **Database & Storage** | **[Supabase](https://supabase.com)** | 500MB Postgres + 1GB S3 Storage | Stores all data, migrations, and product photos |
| **Backend API** | **[Fly.io](https://fly.io)** | 100GB transfer + Invoicing waived (<$5) | Runs Laravel 11 PHP container 24/7 |
| **Frontend Web** | **[Cloudflare Pages](https://pages.cloudflare.com)** | Unlimited bandwidth & requests | Hosts Vue 3 single-page application |
| **Mobile App** | **Expo / React Native** | Free builds | Installed on Android / iOS devices |

---

## Step 1: Set up Supabase (Database & Storage)

1. Sign up for a free account at **[Supabase.com](https://supabase.com)**.
2. Click **"New Project"**:
   - **Name**: `inventory-system` (or your preferred name)
   - **Database Password**: Choose a strong password and **save it safely**.
   - **Region**: Choose **Southeast Asia (Singapore)** or the region closest to your store/office.
3. **Get your Database Connection String**:
   - Go to **Project Settings** (gear icon) ➔ **Database** ➔ scroll down to **Connection String** ➔ select **URI** / **Transaction Pooler (Port 6543)**.
   - Your connection string looks like:
     ```
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
     ```
4. **Create a Storage Bucket for Product Images**:
   - Go to **Storage** in the left sidebar ➔ click **"New bucket"**.
   - **Bucket name**: `inventory-assets`
   - Toggle **"Public bucket"** to **ON** (allows displaying product photos on POS and mobile).
5. **Generate S3 Access Keys** (for image uploads from Laravel):
   - Go to **Project Settings** ➔ **Storage** ➔ **S3 Access Keys** ➔ click **"Create new access key"**.
   - Copy your `Access Key ID` and `Secret Access Key`.

---

## Step 2: Deploy Laravel Backend to Fly.io

1. **Install the Fly.io CLI (`flyctl`)**:
   - On Windows (PowerShell):
     ```powershell
     powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
     ```
   - Verify installation:
     ```powershell
     fly version
     ```
2. **Log into Fly.io**:
   ```powershell
   fly auth login
   ```
3. **Navigate to the Backend directory**:
   ```powershell
   cd backend
   ```
4. **Deploy the App**:
   Run the setup wizard:
   ```powershell
   fly launch --no-deploy
   ```
   - Choose an app name (e.g. `my-inventory-api`).
   - Select the region (e.g. `sin` for Singapore).
   - If prompted to create a Postgres/Redis database, answer **No** (we are using Supabase).

5. **Set Environment Secrets on Fly.io**:
   Run the following command (replace with your actual Supabase credentials and APP_KEY):
   ```powershell
   fly secrets set `
     APP_KEY="base64:your-laravel-app-key-here" `
     APP_URL="https://my-inventory-api.fly.dev" `
     DB_CONNECTION="pgsql" `
     DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com" `
     DB_PORT="6543" `
     DB_DATABASE="postgres" `
     DB_USERNAME="postgres.your-project-ref" `
     DB_PASSWORD="your-supabase-db-password" `
     DB_SSLMODE="require" `
     DATABASE_URL="postgresql://postgres.your-project-ref:your-supabase-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require" `
     SUPABASE_STORAGE_ACCESS_KEY_ID="your-s3-access-key-id" `
     SUPABASE_STORAGE_SECRET_ACCESS_KEY="your-s3-secret-access-key" `
     SUPABASE_STORAGE_BUCKET="inventory-assets" `
     SUPABASE_STORAGE_ENDPOINT="https://your-project-ref.supabase.co/storage/v1/s3" `
     SUPABASE_STORAGE_PUBLIC_URL="https://your-project-ref.supabase.co/storage/v1/object/public/inventory-assets"
   ```

6. **Deploy**:
   ```powershell
   fly deploy
   ```
   *(The container entrypoint will automatically run all 54 database migrations on Supabase during startup).*

7. **Test Health Endpoint**:
   Open your browser to:
   ```
   https://my-inventory-api.fly.dev/api/v1/health
   ```
   You should receive a `{"status": "ok"}` JSON response!

---

## Step 3: Deploy Frontend Web to Cloudflare

Cloudflare has two interfaces depending on whether you are using the new **Workers & Pages CI/CD Build** or the classic **Pages** interface. Both work seamlessly.

### If you see the screen with "Build configuration", "Deploy command", etc. (as shown in Cloudflare Workers / Builds):

Configure the fields exactly as follows:

| Field in Cloudflare | Value to Enter | Note |
|---|---|---|
| **Build command** | `npm run build` | ⚠️ **Required** (do not leave as `None`) |
| **Deploy command** | `npx wrangler deploy` | Keep default |
| **Version command** | `npx wrangler versions upload` | Keep default |
| **Root directory** | `frontend/web` (or `/frontend/web`) | Tells Cloudflare where the web app lives |
| **Production branch** | `main` | Your default Git branch |
| **Include paths** | `*` (or `frontend/web/**`) | Triggers build when web code changes |
| **Exclude paths** | `node_modules/**, .git/` | Keep default |

#### Add Environment Variables (under "Variables and secrets"):
Click **"Add variable"**:
- **Variable Name**: `VITE_API_BASE_URL`
- **Value**: `https://my-inventory-api.fly.dev/api/v1` (replace with your actual Fly.io backend URL)
- *(Optional)* **Variable Name**: `NODE_VERSION`, **Value**: `20`

---

### If you see the Classic Cloudflare Pages screen:
1. **Framework preset**: `Vue` (or `Vite`)
2. **Root directory**: `frontend/web`
3. **Build command**: `npm run build`
4. **Build output directory**: `dist`
5. **Environment Variable**: `VITE_API_BASE_URL` = `https://my-inventory-api.fly.dev/api/v1`

---

Click **"Save and Deploy"**. Cloudflare will build the frontend and give you a free `https://[your-app].pages.dev` or `workers.dev` URL with global CDN caching and SSL.

---

## Step 4: Configure Mobile App (Expo / React Native)

1. Open `frontend/mobile/.env` and update the production API URL:
   ```env
   EXPO_PUBLIC_API_BASE_URL=https://my-inventory-api.fly.dev/api/v1
   ```
2. Start or build your mobile app:
   ```powershell
   cd frontend/mobile
   npm start
   ```

---

## 🛠️ Ongoing Maintenance & Seed Data

### Run Database Seeders (One-time Initial Setup):
To populate default admin users, store settings, roles, and sample catalog items into your new Supabase database:
```powershell
cd backend
fly ssh console -C "php artisan db:seed --force"
```

### View Live Backend Logs:
```powershell
fly logs
```

### Keep Supabase Awake (Prevent 7-Day Inactivity Auto-Pause):
On [UptimeRobot.com](https://uptimerobot.com) (free), create a monitor that pings `https://my-inventory-api.fly.dev/api/v1/health` once every 24 hours. This keeps both Fly.io and Supabase active forever.
