# Development Roadmap - Complete Step-by-Step Guide

## 🎯 OVERVIEW

Ini adalah panduan lengkap untuk build aplikasi dari mula sampai habis menggunakan Master Prompt yang telah disediakan.

---

## 📍 STARTING POINT

### **Step 0: Initial Request (YOU START HERE)**
```
Hi, I need help building a WhatsApp Bot CRM System. 
Here's the complete master prompt with all requirements:

[PASTE MASTER PROMPT HERE]

Let's start with Phase 1: Foundation. 
Please help me:
1. Setup Next.js project structure
2. Setup Node.js API with TypeScript
3. Configure Prisma with PostgreSQL
4. Create Docker Compose file
```

**AI akan bagi anda:**
- Complete project structure commands
- Package.json files
- Docker compose configuration
- Prisma schema initial setup

---

## 🔄 PHASE 1: FOUNDATION (Week 1-2)

### **Step 1.1: After Project Setup**
```
Great! The project structure is ready. Now help me with:

1. Create the complete Prisma schema based on the database schema 
   in the master prompt (all 20+ tables)
2. Setup the initial migration
3. Create seed data for:
   - 1 Admin user
   - Initial settings (business hours, tax rate, etc.)
   - 5 sample products
```

**AI akan bagi:**
- Complete `schema.prisma` file
- Migration commands
- Seed script with sample data

---

### **Step 1.2: Authentication System**
```
Now I need to implement the authentication system. Based on the 
master prompt requirements:

1. JWT authentication with access & refresh tokens
2. Login/Logout endpoints
3. Role-based middleware (Admin, Technician, Cashier, Manager)
4. Redis session management

Please provide:
- Auth service code
- API routes (/api/auth/login, /api/auth/logout, /api/auth/refresh)
- JWT middleware
- Redis connection setup
```

**AI akan bagi:**
- Auth service TypeScript code
- API route handlers
- Middleware files
- Redis setup

---

### **Step 1.3: Basic UI Setup**
```
Now let's setup the frontend. I need:

1. Layout components with sidebar navigation
2. Login page
3. Dashboard skeleton (just layout, no data yet)
4. Dark/Light theme toggle using Shadcn/ui
5. Protected route wrapper

Use Shadcn/ui components and Tailwind CSS as specified 
in the master prompt.
```

**AI akan bagi:**
- Layout components
- Login page code
- Dashboard page
- Theme provider setup
- Protected route HOC

---

### **Step 1.4: Test Phase 1**
```
Help me test Phase 1. Provide:
1. Commands to run the application
2. Test credentials to login
3. Checklist to verify everything works
4. Common errors and how to fix them
```

**AI akan bagi:**
- Docker commands
- Test credentials
- Verification steps
- Troubleshooting guide

---

## 🔄 PHASE 2: CORE FEATURES (Week 3-4)

### **Step 2.1: Customer Management**
```
Phase 1 is working! Let's move to Phase 2: Core Features.

First, implement Customer Management:

1. Customer CRUD API endpoints (GET, POST, PUT, DELETE /api/customers)
2. Customer list page with:
   - Search by name/phone
   - Filter by customer type
   - Pagination
3. Customer detail page showing:
   - Profile info
   - Device list
   - Job history
4. Add/Edit customer form

Follow the database schema from master prompt.
```

**AI akan bagi:**
- API routes code
- Frontend pages
- Form components
- Search/filter logic

---

### **Step 2.2: Device Management**
```
Now add Device Management:

1. Device CRUD endpoints
2. Link devices to customers
3. Device list in customer profile
4. Add device form (modal)
```

**AI akan bagi:**
- Device API routes
- Device components
- Form with customer lookup

---

### **Step 2.3: Repair Job Management - Part 1 (Basic)**
```
Now the most important part - Repair Jobs.

First, implement the basic structure:

1. Job CRUD endpoints
2. Job listing page with filters:
   - Status filter (Pending, In Progress, Completed, etc.)
   - Date range filter
   - Customer search
3. Job detail page showing:
   - Job info
   - Customer info
   - Device info
   - Status timeline
4. Create job form
```

**AI akan bagi:**
- Job API routes
- Job listing page
- Job detail page
- Create job form

---

### **Step 2.4: QR Code Generation**
```
Now implement the QR Code feature from the SOP workflow:

1. When creating a job, generate unique QR code
2. QR code links to: /register/{unique_token}
3. Create public registration form at that URL:
   - Customer fills: name, phone, device_type, model
   - Accept T&C checkbox
   - Auto-create customer if new
   - Link to existing job
4. Display QR code in job detail page for technician to show customer

This is critical for the workflow!
```

**AI akan bagi:**
- QR generation code
- Public registration page
- QR display component
- Token validation logic

---

### **Step 2.5: Photo Upload**
```
Jobs need photo documentation. Implement:

1. Photo upload endpoint (multiple files)
2. Store in /uploads directory
3. Photo type: Before, During, After
4. Display photos in job detail page
5. Gallery view component
```

**AI akan bagi:**
- File upload API
- Multer configuration
- Photo gallery component
- Image optimization

---

### **Step 2.6: WhatsApp Integration - Basic**
```
Now let's integrate WhatsApp using Baileys library:

1. WhatsApp service setup
2. QR code authentication endpoint
3. Connection status endpoint
4. Send message function
5. Receive message handler
6. Store messages in database

Create a settings page where admin can:
- See WhatsApp QR to pair device
- Check connection status
- Disconnect/Reconnect
```

**AI akan bagi:**
- Baileys service wrapper
- WhatsApp API endpoints
- Connection UI page
- Message handlers

---

### **Step 2.7: Message Templates**
```
Create the message template system as per SOP:

1. Store templates in database (settings table)
2. Template variables: {name}, {diagnosis}, {amount}, etc.
3. Function to replace variables
4. Create these templates:
   - Confirmation message
   - Quotation message
   - Approved message
   - Rejected message
   - Progress update
   - Completion message
   - Thank you message

Create UI to edit templates in settings page.
```

**AI akan bagi:**
- Template engine code
- Default templates SQL
- Template editor UI
- Variable replacement logic

---

### **Step 2.8: Test Phase 2**
```
Let's test Phase 2 completely:

1. Create a test customer
2. Register device
3. Create repair job with QR
4. Test QR registration flow
5. Upload photos
6. Connect WhatsApp
7. Send test message

Provide test scenarios and expected results.
```

**AI akan bagi:**
- Test checklist
- Sample data
- Expected outputs
- Debugging tips

---

## 🔄 PHASE 3: AUTOMATION (Week 5-6)

### **Step 3.1: OpenAI Integration**
```
Time to add AI! Based on master prompt:

1. OpenAI service wrapper
2. Function to build context from:
   - Customer history
   - Job status
   - Product info
3. Intent detection
4. Generate response
5. Store conversation in ai_conversations table
6. Add "Ask AI" feature in WhatsApp messages view

Use GPT-4 model as specified.
```

**AI akan bagi:**
- OpenAI service code
- Context builder
- Conversation storage
- Chat UI component

---

### **Step 3.2: Automated Workflow - Quotation**
```
Implement the quotation workflow from SOP:

1. When technician enters diagnosis & cost in job detail:
   - Update job status to 'Quoted'
   - Create quotation record
   - Auto-send WhatsApp message with template
   - Schedule reminders (Day 1, 20, 30)

2. When customer replies "SETUJU" or "TAK SETUJU":
   - Detect response
   - Update job status (Approved/Rejected)
   - Send appropriate follow-up message

This is the core automation!
```

**AI akan bagi:**
- Quotation submission flow
- WhatsApp message trigger
- Response detection
- Status update logic

---

### **Step 3.3: Bull Queue Setup**
```
We need message queuing for reliability. Setup Bull with Redis:

1. Configure Bull queues
2. Create jobs for:
   - Scheduled messages (reminders)
   - Campaign messages
   - Delayed messages
3. Queue processor
4. Failed job handler
5. Queue monitoring UI (optional)
```

**AI akan bagi:**
- Bull configuration
- Queue definitions
- Processor code
- Retry logic

---

### **Step 3.4: Reminder System**
```
Implement the smart reminder system from SOP:

1. Cron job (runs every hour)
2. Check jobs with status='Quoted' and customer_approved=false
3. Calculate days since date_quoted
4. Send reminders based on schedule:
   - Day 1: Reminder 1
   - Day 20: Reminder 2
   - Day 30: Reminder 3
5. Log in reminders table
6. Don't send duplicate reminders

This must be bulletproof!
```

**AI akan bagi:**
- Cron job setup
- Reminder logic
- Duplicate prevention
- Logging system

---

### **Step 3.5: Complete Workflow Automation**
```
Now automate the entire job lifecycle:

1. Job Status: 'In Progress'
   → Send: "Laptop anda akan dibaiki. Tunggu update dari kami"

2. Technician uploads progress photos
   → Send: Photos + progress message

3. Job Status: 'Completed'
   → Generate invoice
   → Send: Completion photos + invoice PDF + pickup message

4. Job Status: 'Delivered'
   → Send: Thank you + review request link

Implement all these triggers.
```

**AI akan bagi:**
- Status change hooks
- Message triggers
- Invoice generation
- PDF creation

---

### **Step 3.6: Test Phase 3**
```
Full workflow test:

1. Create job → Customer gets confirmation
2. Submit quotation → Customer gets quotation message
3. Don't respond → Test reminder after 1 day (manually trigger cron)
4. Approve quotation → Check status change + message
5. Update to In Progress → Check message sent
6. Upload photos → Check photos delivered
7. Complete job → Check invoice + completion message
8. Mark delivered → Check thank you message

Provide test script.
```

**AI akan bagi:**
- Complete test script
- Manual cron trigger commands
- Validation checklist
- Sample outputs

---

## 🔄 PHASE 4: SALES & INVENTORY (Week 7-8)

### **Step 4.1: Product Management**
```
Implement inventory system:

1. Product CRUD endpoints
2. Product listing page with:
   - Search by name/SKU/barcode
   - Category filter
   - Low stock indicator
3. Add/Edit product form
4. Barcode scanner support (optional)
```

**AI akan bagi:**
- Product API routes
- Product pages
- Forms
- Search functionality

---

### **Step 4.2: Stock Movement Tracking**
```
Track all stock changes:

1. When product quantity changes, log in stock_movements
2. Movement types: Purchase, Sale, Adjustment, Job Usage
3. Stock movement history page
4. Low stock alerts
```

**AI akan bagi:**
- Stock tracking logic
- Movement logging
- Alert system
- History view

---

### **Step 4.3: POS Interface**
```
Create the POS transaction page:

1. Product search/scan
2. Add to cart
3. Calculate subtotal, tax, discount, total
4. Multiple payment methods
5. Process payment
6. Generate invoice
7. Deduct stock
8. Print receipt option
9. Send invoice via WhatsApp

Make it fast and intuitive!
```

**AI akan bagi:**
- POS UI component
- Cart logic
- Calculation functions
- Transaction processing
- Receipt template

---

### **Step 4.4: Invoice System**
```
Complete invoice management:

1. Invoice listing (all, paid, unpaid, overdue)
2. Invoice detail view
3. Manual invoice creation
4. Generate PDF
5. Send via WhatsApp/Email
6. Payment recording
7. Outstanding balance tracking
```

**AI akan bagi:**
- Invoice pages
- PDF generation (using puppeteer/pdfkit)
- Payment recording
- Balance calculation

---

### **Step 4.5: Link Jobs to Invoices**
```
Connect repair jobs with invoicing:

1. When job is completed, generate invoice automatically
2. Include:
   - Parts used (from job_parts table)
   - Labor cost
   - Additional charges
3. Link invoice_id to job
4. Show invoice in job detail page
```

**AI akan bagi:**
- Auto-invoice generation
- Parts cost calculation
- Job-invoice linking
- UI updates

---

### **Step 4.6: Test Phase 4**
```
Test complete sales flow:

1. Add products to inventory
2. Create POS sale → Check invoice + stock deduction
3. Create repair job → Complete it → Check auto-invoice
4. Record payment → Check balance updated
5. Generate PDF → Check format
6. Send invoice via WhatsApp → Verify delivery

Provide test data.
```

**AI akan bagi:**
- Test scenarios
- Sample products
- Expected results
- Validation steps

---

## 🔄 PHASE 5: MARKETING (Week 9-10)

### **Step 5.1: Campaign Creation**
```
Build campaign management:

1. Campaign CRUD endpoints
2. Campaign creation page:
   - Name, type (Promotional, Announcement, etc.)
   - Message composer with variables
   - Media upload
   - Target audience builder (filters)
   - Schedule or send now
3. Campaign listing with status
```

**AI akan bagi:**
- Campaign API routes
- Campaign form
- Target builder UI
- Scheduling logic

---

### **Step 5.2: Target Audience Builder**
```
Create flexible filtering system:

1. Filter customers by:
   - Customer type (VIP, Regular, New)
   - Last visit date
   - Total spending
   - Tags
   - Custom combinations
2. Preview target count
3. Save filter presets
```

**AI akan bagi:**
- Filter builder component
- Query builder logic
- Count preview
- Preset system

---

### **Step 5.3: Anti-Ban Implementation**
```
This is CRITICAL! Implement anti-ban as per master prompt:

1. Rate limiting: Max 150 messages/day
2. Random delay: 30-60 seconds between messages
3. Business hours check: Only 9 AM - 6 PM
4. Personalize each message (variable replacement)
5. Session rotation (if multiple)
6. Respect opt-out
7. Handle failures gracefully

Create campaign processor with Bull queue.
```

**AI akan bagi:**
- Anti-ban service
- Rate limiter
- Delay randomizer
- Business hours checker
- Campaign processor
- Failure handler

---

### **Step 5.4: Campaign Execution**
```
Implement campaign sending:

1. Start campaign → Create Bull jobs for each target
2. Process queue with anti-ban rules
3. Track delivery status in real-time
4. Update campaign statistics
5. Pause/Resume functionality
6. Handle failures (retry logic)
```

**AI akan bagi:**
- Campaign starter
- Queue processor
- Status tracker
- Pause/resume logic
- Retry mechanism

---

### **Step 5.5: Campaign Analytics**
```
Show campaign performance:

1. Campaign detail page with:
   - Messages sent/delivered/read
   - Delivery rate
   - Read rate
   - Response tracking
2. Real-time progress bar
3. Failed message list
```

**AI akan bagi:**
- Analytics page
- Real-time updates (Socket.io)
- Charts/graphs
- Export functionality

---

### **Step 5.6: Test Phase 5**
```
Test campaign system carefully:

1. Create campaign with 5 test numbers
2. Start campaign → Monitor sending
3. Check delays are working (30-60s)
4. Verify personalization
5. Test pause/resume
6. Check daily limit enforcement
7. Verify business hours restriction

IMPORTANT: Test with your own numbers first!
```

**AI akan bagi:**
- Safe testing guide
- Test phone numbers setup
- Monitoring commands
- Validation checklist

---

## 🔄 PHASE 6: REPORTS & POLISH (Week 11-12)

### **Step 6.1: Dashboard Widgets**
```
Create real-time dashboard:

1. Stats cards:
   - Today's revenue
   - Pending jobs
   - Active jobs
   - New customers
   - Low stock items
2. Recent activities feed
3. Charts:
   - Sales trend (last 7 days)
   - Job completion rate
   - Customer growth
4. Quick actions buttons

Use Socket.io for real-time updates.
```

**AI akan bagi:**
- Dashboard API endpoints
- Widget components
- Real-time setup
- Chart components (Recharts)

---

### **Step 6.2: Reports System**
```
Create comprehensive reports:

1. Sales Report:
   - Date range filter
   - Revenue, transactions, average sale
   - Payment method breakdown
   - Export to PDF/Excel

2. Job Report:
   - Completion rate
   - Average turnaround time
   - Technician performance
   - Revenue by job type

3. Customer Report:
   - New vs returning
   - Top customers
   - Customer lifetime value
   - Retention rate

4. Inventory Report:
   - Stock levels
   - Stock movement summary
   - Low stock items
   - Product sales ranking

5. WhatsApp Report:
   - Message volume
   - Campaign performance
   - Response rates
   - Customer engagement
```

**AI akan bagi:**
- Report API endpoints
- Report pages with filters
- PDF/Excel export
- Charts and visualizations

---

### **Step 6.3: Settings Pages**
```
Complete all settings:

1. General Settings:
   - Company info
   - Tax rate
   - Currency
   - Business hours
   - Terms & conditions

2. WhatsApp Settings:
   - Connection management
   - Session info
   - Anti-ban configuration
   - Message templates editor

3. AI Settings:
   - OpenAI API key (encrypted)
   - Model selection
   - Parameters (temperature, max tokens)
   - Test connection button

4. User Management:
   - User list
   - Add/Edit users
   - Role assignment
   - Activity logs

5. Backup/Restore:
   - Manual backup button
   - Schedule settings
   - Restore interface
   - Backup history

6. System Info:
   - Version
   - Database status
   - Redis status
   - Disk usage
```

**AI akan bagi:**
- All settings pages
- Form components
- Validation logic
- API endpoints

---

### **Step 6.4: Backup System**
```
Implement backup/restore:

1. Manual backup trigger
2. Automated daily backup (cron)
3. Backup includes:
   - Database dump
   - Uploaded files
   - WhatsApp sessions
4. 30-day retention
5. Restore functionality
6. Download backup file
```

**AI akan bagi:**
- Backup script
- Cron job setup
- Restore logic
- UI components

---

### **Step 6.5: Testing & Bug Fixes**
```
Final testing phase. Help me:

1. Write unit tests for critical functions
2. Integration tests for API endpoints
3. E2E tests for main workflows
4. Performance testing
5. Security audit checklist
6. Fix identified bugs
```

**AI akan bagi:**
- Test files
- Test commands
- Security checklist
- Performance optimization tips
- Bug fix guidance

---

### **Step 6.6: Documentation**
```
Create user documentation:

1. Admin guide:
   - System setup
   - User management
   - Settings configuration
   
2. User guide:
   - Creating jobs
   - Processing quotations
   - Using POS
   - Running campaigns
   
3. Technical documentation:
   - API documentation
   - Database schema
   - Deployment guide
   - Troubleshooting

4. README.md with:
   - Installation steps
   - Environment variables
   - Running the app
   - Common issues
```

**AI akan bagi:**
- Complete documentation
- Markdown files
- Screenshots guide
- Video script ideas

---

## 🚀 DEPLOYMENT

### **Step 7.1: Production Setup**
```
Help me prepare for production:

1. Environment variables for production
2. Docker optimization
3. Nginx configuration
4. SSL certificate setup (Let's Encrypt)
5. Domain configuration
6. Database optimization
7. Redis configuration
8. Security hardening
```

**AI akan bagi:**
- Production configs
- Docker compose production
- Nginx config file
- SSL setup guide
- Security checklist

---

### **Step 7.2: Deploy to Server**
```
Guide me through deployment to:
[Choose: DigitalOcean / AWS / VPS / Local Server]

1. Server requirements
2. Installation steps
3. Database setup
4. Running Docker containers
5. Testing deployment
6. Monitoring setup
```

**AI akan bagi:**
- Step-by-step deployment guide
- Server commands
- Troubleshooting
- Monitoring tools

---

### **Step 7.3: Post-Deployment**
```
After deployment, help me:

1. Initialize WhatsApp session
2. Create admin user
3. Configure settings
4. Add initial data
5. Test all features
6. Setup automated backups
7. Configure monitoring
```

**AI akan bagi:**
- Post-deployment checklist
- Initialization commands
- Test scenarios
- Monitoring setup

---

## 📊 PROGRESS TRACKING

### Throughout Development, Regularly Ask:

```
Current Phase Status Check:

1. What have we completed so far?
2. What's working correctly?
3. What issues did we encounter?
4. What's next on the list?
5. Any blockers or questions?

Please review and advise.
```

---

## 🆘 WHEN YOU NEED HELP

### If Something Breaks:
```
I'm encountering an issue:

Error: [paste error message]

Context:
- What I was doing: [describe]
- What I expected: [describe]
- What happened: [describe]
- Environment: Development/Production
- Phase: [current phase]

Based on the master prompt, how should I fix this?
```

### If You Want to Modify:
```
I want to modify [feature] to add [new functionality].

Current implementation: [describe]
Desired change: [describe]

How should I implement this without breaking existing features?
Please provide code changes needed.
```

### If You're Stuck:
```
I'm stuck on [specific part].

What I've tried:
1. [attempt 1]
2. [attempt 2]

What's not working: [describe]

Based on the master prompt requirements, what's the correct approach?
```

---

## ✅ COMPLETION CHECKLIST

### Before Considering "Done":

```
Phase 1: Foundation
□ Project structure setup
□ Database created and migrated
□ Authentication working
□ Basic UI with login
□ Theme toggle working

Phase 2: Core Features
□ Customer CRUD working
□ Device management working
□ Job creation with QR
□ QR registration flow tested
□ Photo upload working
□ WhatsApp connected
□ Can send/receive messages
□ Message templates created

Phase 3: Automation
□ OpenAI responding correctly
□ Quotation auto-sent
□ Customer approval detected
□ Reminder system working
□ Full workflow tested end-to-end
□ Messages delivered on status changes

Phase 4: Sales & Inventory
□ Products created
□ POS transactions working
□ Stock deducting correctly
□ Invoices generating
□ PDF creation working
□ Payment recording working
□ Auto-invoice from jobs working

Phase 5: Marketing
□ Campaign created
□ Target filtering working
□ Anti-ban delays working
□ Messages sending correctly
□ Daily limit enforced
□ Business hours respected
□ Analytics showing correctly

Phase 6: Reports & Polish
□ Dashboard showing real data
□ All reports working
□ All settings pages complete
□ Backup/restore tested
□ Tests written and passing
□ Documentation complete

Deployment
□ Production environment ready
□ Deployed successfully
□ SSL working
□ WhatsApp connected in prod
□ All features tested in prod
□ Backups automated
□ Monitoring active
```

---

## 🎓 LEARNING RESOURCES

### If You Want to Understand Deeper:

```
I want to learn more about [specific technology/concept].

Can you explain:
1. How it works in this project
2. Best practices
3. Common pitfalls to avoid
4. Resources to learn more

Related to the master prompt requirements.
```

---

## 🔄 ITERATION & IMPROVEMENT

### After Initial Completion:

```
The system is working! Now I want to improve:

Priority improvements:
1. [feature/optimization]
2. [feature/optimization]
3. [feature/optimization]

Based on the master prompt, what's the best approach?
```

---

**Remember**: Development is iterative. Don't rush. Test each phase before moving forward. Ask questions when stuck. The master prompt is your blueprint - refer to it constantly!

**Good luck with your development! 🚀**