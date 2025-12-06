# 🤖 Phase 3 Automation - Testing Guide

## ✅ What's Been Implemented

### 1. **Workflow Automation Service** (`apps/api/src/services/workflow.ts`)
- ✅ Auto-send WhatsApp messages on job status changes
- ✅ Customer response detection (SETUJU/TAK SETUJU)
- ✅ Message template system with variables
- ✅ Reminder message sender
- ✅ Registration confirmation messages

### 2. **Message Templates**
All messages with variables: `{customerName}`, `{deviceType}`, `{diagnosis}`, `{amount}`, `{jobId}`

- ✅ `REGISTRATION_CONFIRMED` - After QR registration
- ✅ `QUOTATION_SENT` - When status = QUOTED
- ✅ `REMINDER_DAY_1` - 1 day after quotation
- ✅ `REMINDER_DAY_20` - 20 days after quotation  
- ✅ `REMINDER_DAY_30` - 30 days after quotation (final)
- ✅ `APPROVED` - Customer replies SETUJU
- ✅ `REJECTED` - Customer replies TAK SETUJU
- ✅ `IN_PROGRESS` - Repair starts
- ✅ `COMPLETED` - Repair finished
- ✅ `THANK_YOU` - After pickup

### 3. **Integrations**
- ✅ Jobs API routes trigger workflow on status change
- ✅ WhatsApp service detects incoming messages
- ✅ Reminder queue processor sends actual messages
- ✅ Database tracking for all messages

---

## 🧪 Testing Workflow - Step by Step

### **Prerequisites:**
1. ✅ API & Web servers running (`npm run dev:monorepo`)
2. ✅ WhatsApp connected (scan QR in Settings)
3. ✅ Login as admin (`admin@example.com` / `admin123`)
4. ✅ Have a test phone number (your own number recommended)

---

## 📱 **Test Scenario 1: Full Quotation Workflow**

### **Step 1: Create Ticket & Generate QR**
1. Go to **Tickets Tab** (`http://localhost:3000/tickets`)
2. Select **QR Code** mode
3. Fill in:
   - Customer Name: `Test Customer`
   - Phone: `601XXXXXXXX` (your WhatsApp number)
   - Device Type: `Laptop`
4. Click **Generate QR Code**

**Expected Result:**
- ✅ QR code modal appears
- ✅ Ticket created with PENDING status

### **Step 2: Complete QR Registration**
1. Scan the QR code with your phone
2. Fill in device details:
   - Full Name: `Test Customer`
   - Phone: `601XXXXXXXX`
   - Device Type: `Laptop`
   - Model: `HP Pavilion`
   - Issue: `Screen not working`
   - ✅ Accept T&C
3. Submit form

**Expected Result:**
- ✅ Registration success message
- ✅ **WhatsApp message received**: "Terima kasih Test Customer! Kami telah terima maklumat..."
- ✅ Job status = PENDING in dashboard

### **Step 3: Update to QUOTED (Send Quotation)**
1. Go to **Jobs Tab** (`http://localhost:3000/jobs`)
2. Find your test job (should be in "Awaiting Quote" column)
3. Click on the job card → **View Details**
4. In job details page:
   - Set **Diagnosis**: `LCD rosak, perlu tukar`
   - Set **Quoted Amount**: `500`
   - Change **Status** to: `QUOTED`
5. Save changes

**Expected Result:**
- ✅ **WhatsApp message sent automatically**: "Berikut adalah quotation untuk pembaikan..."
- ✅ Message includes diagnosis & amount
- ✅ Instructions to reply SETUJU or TAK SETUJU
- ✅ Job moves to "Quotation Sent" column in Kanban
- ✅ 3 reminders scheduled (Day 1, 20, 30)

### **Step 4: Test Customer Approval**
1. On your WhatsApp, reply to the bot: **`SETUJU`**

**Expected Result:**
- ✅ Within 2-3 seconds, **WhatsApp confirmation received**: "Terima kasih! Quotation anda telah diluluskan..."
- ✅ Job status auto-updates to **APPROVED**
- ✅ Job moves to "Approved" column in Kanban
- ✅ approvedAmount field populated

**Alternative Test - Rejection:**
- Reply: **`TAK SETUJU`**
- ✅ Should get rejection message
- ✅ Job status = REJECTED

### **Step 5: Test IN_PROGRESS Message**
1. Drag the job card to **"Repairing"** column (IN_PROGRESS)

**Expected Result:**
- ✅ **WhatsApp message sent**: "Pembaikan untuk Laptop anda kini sedang dalam proses 🔧"

### **Step 6: Test COMPLETED Message**
1. Drag the job card to **"Completed"** column

**Expected Result:**
- ✅ **WhatsApp message sent**: "Alhamdulillah! Pembaikan Laptop anda telah SELESAI! ✅"
- ✅ Message includes total amount & pickup instructions

---

## 📬 **Test Scenario 2: Reminder System**

### **Setup:**
1. Create a job and set status to QUOTED (as above)
2. Do NOT approve the quotation

### **Manual Reminder Test:**

Since reminders are scheduled for 1, 20, and 30 days, we'll manually trigger them:

```bash
# Connect to your API server terminal
cd apps/api

# Manually trigger Day 1 reminder
npx ts-node -e "
import { sendReminderMessage } from './src/services/workflow';
sendReminderMessage('YOUR_JOB_ID_HERE', 'QUOTE_DAY_1').then(console.log);
"
```

**Expected Result:**
- ✅ **WhatsApp reminder received**: "Hi Test Customer, Reminder: Kami masih menunggu keputusan..."

### **Automated Reminder Test:**

The reminder scheduler runs every hour. To test:

1. Check scheduler logs in API terminal:
   ```
   [scheduler] reminder sweep complete { enqueued: X, durationMs: ... }
   ```

2. To force immediate execution, restart the API server (it runs on startup)

---

## 🧪 **Test Scenario 3: Customer Response Detection**

### **Test Various Response Keywords:**

While job is in QUOTED status, test these responses from WhatsApp:

**Approval Keywords:**
- ✅ `SETUJU` → Should approve
- ✅ `setuju` → Should approve (case insensitive)
- ✅ `Ok SETUJU` → Should approve  
- ✅ `YES` → Should approve
- ✅ `APPROVE` → Should approve

**Rejection Keywords:**
- ✅ `TAK SETUJU` → Should reject
- ✅ `tak setuju` → Should reject (case insensitive)
- ✅ `NO` → Should reject
- ✅ `CANCEL` → Should reject
- ✅ `REJECT` → Should reject

**Non-Keywords:**
- ❓ `Hello` → Should be ignored (no status change)
- ❓ `Bila siap?` → Should be ignored

---

## 📊 **Verification Checklist**

After testing, verify the following:

### **Database Records:**
```sql
-- Check messages were logged
SELECT * FROM "Message" ORDER BY "createdAt" DESC LIMIT 10;

-- Check job status history
SELECT * FROM "JobStatusHistory" WHERE "jobId" = 'YOUR_JOB_ID' ORDER BY "createdAt";

-- Check reminders
SELECT * FROM "Reminder" WHERE "jobId" = 'YOUR_JOB_ID';
```

### **In the UI:**
- ✅ Jobs move correctly between Kanban columns
- ✅ Job detail page shows correct status
- ✅ Status history appears in timeline

### **WhatsApp:**
- ✅ All messages received
- ✅ Message formatting looks good
- ✅ Variables filled correctly
- ✅ Phone number format correct

---

## 🐛 **Troubleshooting**

### **Problem: No WhatsApp messages sent**

**Check:**
1. WhatsApp connection status:
   - Go to Settings → WhatsApp
   - Status should be "Connected"

2. API logs for errors:
   ```bash
   # Check API terminal for:
   [Workflow] WhatsApp not connected, cannot send message
   [Workflow] Failed to send message
   ```

3. Phone number format:
   - Should be: `60123456789` (Malaysia)
   - Without spaces, dashes, or +

**Fix:**
- Reconnect WhatsApp in Settings
- Verify phone number format in database
- Check API logs for specific errors

---

### **Problem: Customer response not detected**

**Check:**
1. API logs:
   ```
   [Workflow] Customer not found for incoming message
   [Workflow] No pending quotation found
   ```

2. Job status is QUOTED:
   - Response detection only works for QUOTED jobs
   - If already approved/rejected, won't trigger again

3. Phone number matching:
   - Incoming phone must match customer.phone in database

**Fix:**
- Ensure phone numbers match exactly
- Check job is in QUOTED status
- Restart API server if needed

---

### **Problem: Reminders not sending**

**Check:**
1. Reminder scheduler running:
   ```bash
   # Look for this in API logs:
   [scheduler] reminder scheduler already active
   ```

2. Redis connection:
   ```bash
   # Check if Redis is running
   docker ps | grep redis
   ```

3. Job status:
   - Reminders only send for QUOTED jobs
   - Won't send if job is approved/rejected

**Fix:**
- Restart API server to restart scheduler
- Ensure Redis is running: `docker compose up -d redis`
- Manually trigger reminder (see Manual Reminder Test above)

---

## ✅ **Success Criteria**

Phase 3 Automation is **COMPLETE** if:

- ✅ Registration confirmation sent automatically
- ✅ Quotation message sent when status = QUOTED
- ✅ Customer can approve/reject via WhatsApp
- ✅ Job status updates automatically based on response
- ✅ All workflow messages send correctly
- ✅ Reminders scheduled and sent
- ✅ Messages logged in database
- ✅ Phone number format handled correctly
- ✅ Error handling works (logs errors gracefully)

---

## 🚀 **Next Steps After Testing**

Once all tests pass:

1. ✅ **Customize message templates** (`apps/api/src/services/workflow.ts`)
   - Edit `MESSAGE_TEMPLATES` to match your brand voice
   - Add business name, address, etc.

2. ✅ **Configure reminder timing**
   - Current: Day 1, 20, 30
   - Adjust in `apps/api/src/routes/jobs.routes.ts` (lines 233-235)

3. ✅ **Add photo sending** (optional enhancement)
   - When technician uploads progress photos
   - Send via WhatsApp to customer

4. ✅ **Invoice generation** (Phase 4 - Sales)
   - Auto-generate PDF invoice
   - Send via WhatsApp when completed

5. ✅ **Analytics dashboard**
   - Track message delivery rates
   - Monitor response rates
   - Quotation conversion metrics

---

## 📝 **Testing Log Template**

Use this to track your testing:

```
[ ] Test 1.1: QR Generation
[ ] Test 1.2: Registration + Confirmation Message
[ ] Test 1.3: Quotation Message (QUOTED)
[ ] Test 1.4: Customer Approval (SETUJU)
[ ] Test 1.5: IN_PROGRESS Message
[ ] Test 1.6: COMPLETED Message

[ ] Test 2.1: Manual Reminder Trigger
[ ] Test 2.2: Automated Reminder (wait 1 hour)

[ ] Test 3.1: Approval Keywords
[ ] Test 3.2: Rejection Keywords
[ ] Test 3.3: Non-Keywords (ignored)

[ ] Verify: Database logs
[ ] Verify: UI updates
[ ] Verify: WhatsApp formatting

Issues Found:
- [ ] Issue 1: _______________
- [ ] Issue 2: _______________
```

---

**Happy Testing! 🎉**

If you encounter any issues, check the Troubleshooting section or review the API logs for detailed error messages.
