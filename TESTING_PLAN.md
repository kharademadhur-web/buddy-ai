# Clinic SaaS - Complete System Validation Testing Plan

## Overview
This document outlines comprehensive testing procedures for validating the Clinic SaaS system before production deployment.

---

## Phase 4: Complete System Validation

### 4.1 Database Validation Tests

**Objective:** Verify all database tables exist, have correct relationships, and data operations work correctly.

**Prerequisites:**
- Supabase project connected
- Migration `001_create_clinic_tables.sql` applied
- Environment variables configured

**Test Steps:**

1. **Verify Table Structure**
   ```sql
   -- Run in Supabase SQL Editor
   -- Check all tables exist
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   ```
   
   Expected tables:
   - [ ] clinics
   - [ ] users
   - [ ] doctors
   - [ ] receptionists
   - [ ] payments
   - [ ] counters
   - [ ] device_approval_requests
   - [ ] audit_logs

2. **Verify Constraints and Indexes**
   ```sql
   -- Check indexes exist
   SELECT indexname FROM pg_indexes WHERE tablename = 'users';
   ```

3. **Test Data Insertion**
   ```sql
   -- Insert test clinic
   INSERT INTO clinics (name, address, phone, email, clinic_code, status)
   VALUES ('Test Clinic', '123 Main St', '9876543210', 'test@clinic.com', 'TEST001', 'active');
   ```
   
   Expected: ✓ Clinic created successfully

4. **Test Foreign Key Relationships**
   ```sql
   -- Insert test user with clinic_id
   INSERT INTO users (name, email, role, clinic_id, user_id, password_hash, is_active)
   VALUES ('Test User', 'user@clinic.com', 'doctor', <clinic_id>, 'TEST001-DOC-10001', 'hash', true);
   ```
   
   Expected: ✓ User linked to clinic successfully

5. **Test Cascading Deletes**
   ```sql
   -- Delete clinic and verify related data is cleaned up
   DELETE FROM clinics WHERE clinic_code = 'TEST001';
   SELECT COUNT(*) FROM users WHERE clinic_id = <clinic_id>;
   ```
   
   Expected: Users count = 0 (cascade delete worked)

**Expected Result:** ✅ All database constraints, relationships, and operations work correctly

---

### 4.2 User ID Generation Verification

**Objective:** Verify the user ID generation system produces unique, correctly-formatted IDs.

**Test Steps:**

1. **Test User ID Format**
   ```
   Format: CLINICCODE-ROLE-NUMBER
   Example: TEST001-DOC-10001
   ```

2. **Create Test Clinic**
   - Call: `POST /api/admin/clinics`
   - Body:
     ```json
     {
       "name": "ID Test Clinic",
       "address": "123 Test St",
       "phone": "9876543210",
       "email": "idtest@clinic.com"
     }
     ```
   - Expected: Clinic created with clinic_code (e.g., IDT001)

3. **Generate First Doctor ID**
   - Call: `POST /api/admin/users`
   - Body:
     ```json
     {
       "clinic_id": "<clinic_id>",
       "name": "Dr. Test 1",
       "email": "doc1@test.com",
       "phone": "9876543210",
       "role": "doctor",
       "license_number": "LIC001"
     }
     ```
   - Expected: user_id = "IDT001-DOC-10000" ✓

4. **Generate Second Doctor ID**
   - Repeat step 3 with different email
   - Expected: user_id = "IDT001-DOC-10001" ✓ (incremented)

5. **Generate Receptionist ID**
   - Create receptionist for same clinic
   - Expected: user_id = "IDT001-REC-10000" (separate counter per role)

6. **Verify No Duplicates**
   - Create 5 users of same role
   - Expected: All 5 user_ids are unique ✓

7. **Test Multi-Clinic IDs**
   - Create 2nd clinic (clinic code: IDT002)
   - Create doctor in 2nd clinic
   - Expected: user_id starts from IDT002-DOC-10000 (separate counter per clinic)

**Expected Result:** ✅ User IDs follow correct format, increment properly, and never duplicate

---

### 4.3 Complete Onboarding Flow Test

**Objective:** Verify the entire onboarding wizard works end-to-end.

**Test Scenario: Onboard a Real Clinic**

1. **Step 1: Create Clinic**
   - Login as super-admin
   - Navigate to Admin Panel → Create Clinic
   - Fill in:
     - Name: "Phoenix Medical Center"
     - Address: "123 Medical Plaza, Phoenix, AZ"
     - Phone: "6025551234"
     - Email: "contact@phoenix-medical.com"
   - Submit
   - Expected: ✓ Clinic created, redirected to doctor onboarding

2. **Step 2: Add Doctor**
   - Fill in:
     - Name: "Dr. Priya Sharma"
     - Email: "priya@phoenix-medical.com"
     - Phone: "6025551235"
     - License Number: "PHX-MD-2024-001"
   - Submit
   - Expected: ✓ Doctor created, credentials shown
   - Capture credentials:
     - user_id: PHX001-DOC-10000
     - temp_password: (shown once)

3. **Step 3: Add Receptionist**
   - Fill in:
     - Name: "Raj Patel"
     - Email: "raj@phoenix-medical.com"
     - Phone: "6025551236"
   - Submit
   - Expected: ✓ Receptionist created, credentials shown

4. **Test Credential Delivery**
   - Verify temp passwords are hashed in database (not plaintext)
   - Verify credentials shown only once
   - Verify audit logs record user creation

5. **Test Doctor Login with Generated Credentials**
   - Navigate to `/admin/login`
   - Login with:
     - user_id: PHX001-DOC-10000
     - password: (use temp password)
   - Expected: ✓ Login successful, redirected to dashboard
   - System should:
     - ✓ Set device_id on first login
     - ✓ Create JWT tokens
     - ✓ Store tokens in session storage
     - ✓ Log login event in audit_logs

6. **Test Change Password**
   - Navigate to Settings → Change Password
   - Old password: (temp password)
   - New password: "SecureNewPassword123!"
   - Expected: ✓ Password changed successfully

7. **Test New Password Login**
   - Logout
   - Login with:
     - user_id: PHX001-DOC-10000
     - password: "SecureNewPassword123!"
   - Expected: ✓ Login successful

8. **Test Device Approval**
   - Get device ID from browser console:
     ```javascript
     console.log(localStorage.getItem('admin_device_id'))
     ```
   - Logout
   - Clear browser storage
   - Login again (simulating new device)
   - Expected: ✓ Login blocked or device approval request created

**Expected Result:** ✅ Complete onboarding flow works without errors

---

### 4.4 Analytics Validation

**Objective:** Verify analytics calculations are accurate.

**Test Steps:**

1. **Create Test Data**
   - Create 3 clinics
   - Create 5 payments for each clinic
   - Mark 3 as "paid", 2 as "pending"

2. **Test Revenue Totals**
   - Call: `GET /api/admin/analytics/revenue`
   - Expected response:
     ```json
     {
       "total_revenue": "sum of all paid payments",
       "paid_revenue": "sum of 'paid' status payments",
       "pending_revenue": "sum of 'pending' status payments"
     }
     ```
   - Manually verify calculations match

3. **Test Monthly Trends**
   - Call: `GET /api/admin/analytics/trends`
   - Expected: Data aggregated by month

4. **Test Charts**
   - Verify pie chart shows paid vs pending ratio
   - Verify line chart shows monthly trend correctly

**Expected Result:** ✅ All analytics calculations are accurate

---

### 4.5 RBAC Security Test

**Objective:** Verify role-based access control is enforced.

**Test Scenarios:**

1. **Create Test Users**
   - Create super-admin user
   - Create doctor user
   - Create receptionist user

2. **Test Super-Admin Access**
   - Login as super-admin
   - Call: `GET /api/admin/clinics`
   - Expected: ✓ 200 OK, clinic list returned

3. **Test Doctor Access Restrictions**
   - Login as doctor
   - Call: `GET /api/admin/clinics`
   - Expected: ✗ 403 Forbidden (doctor cannot access admin routes)

4. **Test Receptionist Access Restrictions**
   - Login as receptionist
   - Call: `GET /api/admin/users`
   - Expected: ✗ 403 Forbidden

5. **Test Unauthenticated Access**
   - Remove auth token
   - Call: `GET /api/admin/clinics`
   - Expected: ✗ 401 Unauthorized

6. **Test Token Expiry**
   - Login successfully
   - Wait for token to expire (15 minutes)
   - Make API call
   - Expected: ✗ 401 Unauthorized
   - Call: `POST /api/auth/refresh` with refresh token
   - Expected: ✓ 200 OK, new access token returned

**Expected Result:** ✅ RBAC is properly enforced, unauthorized access is blocked

---

## Phase 5: Production Environment Setup

### 5.1 Deployment Configuration

**Backend (Render):**
- [ ] Create new Render service
- [ ] Connect to GitHub repository
- [ ] Set environment variables:
  - [ ] VITE_SUPABASE_URL
  - [ ] SUPABASE_SERVICE_KEY
  - [ ] JWT_SECRET
  - [ ] JWT_REFRESH_SECRET
  - [ ] ENCRYPTION_KEY
  - [ ] NODE_ENV=production
- [ ] Set build command: `pnpm install && pnpm build`
- [ ] Set start command: `pnpm start`
- [ ] Connect custom domain: api.estrellx.shop

**Frontend (Vercel):**
- [ ] Create new Vercel project
- [ ] Connect to GitHub repository
- [ ] Set environment variables:
  - [ ] VITE_API_URL=https://api.estrellx.shop
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
- [ ] Build command: `pnpm build`
- [ ] Output directory: `dist/spa`
- [ ] Connect custom domain: admin.estrellx.shop

### 5.2 Pre-Deployment Checklist

- [ ] TypeScript compilation: `pnpm typecheck` passes
- [ ] Build succeeds: `pnpm build` completes without errors
- [ ] Production build: `pnpm start` runs successfully
- [ ] All environment variables configured in .env
- [ ] No plaintext passwords in code
- [ ] No console.log statements with sensitive data
- [ ] JWT secrets are 32+ characters
- [ ] Encryption key is 32+ characters
- [ ] CORS allows only production domains
- [ ] Rate limiting is configured
- [ ] Error handlers return safe messages (no stack traces in production)
- [ ] Database migrations applied
- [ ] Supabase RLS policies enabled (optional, for additional security)

---

## Phase 6: Production Validation

### 6.1 Smoke Tests (Post-Deploy)

1. **Admin Panel Loads**
   - [ ] Navigate to https://admin.estrellx.shop
   - [ ] Expected: Login page loads

2. **Admin Login Works**
   - [ ] Login with test super-admin credentials
   - [ ] Expected: Dashboard loads

3. **API Responds**
   - [ ] Call: `curl https://api.estrellx.shop/health`
   - [ ] Expected: `{"status": "ok"}`

4. **Create Clinic**
   - [ ] Create test clinic via admin panel
   - [ ] Expected: Clinic created successfully

5. **Add Doctor**
   - [ ] Add test doctor to clinic
   - [ ] Expected: Doctor created with temp credentials

### 6.2 Security Smoke Tests

1. **HTTPS/TLS**
   - [ ] https://admin.estrellx.shop uses valid SSL
   - [ ] https://api.estrellx.shop uses valid SSL
   - [ ] No mixed content warnings

2. **Authentication**
   - [ ] Unauthenticated access to admin routes denied
   - [ ] Expired tokens rejected
   - [ ] Invalid tokens rejected

3. **Password Hashing**
   - [ ] Query database: `SELECT password_hash FROM users LIMIT 1;`
   - [ ] Verify it's NOT plaintext password
   - [ ] Verify it looks like bcrypt hash (`$2a$...`)

4. **Encryption**
   - [ ] Create doctor with Aadhaar/PAN
   - [ ] Query database: `SELECT aadhaar_encrypted FROM doctors LIMIT 1;`
   - [ ] Verify it's NOT plaintext
   - [ ] Verify API can decrypt and return safely

### 6.3 Performance Checks

1. **Login Performance**
   - [ ] Login takes < 1 second
   - [ ] Measure response time

2. **Dashboard Load**
   - [ ] Dashboard loads within 2 seconds
   - [ ] Charts render without lag

3. **API Response Times**
   - [ ] `/api/admin/clinics` < 500ms
   - [ ] `/api/admin/analytics/revenue` < 500ms
   - [ ] `/api/auth/login` < 800ms

4. **Database Queries**
   - [ ] Check Supabase query times
   - [ ] Verify indexes are being used
   - [ ] No N+1 queries

---

## Sign-Off

When all tests pass, the system is production-ready.

**Go-Live Checklist:**
- [ ] All phase 4-6 tests pass
- [ ] No critical security issues found
- [ ] Performance acceptable
- [ ] Backup strategy in place
- [ ] Monitoring/alerting configured
- [ ] Support/incident response plan documented

**Sign-off Date:** _______________
**Tested by:** _______________
**Approved by:** _______________
