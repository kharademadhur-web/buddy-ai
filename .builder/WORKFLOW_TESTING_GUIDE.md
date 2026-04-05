# Clinic SaaS - Workflow Testing Guide

This document provides a step-by-step guide to test all implemented workflows for the Clinic SaaS application.

## 1. Authentication Workflow

### OTP-Based Login Flow
1. Navigate to `/otp-login`
2. **Test Case 1.1: Phone Number Login**
   - Enter a valid 10-digit Indian phone number (starting with 6-9)
   - Click "Send OTP"
   - Expected: Should see session ID and "OTP sent successfully" message
   - Check server logs for OTP display (mock implementation)

3. **Test Case 1.2: Email Login**
   - Toggle to "Email" option
   - Enter a valid email address
   - Click "Send OTP"
   - Expected: Should see session ID in response

### OTP Verification Flow
1. After clicking "Send OTP", navigate to `/otp-verify`
2. **Test Case 1.3: Valid OTP Verification**
   - Get OTP from server logs (console output)
   - Enter the 6-digit OTP
   - Expected: Should see countdown timer, success animation
   - Should redirect to dashboard based on user role

3. **Test Case 1.4: Invalid OTP Handling**
   - Enter an incorrect OTP
   - Expected: Error message after 3 attempts, warning at 4 attempts

4. **Test Case 1.5: OTP Expiry**
   - Wait for 5 minutes after OTP generation
   - Try to verify OTP
   - Expected: "OTP has expired" error message

---

## 2. Clinic Onboarding Workflow

### Step 1: Clinic Information
1. Navigate to `/clinic-onboarding` (after authentication)
2. **Test Case 2.1: Fill Clinic Details**
   - Clinic Name: "City Medical Clinic"
   - Location: "Mumbai"
   - Click "Next"
   - Expected: Progress indicator shows Step 1 of 2, form clears

### Step 2: Clinic Address & Contact
1. **Test Case 2.2: Fill Address Details**
   - Address: "123 Medical Plaza, Mumbai, India"
   - Phone: "9876543210"
   - Email: "clinic@example.com"
   - Click "Submit"
   - Expected: Loading spinner, success message
   - Should create clinic record in database

2. **Test Case 2.3: Form Validation**
   - Try to submit with empty fields
   - Expected: Error messages for required fields
   - Phone validation for non-Indian numbers
   - Email format validation

---

## 3. Doctor KYC Workflow

### Step 1: Professional Details
1. Navigate to `/doctor-kyc` (after clinic registration)
2. **Test Case 3.1: Fill Professional Details**
   - License Number: "MCI-123456"
   - License Valid Till: Future date
   - Registration Number: "REG-2024-001"
   - Specialization: "General Medicine"
   - Address: "123 Doctor's Clinic"
   - Click "Next Step"
   - Expected: Progress bar updates, form validates

### Step 2: KYC Documents
1. **Test Case 3.2: Upload Documents**
   - Aadhaar: "123456789012"
   - PAN: "ABCDE1234F"
   - Upload profile photo (5MB max)
   - Upload signature (5MB max)
   - Click "Submit KYC"
   - Expected: Files compress and upload, success message

2. **Test Case 3.3: File Size Validation**
   - Try uploading files > 5MB
   - Expected: "File size must be less than 5MB" error

3. **Test Case 3.4: Document Validation**
   - Aadhaar validation (12 digits)
   - PAN validation (10 characters, specific format)
   - Expected: Format validation errors

---

## 4. Subscription & Payment Workflow

### Plan Selection
1. Navigate to `/payment-dashboard`
2. **Test Case 4.1: View Available Plans**
   - Should show Monthly (₹999) and Yearly (₹9999) plans
   - Each plan should display features list
   - Expected: Both plans visible with proper pricing

### Payment Flow
1. **Test Case 4.2: Select Monthly Plan**
   - Click "Select Plan" on Monthly option
   - Expected: Plan gets selected (visual feedback)
   - Proceed to payment

2. **Test Case 4.3: Create Payment Order**
   - After plan selection, order should be created
   - Expected: Order ID generated, amount validated

3. **Test Case 4.4: Verify Payment**
   - Mock payment verification succeeds
   - Expected: "Payment successful" message
   - Subscription becomes "active"
   - Invoice appears in history

4. **Test Case 4.5: Payment History**
   - Completed payments show in history table
   - Status shows as "completed"
   - Can download invoices

### Auto-Pay Management
1. **Test Case 4.6: Toggle Auto-Pay**
   - Click toggle for auto-pay
   - Expected: Setting updates, confirmation message
   - Subscription auto-renews when expiring

---

## 5. Follow-up Scheduling Workflow

### Schedule Follow-up
1. Navigate to `/follow-up-scheduler`
2. **Test Case 5.1: Open Schedule Form**
   - Click "Schedule Follow-up" button
   - Form appears with all fields
   - Expected: Date, time, notification channel fields visible

3. **Test Case 5.2: Fill Follow-up Details**
   - Patient ID: "PAT-001"
   - Doctor ID: "DOC-001"
   - Scheduled Date: Tomorrow
   - Scheduled Time: 10:00 AM
   - Notification Channel: WhatsApp
   - Reminder: 60 minutes before
   - Notes: "Check patient progress"
   - Click "Schedule Follow-up"
   - Expected: Loading spinner, success message

4. **Test Case 5.3: Upcoming Follow-ups List**
   - New follow-up appears in upcoming list
   - Shows patient, doctor, date/time, notification channel
   - Expected: Proper formatting and details display

### Follow-up Management
1. **Test Case 5.4: Complete Follow-up**
   - Click "Complete" button on a follow-up
   - Expected: Status changes to "completed"
   - Removed from upcoming list

2. **Test Case 5.5: Edit Follow-up**
   - Click "Edit" on a follow-up
   - Form pre-fills with existing data
   - Update notes
   - Click "Update Follow-up"
   - Expected: Changes save, notification triggered

---

## 6. Admin Dashboard Workflow

### Dashboard Overview
1. Navigate to Admin Dashboard (as super-admin)
2. **Test Case 6.1: View Key Metrics**
   - Should display:
     - Total Clinics
     - Active Users
     - Total Doctors
     - Reception Staff
     - Total Revenue
   - Expected: All metrics show correct counts

3. **Test Case 6.2: Revenue Chart**
   - 6-month revenue trend visible as bar chart
   - Each bar represents monthly revenue
   - Expected: Heights proportional to values

4. **Test Case 6.3: Subscription Analytics**
   - Active Plans: Count of active subscriptions
   - Expiring Soon: Subscriptions expiring in 7 days
   - Expired: Past-due subscriptions
   - Pending Payment: Awaiting payment subscriptions
   - Expected: Accurate counts with color coding

5. **Test Case 6.4: Recent Activity**
   - Shows latest activities (subscriptions, payments, KYC approvals)
   - Each with timestamp and type icon
   - Expected: Activities sorted by recency

### Clinic Management
1. **Test Case 6.5: View All Clinics**
   - Click "Clinics" tab
   - Lists all registered clinics
   - Shows clinic details (name, address, doctor/reception count)
   - Expected: All clinics visible with details

### User Management
1. **Test Case 6.6: User List**
   - Click "User Management" tab
   - Shows all users with role, clinic, status
   - Can toggle user status
   - Expected: Proper role display, status toggle works

---

## 7. Backend API Testing

### Authentication APIs
```bash
# Send OTP
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"contact":"9876543210","contactType":"phone"}'

# Verify OTP (use OTP from logs)
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"xxx","otp":"123456"}'

# Get Auth User
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Clinic APIs
```bash
# Register Clinic
curl -X POST http://localhost:5000/api/clinics/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name":"City Medical",
    "email":"clinic@example.com",
    "phone":"9876543210",
    "location":"Mumbai",
    "address":"123 Medical Plaza"
  }'

# Get Clinic Details
curl -X GET http://localhost:5000/api/clinics/CLINIC_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Doctor APIs
```bash
# Submit Doctor KYC
curl -X POST http://localhost:5000/api/doctors/kyc/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "licenseNumber":"MCI-123456",
    "licenseValidTill":"2025-12-31",
    "registrationNumber":"REG-2024-001",
    "specialization":"General",
    "address":"123 Doctor St",
    "aadhaar":"123456789012",
    "pan":"ABCDE1234F"
  }'

# Get Doctor Details
curl -X GET http://localhost:5000/api/doctors/DOCTOR_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Payment APIs
```bash
# Create Payment Order
curl -X POST http://localhost:5000/api/payments/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "clinicId":"CLINIC_ID",
    "planType":"monthly",
    "amount":999
  }'

# Verify Payment
curl -X POST http://localhost:5000/api/payments/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId":"order_xxx",
    "paymentId":"pay_xxx",
    "signature":"sig_xxx"
  }'

# Get Payment History
curl -X GET "http://localhost:5000/api/payments/history?clinicId=CLINIC_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Follow-up APIs
```bash
# Schedule Follow-up
curl -X POST http://localhost:5000/api/followups/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId":"PAT-001",
    "doctorId":"DOC-001",
    "clinicId":"CLINIC_ID",
    "scheduledDate":"2024-02-15T10:00:00Z",
    "notes":"Follow-up check",
    "notificationChannel":"whatsapp"
  }'

# Get Upcoming Follow-ups
curl -X GET "http://localhost:5000/api/followups/upcoming" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 8. WhatsApp Service Testing

### Mock WhatsApp Messages
1. **Test Case 8.1: Check Server Logs**
   - When follow-up is scheduled, check console logs
   - Should see mock WhatsApp message output
   - Expected: "[WhatsApp Mock] Sending message" log entries

2. **Test Case 8.2: Follow-up Reminder**
   - Schedule a follow-up with WhatsApp notification
   - Check logs for message content
   - Expected: Formatted reminder message with date/time

---

## 9. Error Handling & Validation

### Test Case 9.1: Invalid Inputs
- Empty required fields
- Invalid email/phone format
- Invalid date ranges
- File upload errors

### Test Case 9.2: Authorization Errors
- Access resources without token
- Access clinic data from different user
- Expected: 401/403 error responses

### Test Case 9.3: Duplicate Records
- Try to create duplicate clinic for same user
- Expected: 409 Conflict error

---

## 10. End-to-End User Journey

### Complete Flow
1. **New Clinic Admin Setup**
   - OTP Login (phone)
   - OTP Verification
   - Clinic Onboarding
   - Doctor KYC Submission
   - Subscribe to plan (monthly)
   - Make payment
   - View Payment Dashboard
   - Check subscription status

2. **Doctor Follow-up Management**
   - Login as doctor
   - View assigned clinic
   - Schedule follow-up for patient
   - Check upcoming follow-ups
   - Mark as completed

3. **Admin Oversight**
   - Login as super-admin
   - View all clinics and users
   - Monitor subscription status
   - Review payment history
   - Check activity timeline

---

## Success Criteria

✅ All authentication flows work without errors
✅ Clinic and doctor registration data saves to database
✅ Payments process and subscription activates
✅ Follow-ups schedule and send notifications (mock)
✅ Admin dashboard displays accurate analytics
✅ All API endpoints return correct responses
✅ Error handling works for edge cases
✅ Role-based access control enforced
✅ Database relationships maintained correctly
✅ Session management works across page refreshes

---

## Troubleshooting

### OTP not appearing in logs
- Check browser DevTools Network tab for API response
- OTP is mocked in logs for development

### Payment not verifying
- Ensure clinic ID is valid
- Check that clinic exists in database
- Verify authorization token is valid

### Follow-up not appearing in list
- Ensure scheduled date is in the future
- Check clinic ID is set correctly
- Verify user has proper role permissions

### Database connection issues
- Confirm MongoDB is running on localhost:27017
- Check MONGO_URI environment variable
- Look for mongoose connection logs

---

## Performance Notes

- Initial page load should complete in < 2 seconds
- API responses should return in < 500ms
- Charts should render smoothly without lag
- Form submissions should show loading state
- All animations should be smooth (60fps)

---

## Next Steps for Production

1. Replace mock WhatsApp service with Twilio/Meta Business API
2. Integrate real Razorpay payment gateway
3. Add comprehensive error logging and monitoring
4. Implement cron jobs for subscription renewal
5. Add email notifications (in addition to WhatsApp)
6. Set up SMS service for additional notifications
7. Implement advanced analytics and reporting
8. Add customer support features (tickets, chat)
9. Deploy to production environment
10. Set up automated backup and recovery procedures
