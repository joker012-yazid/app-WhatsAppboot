# Spesifikasi Aplikasi - WhatsApp Bot & CRM System

## Tech Stack
- **Frontend**: Next.js
- **Backend**: Node.js
- **Container**: Docker Compose
- **WhatsApp**: Baileys Library
- **AI**: OpenAI API

---

## 1. WhatsApp Chat with AI

### Fungsi Utama
- Auto-reply menggunakan AI untuk soalan customer
- Detect jika maklumat tiada dalam database
- Fallback kepada teknisi jika AI tak dapat jawab

### Features
- **QR Code Scanner Integration**
  - Generate QR untuk customer scan
  - Auto-capture customer data (Nama, No Tel, Jenis Barang, Model)
  
- **AI Response System**
  - OpenAI integration untuk jawab soalan umum
  - Context-aware replies berdasarkan database
  - Fallback message: "Tunggu sebentar, teknisi kami akan melayan anda"

- **Message Templates**
  - Terima kasih message
  - Update status repair
  - Quotation message
  - Invoice message
  - Reminder messages
  - Review request

- **Technician Prompt System**
  - Tech boleh input diagnosis & harga
  - Tech boleh upload gambar progress repair
  - Tech boleh update status (sedang repair/siap)
  - Tech boleh trigger invoice

- **Customer Confirmation Flow**
  - Hantar quotation dan tunggu confirmation
  - Track customer response (Setuju/Tak Setuju)
  - Auto-route berdasarkan jawapan

- **Smart Reminder System**
  - Day 1: Reminder pertama jika tak respond
  - Day 20: Reminder kedua
  - Day 30: Reminder ketiga

### Data Yang Disimpan
- Chat history dengan customer
- Customer response status
- Timestamp setiap interaction
- AI conversation context

---

## 2. WhatsApp Blaster with Anti-Ban

### Fungsi Utama
- Mass messaging untuk promosi/announcement
- Anti-ban mechanism untuk keselamatan akaun

### Anti-Ban Features
- **Random Delay System**
  - Delay 30-60 saat antara setiap message
  - Random interval untuk nampak human-like
  
- **Daily Limit Control**
  - Max 100-150 messages per hari
  - Auto-stop bila limit tercapai
  
- **Message Variation**
  - Support dynamic fields (nama, model, etc)
  - Personalized content untuk setiap customer
  
- **Safe Hours**
  - Hantar message dalam business hours sahaja (9am-6pm)
  - Skip weekend jika perlu
  
- **Session Management**
  - Multiple session support
  - Auto-reconnect jika disconnect

### Campaign Features
- **Create Campaign**
  - Set campaign name & description
  - Choose target audience dari database
  - Schedule broadcast time
  - Preview message sebelum send
  
- **Message Builder**
  - Rich text support
  - Image/media attachment
  - Dynamic variables {nama}, {model}, etc
  - Template library
  
- **Filtering System**
  - Filter by customer type
  - Filter by last visit date
  - Filter by purchase history
  - Custom tags/categories

- **Tracking & Analytics**
  - Messages sent count
  - Delivery status
  - Read receipts
  - Response rate

### Safety Controls
- Blacklist management (customer yang tak nak receive)
- Opt-out link automatic
- Status monitoring (online/offline)
- Emergency stop button

---

## 3. POS System

### Fungsi Utama
- Complete sales transaction management
- Inventory tracking
- Invoice & quotation generation

### Core Features
- **Sales Transaction**
  - Quick product search
  - Barcode scanner support
  - Multiple payment methods (Cash, Card, E-wallet, Credit)
  - Split payment option
  - Discount & promotion application
  
- **Invoice Management**
  - Auto-generate invoice number
  - PDF invoice generation
  - Email/WhatsApp invoice to customer
  - Print invoice
  - Invoice template customization
  
- **Quotation System**
  - Create quotation for repairs
  - Convert quotation to invoice
  - Quotation expiry date
  - Follow-up reminder untuk pending quotations
  
- **Product/Service Catalog**
  - Product listing dengan images
  - Service listing (repair types)
  - Category & subcategory
  - Pricing tiers
  - Stock-keeping unit (SKU)

### Inventory Features
- **Stock Management**
  - Real-time stock levels
  - Low stock alerts
  - Stock movement history
  - Supplier management
  
- **Purchase Orders**
  - Create PO to suppliers
  - Track deliveries
  - Auto-update stock upon receiving
  
- **Stock Adjustment**
  - Manual adjustment dengan reason
  - Audit trail untuk all changes
  - Stock take functionality

### Repair Job Management
- **Job Tracking**
  - Job status (Pending, In Progress, Completed, Delivered)
  - Assign to technician
  - Priority levels
  - Estimated completion date
  
- **Parts & Labor**
  - Track parts used
  - Labor hours tracking
  - Cost calculation
  
- **Photo Documentation**
  - Before photos
  - During repair photos
  - After completion photos

### Reporting
- Daily sales report
- Monthly revenue
- Best-selling products/services
- Technician performance
- Profit margin analysis

---

## 4. Database CRM

### Database Choice
**PostgreSQL** (Recommended)
- Reliable & proven
- Support complex queries
- Easy backup & restore
- Good performance
- Open source

**Alternative: SQLite** untuk aplikasi yang lebih kecil

### Schema Structure

#### Customer Table
- customer_id (PK)
- nama
- no_telefon
- email
- alamat
- date_registered
- total_visits
- total_spending
- customer_type (VIP, Regular, New)
- tags/categories
- opt_in_marketing (boolean)

#### Device/Product Table
- device_id (PK)
- customer_id (FK)
- jenis_barang (Laptop, PC, Printer, etc)
- brand
- model
- serial_number
- purchase_date
- warranty_status

#### Job/Repair Table
- job_id (PK)
- customer_id (FK)
- device_id (FK)
- technician_id (FK)
- date_received
- problem_description
- diagnosis
- repair_cost
- status (Pending Quote, Approved, In Progress, Completed, Delivered, Cancelled)
- priority
- estimated_completion
- actual_completion
- notes

#### Invoice Table
- invoice_id (PK)
- job_id (FK)
- customer_id (FK)
- invoice_number
- invoice_date
- due_date
- subtotal
- tax
- discount
- total_amount
- payment_status (Unpaid, Partial, Paid)
- payment_method

#### Payment Table
- payment_id (PK)
- invoice_id (FK)
- payment_date
- amount
- payment_method
- reference_number

#### Inventory Table
- inventory_id (PK)
- product_name
- sku
- category
- quantity_on_hand
- reorder_level
- unit_cost
- selling_price
- supplier_id (FK)

#### WhatsApp Message Log
- message_id (PK)
- customer_id (FK)
- message_type (Outgoing, Incoming)
- message_content
- timestamp
- delivery_status
- read_status
- campaign_id (FK, nullable)

#### Campaign Table
- campaign_id (PK)
- campaign_name
- message_template
- target_audience
- scheduled_date
- status (Draft, Scheduled, Running, Completed)
- total_sent
- total_delivered
- total_read

### Backup Strategy
- Daily automated backup
- Weekly full backup
- 30 days retention
- Export to external storage (Google Drive/Dropbox integration)
- One-click restore functionality

### Data Maintenance
- Archive old records (>2 years)
- Database optimization scheduler
- Audit logs untuk critical operations
- Data encryption untuk sensitive info

---

## 5. Web UI

### Design Framework
**Recommended**: Shadcn/ui + Tailwind CSS + Next.js
- Modern & clean
- Component-based
- Highly customizable
- Responsive

### Theme System
- **Light Mode**: Default clean white theme
- **Dark Mode**: Eye-friendly dark theme
- **Auto Theme**: Based on system preference
- **Custom Themes**: User can create own color scheme

### Main Dashboard
- **Quick Stats Cards**
  - Today's revenue
  - Pending jobs
  - Completed jobs
  - New customers
  
- **Recent Activities**
  - Latest WhatsApp messages
  - Recent transactions
  - Pending quotations
  
- **Quick Actions**
  - New job entry
  - Send broadcast
  - Create invoice
  - Check inventory

### Navigation Structure
```
├── Dashboard
├── WhatsApp Management
│   ├── Conversations
│   ├── Broadcast Campaigns
│   ├── Message Templates
│   └── Chat Settings
├── Sales & POS
│   ├── New Sale
│   ├── Invoices
│   ├── Quotations
│   └── Payment Records
├── Repair Jobs
│   ├── All Jobs
│   ├── Pending
│   ├── In Progress
│   └── Completed
├── Customers
│   ├── Customer List
│   ├── Add New Customer
│   └── Customer Groups
├── Inventory
│   ├── Products
│   ├── Stock Management
│   ├── Purchase Orders
│   └── Suppliers
├── Reports
│   ├── Sales Reports
│   ├── Inventory Reports
│   ├── Customer Reports
│   └── WhatsApp Analytics
└── Settings
    ├── General Settings
    ├── WhatsApp Configuration
    ├── AI Settings (OpenAI API)
    ├── Invoice/Quotation Templates
    ├── User Management
    ├── Backup & Restore
    ├── System Updates
    └── Theme Customization
```

### Key UI Features
- **Responsive Design**
  - Desktop optimized
  - Tablet support
  - Mobile-friendly
  
- **Real-time Updates**
  - Live WhatsApp message notifications
  - Real-time job status updates
  - Socket.io integration
  
- **Search & Filter**
  - Global search bar
  - Advanced filtering options
  - Saved filter presets
  
- **Data Tables**
  - Sortable columns
  - Pagination
  - Export to CSV/Excel/PDF
  - Bulk actions
  
- **Form Validation**
  - Client-side validation
  - Error messages yang clear
  - Required field indicators
  
- **Keyboard Shortcuts**
  - Quick navigation (Ctrl+K for search)
  - Quick actions
  - Accessibility features

### Settings Page
- **WhatsApp Settings**
  - Connect/disconnect device
  - QR code display
  - Session management
  - Anti-ban configuration
  
- **AI Settings**
  - OpenAI API key management
  - AI prompt customization
  - Fallback message settings
  
- **Business Settings**
  - Company info
  - Tax rates
  - Currency
  - Business hours
  
- **Template Editor**
  - Invoice template design
  - Message template editor
  - Email template editor
  
- **User Management**
  - Add/remove users
  - Role-based access (Admin, Technician, Cashier)
  - Activity logs
  
- **System Maintenance**
  - Database backup now
  - Restore from backup
  - Clear cache
  - View system logs
  
- **Update Management**
  - Check for updates
  - Update history
  - Release notes
  - One-click update

### Accessibility
- WCAG 2.1 compliant
- Keyboard navigation
- Screen reader support
- High contrast mode option

---

## Integration Flow

### WhatsApp ↔ CRM
- Auto-create customer profile dari WhatsApp
- Link messages kepada customer record
- Trigger notifications based on CRM events

### POS ↔ WhatsApp
- Send invoice via WhatsApp automatically
- Payment confirmation via WhatsApp
- Delivery updates

### AI ↔ Database
- AI query customer history untuk personalized response
- AI access product info untuk answer queries
- AI suggest upsells based on history

### Inventory ↔ POS
- Real-time stock deduction
- Auto-alert bila stock low
- Prevent sale bila out of stock

---

## Security Features
- User authentication & authorization
- API key encryption
- Rate limiting
- SQL injection prevention
- XSS protection
- CORS configuration
- Regular security updates

---

## Deployment
- Docker Compose untuk easy setup
- Environment variables untuk sensitive data
- Nginx reverse proxy
- SSL certificate support
- Auto-restart on failure
- Log rotation

---

## Performance Optimization
- Database indexing
- Query optimization
- Image compression
- Lazy loading
- Caching strategy
- CDN untuk static assets