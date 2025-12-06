# 🚀 Quick Testing Guide - Phase 3 Automation

## ⚡ START HERE - Manual Steps

### **Step 1: Start Servers** 

**Open PowerShell Terminal** (in project root):

```powershell
cd "C:\Users\Jokeryazid\Documents\My projek\new whatsappbot\app-WhatsAppboot"

# Start API Server (in one terminal)
cd apps/api
npm run dev
```

**Open ANOTHER PowerShell Terminal**:

```powershell
cd "C:\Users\Jokeryazid\Documents\My projek\new whatsappbot\app-WhatsAppboot"

# Start Web Server (in second terminal)  
cd apps/web
npm run dev
```

**Wait for:**
- ✅ API: `Server running on http://localhost:4000`
- ✅ Web: `ready - started server on 0.0.0.0:3000`

---

### **Step 2: Login to System** 🔐

1. Open browser: **http://localhost:3000/login**

2. Login with:
   - **Email**: `admin@example.com`
   - **Password**: `admin123`

3. You should see the dashboard

---

### **Step 3: Connect WhatsApp** 📱

1. Go to: **http://localhost:3000/settings**

2. Find **WhatsApp Connection** section

3. Click **"Connect WhatsApp"** or **"Start Session"**

4. **Scan the QR code** with your WhatsApp

5. Wait for status: **"Connected" ✅**

**IMPORTANT:** WhatsApp MUST be connected for automation to work!

---

### **Step 4: Create Test Ticket** 🎫

1. Go to: **http://localhost:3000/tickets**

2. Select **"QR Code"** tab

3. Fill in form:
   - **Customer Name**: `Test Customer`
   - **Phone**: `601XXXXXXXX` (YOUR WhatsApp number!)
   - **Device Type**: Select `Laptop`

4. Click **"Generate QR Code"**

5. You should see:
   - ✅ QR Code modal appears
   - ✅ Ticket details shown
   - ✅ Download/Copy Link buttons

6. **Either:**
   - **Scan QR code** with your phone, OR
   - **Copy link** and open in phone browser

---

### **Step 5: Complete Registration** 📝

On your phone (after scanning QR or opening link):

1. Fill in the registration form:
   - **Full Name**: `Test Customer`
   - **Phone**: `601XXXXXXXX` (your number)
   - **Device Type**: `Laptop`
   - **Model**: `HP Pavilion`
   - **Issue**: `Screen not working`
   - ✅ Accept Terms & Conditions

2. Click **Submit**

3. **CHECK YOUR WHATSAPP!** 📱

**Expected:**
✅ WhatsApp message received from bot:
```
Terima kasih Test Customer! 🙏

Kami telah terima maklumat peranti anda:
📱 Jenis: Laptop
🔧 Model: HP Pavilion

Peranti anda sedang dalam proses pemeriksaan...
```

**If you received this message → AUTOMATION WORKS! 🎉**

---

### **Step 6: Send Quotation** 💰

1. Go back to browser: **http://localhost:3000/jobs**

2. You should see your test job in **"Awaiting Quote"** column

3. **Click on the job card**

4. In job details, fill in:
   - **Diagnosis**: `LCD rosak, perlu tukar`
   - **Quoted Amount**: `500`

5. Change **Status** dropdown to: **QUOTED**

6. **Save** changes

7. **CHECK YOUR WHATSAPP AGAIN!** 📱

**Expected:**
✅ WhatsApp message with quotation:
```
Assalamualaikum Test Customer,

Berikut adalah quotation untuk pembaikan peranti anda:

📱 Peranti: Laptop HP Pavilion
🔍 Diagnosis: LCD rosak, perlu tukar  
💰 Kos Pembaikan: RM500.00

Untuk meneruskan pembaikan, sila reply:
✅ SETUJU - untuk approve
❌ TAK SETUJU - untuk reject

Quotation ini sah selama 30 hari.
Ref: #XXXXXXXX
```

**If you received this → QUOTATION AUTOMATION WORKS! 🎉**

---

### **Step 7: Test Customer Approval** ✅

1. **On your WhatsApp**, reply to the bot: **`SETUJU`**

2. **Wait 2-3 seconds**

3. **Check WhatsApp** - you should get confirmation:
```
Terima kasih Test Customer! ✅

Quotation anda telah diluluskan. Pembaikan akan bermula sekarang.

📱 Laptop HP Pavilion
💰 Kos: RM500.00

Kami akan update anda tentang progress pembaikan.

Ref: #XXXXXXXX
```

4. **Check browser** (Jobs page)
   - ✅ Job should AUTO-MOVE to **"Approved"** column!
   - ✅ Status changed without you doing anything!

**If job moved automatically → RESPONSE DETECTION WORKS! 🎉**

---

### **Step 8: Test Workflow Messages** 🔄

Now test the rest of the workflow:

**A. IN_PROGRESS Message:**
1. Drag the job card to **"Repairing"** column
2. **Check WhatsApp** - should receive:
```
Hi Test Customer,

Pembaikan untuk Laptop anda kini sedang dalam proses. 🔧

Kami akan update anda dengan gambar progress tidak lama lagi.

Ref: #XXXXXXXX
```

**B. COMPLETED Message:**
1. Drag the job card to **"Completed"** column  
2. **Check WhatsApp** - should receive:
```
Alhamdulillah! Test Customer ✅

Pembaikan Laptop anda telah SELESAI!

📱 Peranti: Laptop HP Pavilion
💰 Jumlah Bayaran: RM500.00

Sila datang ke kedai untuk ambil peranti anda.

Waktu Operasi:
📅 Isnin - Jumaat: 9 AM - 6 PM
📅 Sabtu: 9 AM - 2 PM

Ref: #XXXXXXXX
```

---

## ✅ **SUCCESS CRITERIA**

Phase 3 Automation is **WORKING** if you received:

- ✅ Registration confirmation WhatsApp
- ✅ Quotation WhatsApp with SETUJU/TAK SETUJU options
- ✅ Approval confirmation when you replied SETUJU
- ✅ Job status auto-updated to APPROVED
- ✅ IN_PROGRESS message when dragged to Repairing
- ✅ COMPLETED message when dragged to Completed

**If ALL 6 messages received → 🎉 PHASE 3 COMPLETE! 🎉**

---

## 🐛 **Troubleshooting**

### **Problem: No WhatsApp messages received**

**Check 1: WhatsApp Connection**
- Go to Settings → WhatsApp
- Status should be **"Connected"**
- If not, scan QR again

**Check 2: Phone Number Format**
- Must be: `60123456789` (Malaysia)
- NO spaces, dashes, or +
- Include country code

**Check 3: API Logs**
- Check API terminal for errors:
```
[Workflow] WhatsApp not connected
[Workflow] Failed to send message
```

---

### **Problem: Job status didn't auto-update when I replied SETUJU**

**Check 1: Job Status**
- Job MUST be in **QUOTED** status
- If already APPROVED, won't trigger again

**Check 2: Phone Number Match**
- Phone in WhatsApp MUST match phone in database
- Check customer record in Customers page

**Check 3: Keyword**
- Try exact: `SETUJU` (all caps)
- Or: `setuju` (lowercase also works)

**Check 4: API Logs**
- Look for:
```
[Workflow] Customer not found for incoming message
[Workflow] No pending quotation found  
[Workflow] Job approved by customer
```

---

### **Problem: Servers won't start**

**Fix 1: Kill existing processes**
```powershell
# Kill port 4000 (API)
netstat -ano | findstr :4000
taskkill /PID <PID_NUMBER> /F

# Kill port 3000 (Web)
netstat -ano | findstr :3000  
taskkill /PID <PID_NUMBER> /F
```

**Fix 2: Check for errors**
```powershell
# In apps/api terminal:
npm run dev

# Look for errors like:
# - Port already in use
# - Database connection failed
# - Redis connection failed
```

**Fix 3: Ensure dependencies installed**
```powershell
# In project root:
npm install

# In apps/api:
cd apps/api
npm install

# In apps/web:
cd apps/web
npm install
```

---

## 📊 **Testing Checklist**

Use this to track your progress:

```
[ ] Step 1: Servers started (API + Web)
[ ] Step 2: Logged into system
[ ] Step 3: WhatsApp connected
[ ] Step 4: Created test ticket
[ ] Step 5: Completed registration form
[ ] Step 6: Received registration confirmation WhatsApp
[ ] Step 7: Set job to QUOTED
[ ] Step 8: Received quotation WhatsApp
[ ] Step 9: Replied SETUJU on WhatsApp
[ ] Step 10: Received approval confirmation WhatsApp
[ ] Step 11: Job auto-updated to APPROVED
[ ] Step 12: Dragged to IN_PROGRESS, received WhatsApp
[ ] Step 13: Dragged to COMPLETED, received WhatsApp
```

**If all checked → AUTOMATION FULLY WORKING! 🚀**

---

## 🎯 **Next After Testing**

Once all tests pass:

**Option A: Test Rejection**
- Create another ticket
- Set to QUOTED
- Reply **`TAK SETUJU`** instead
- Should get rejection message
- Job should move to REJECTED

**Option B: Test Other Keywords**
- Try: `ok`, `YES`, `APPROVE`
- All should work for approval
- Try: `NO`, `CANCEL`, `REJECT`  
- All should work for rejection

**Option C: Test Reminder (Manual)**
Since reminders are scheduled for days later, manually trigger:
```powershell
# In apps/api directory:
npx ts-node -e "
import { sendReminderMessage } from './src/services/workflow';
sendReminderMessage('YOUR_JOB_ID', 'QUOTE_DAY_1').then(console.log);
"
```

---

## 📝 **Report Issues**

If you find bugs, note:
1. What you did
2. What you expected
3. What actually happened
4. Error messages (if any)
5. Screenshots of WhatsApp messages

---

**Good luck! You got this! 💪**

**Estimated time: 15-20 minutes**
