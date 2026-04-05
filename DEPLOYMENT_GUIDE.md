# Production Deployment Guide - Clinic SaaS

Complete guide to deploy the Clinic SaaS system to production on Render (backend) and Vercel (frontend).

---

## Pre-Deployment Requirements

### 1. Supabase Project Setup
- [ ] Create Supabase project or use existing: `bwifzsqclfetsmqqcpud`
- [ ] Get Supabase credentials from Dashboard:
  - [ ] Project URL (Settings > API)
  - [ ] Service Role API Key (Settings > API)
  - [ ] Anon Public Key (Settings > API)
- [ ] Apply migration: `supabase/migrations/001_create_clinic_tables.sql`
- [ ] Create initial super-admin user in database
- [ ] Create storage bucket: `kyc-documents` (private)

### 2. Domain Setup
- [ ] Register/own domain: `estrellx.shop`
- [ ] Point DNS:
  - [ ] `api.estrellx.shop` → Render
  - [ ] `admin.estrellx.shop` → Vercel
- [ ] SSL certificates (auto-provisioned by both platforms)

### 3. GitHub Repository
- [ ] Repository must have:
  - [ ] `pnpm-lock.yaml` (dependency lock file)
  - [ ] `.env.example` (without secrets)
  - [ ] `package.json` with build scripts
  - [ ] All source code committed
- [ ] No `.env` file with secrets should be committed

### 4. Environment Variables (Secure Storage)
Prepare these secrets (do NOT commit to git):
```
VITE_SUPABASE_URL=https://bwifzsqclfetsmqqcpud.supabase.co
VITE_SUPABASE_ANON_KEY=<get-from-supabase-dashboard>
SUPABASE_SERVICE_KEY=<get-from-supabase-dashboard>
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
JWT_REFRESH_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
ENCRYPTION_KEY=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
ADMIN_URL=https://admin.estrellx.shop
MOBILE_APP_URL=https://app.estrellx.shop
NODE_ENV=production
```

---

## Backend Deployment (Render.com)

### Step 1: Create Render Service

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Select "Build and deploy from a Git repository"
4. Connect your GitHub repository
5. Configure service:

| Setting | Value |
|---------|-------|
| **Name** | `clinic-saas-api` |
| **Environment** | Node |
| **Region** | Choose closest to your users |
| **Branch** | `main` (or your deployment branch) |
| **Build Command** | `pnpm install && pnpm build` |
| **Start Command** | `pnpm start` |

### Step 2: Set Environment Variables

In Render dashboard, go to Environment:

```
VITE_SUPABASE_URL=https://bwifzsqclfetsmqqcpud.supabase.co
VITE_SUPABASE_ANON_KEY=<paste-from-supabase>
SUPABASE_SERVICE_KEY=<paste-from-supabase> (Mark as Secret)
JWT_SECRET=<paste-generated-secret> (Mark as Secret)
JWT_REFRESH_SECRET=<paste-generated-secret> (Mark as Secret)
ENCRYPTION_KEY=<paste-generated-secret> (Mark as Secret)
ADMIN_URL=https://admin.estrellx.shop
MOBILE_APP_URL=https://app.estrellx.shop
NODE_ENV=production
```

**Important:** Mark sensitive variables as "Secret" so they don't appear in logs.

### Step 3: Configure Custom Domain

1. In Render dashboard → Settings
2. Add Custom Domain: `api.estrellx.shop`
3. Render will provide CNAME records
4. Update your DNS provider with provided CNAME
5. Verify domain (wait 5-10 minutes for DNS propagation)

### Step 4: Deploy

1. Click "Deploy" button
2. Watch build logs
3. Wait for deployment to complete
4. Test API:
   ```bash
   curl https://api.estrellx.shop/health
   # Should return: {"status": "ok"}
   ```

---

## Frontend Deployment (Vercel.com)

### Step 1: Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure project:

| Setting | Value |
|---------|-------|
| **Project Name** | `clinic-saas-admin` |
| **Framework** | Other (it will auto-detect) |
| **Build Command** | `pnpm build` |
| **Output Directory** | `dist/spa` |
| **Node Version** | 20 (recommended) |

### Step 2: Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```
VITE_API_URL=https://api.estrellx.shop
VITE_SUPABASE_URL=https://bwifzsqclfetsmqqcpud.supabase.co
VITE_SUPABASE_ANON_KEY=<paste-from-supabase>
```

**Note:** Frontend only needs public/anon keys, NOT service keys.

### Step 3: Configure Custom Domain

1. In Vercel project → Settings → Domains
2. Add Domain: `admin.estrellx.shop`
3. Choose DNS provider option or Vercel nameservers
4. Update DNS records accordingly
5. Verify domain (wait 5-10 minutes for DNS propagation)

### Step 4: Deploy

1. Vercel will auto-deploy on GitHub push to `main`
2. Or click "Deploy" in dashboard
3. Watch build logs
4. Test frontend: `https://admin.estrellx.shop/admin/login`

---

## Post-Deployment Steps

### 1. Create Super-Admin User

Since you can't login without a super-admin, create one in Supabase:

```sql
-- In Supabase SQL Editor

-- Generate a bcrypt hash for password "AdminPassword123!"
-- Use: https://bcrypt.online/ with 10 rounds
-- Or use node: node -e "require('bcrypt').hash('AdminPassword123!', 10, (err, hash) => console.log(hash))"

INSERT INTO users (
  name,
  email,
  phone,
  role,
  user_id,
  password_hash,
  is_active,
  login_attempts,
  created_at
) VALUES (
  'System Administrator',
  'admin@estrellx.shop',
  '9000000000',
  'super-admin',
  'ADMIN-001',
  '$2a$10$...<bcrypt-hash>...',  -- Replace with actual hash
  true,
  0,
  now()
);
```

### 2. Login and Verify

1. Go to `https://admin.estrellx.shop/admin/login`
2. Login with:
   - User ID: `ADMIN-001`
   - Password: `AdminPassword123!`
3. Expected: Dashboard loads successfully

### 3. Change Super-Admin Password

1. Navigate to Profile/Settings
2. Change password to a secure one
3. Remember this password for future logins

### 4. Monitor Deployment

**Render (Backend):**
- View logs: Dashboard → Logs
- Check for startup warnings about environment variables
- Monitor API response times

**Vercel (Frontend):**
- View logs: Project → Deployments → View Details
- Check for build errors
- Monitor page load performance

### 5. Test Critical Flows

After deployment, test:

1. **Admin Login**
   - [ ] Can login with credentials
   - [ ] Dashboard loads

2. **Create Clinic**
   - [ ] Fill clinic form
   - [ ] Submit
   - [ ] Verify clinic created in Supabase

3. **Add Doctor**
   - [ ] Fill doctor form
   - [ ] Verify doctor created
   - [ ] Check credentials generated

4. **API Connectivity**
   - [ ] All API calls from admin panel succeed
   - [ ] No CORS errors
   - [ ] No auth errors

---

## Troubleshooting

### Backend Won't Start

**Error: `FATAL: JWT_SECRET environment variable is not set`**
- Solution: Verify JWT_SECRET is set in Render environment variables
- Mark it as Secret so it's not logged

**Error: `FATAL: Clinic with code X not found`**
- Solution: Ensure Supabase migration has run
- Check tables exist: `SELECT table_name FROM information_schema.tables`

### Frontend Shows Blank Page

**Error: `Failed to fetch from API`**
- Solution: Check VITE_API_URL is correct in Vercel env vars
- Verify API is accessible: `curl https://api.estrellx.shop/health`

**Error: Styles not loading (unstyled page)**
- Solution: Check output directory is set to `dist/spa`
- Clear Vercel cache: Settings → Git → Disconnect/Reconnect

### CORS Errors

**Error: `Access to XMLHttpRequest... CORS policy`**
- Solution: Check server/index.ts CORS configuration includes admin domain
- Ensure environment variables ADMIN_URL is set correctly
- Restart both services after changing CORS

### Database Connection Failed

**Error: `Supabase connection error`**
- Solution: Check VITE_SUPABASE_URL is correct
- Verify SUPABASE_SERVICE_KEY is not expired
- Check Supabase project is active (not paused)

---

## Security Checklist

After deployment, verify:

- [ ] No environment secrets in frontend code
- [ ] HTTPS/SSL working on both domains
- [ ] CORS allows only your domains
- [ ] Rate limiting enabled on API
- [ ] Password hashing working (bcrypt)
- [ ] Sensitive data encrypted (Aadhaar, PAN)
- [ ] Audit logs recording actions
- [ ] JWT tokens have secure secrets
- [ ] No plaintext passwords in database
- [ ] Supabase RLS policies enabled (optional)

---

## Rollback Plan

If deployment fails:

1. **For Backend (Render):**
   - Go to Deployments
   - Click on previous successful deployment
   - Click "Redeploy"

2. **For Frontend (Vercel):**
   - Go to Deployments
   - Click on previous successful deployment
   - Click "Promote to Production"

---

## Maintenance

### Regular Tasks

- [ ] Monitor API logs weekly
- [ ] Check database query performance
- [ ] Review audit logs for suspicious activity
- [ ] Backup Supabase database (configure auto-backups)
- [ ] Update dependencies (security patches)
- [ ] Monitor costs (Render, Vercel, Supabase)

### Monitoring URLs

- Render: https://dashboard.render.com/
- Vercel: https://vercel.com/dashboard
- Supabase: https://app.supabase.com/

---

## Support & Documentation

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Node.js Docs: https://nodejs.org/docs

---

**Deployment Status:** Ready for Production ✅
