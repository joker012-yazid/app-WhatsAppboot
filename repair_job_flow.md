# Flow Kerja Repair Laptop (Check-In → Progress → Close)

## Objektif
- Satu Job Ticket = rekod lengkap pelanggan + device + kerja.
- Customer nampak status + ETA + timeline (ringkas).
- Technician guna task checklist + audit trail.

---

## Data Wajib
### Customer
- Nama, No. WhatsApp, Email (optional), pilihan channel update

### Device
- Jenama/Model, Serial No, Aksesori diterima, Keadaan fizikal (gambar)
- Aduan/simptom + bila berlaku + apa yang dah dicuba
- Password (jika perlu) / pilihan “customer hadir semasa login”
- Backup diminta? (Ya/Tidak)

### Job
- Job ID, tarikh masuk, prioriti, ETA awal, deposit (jika ada)
- Status semasa, timeline event, task list, quote/approval record

### Parts (Jika perlu)
- Part name/sku, vendor, harga, status (ordered/arrived/installed), ETA

---

## Status Lifecycle (Customer-Facing)
1. Checked-In
2. Diagnosing
3. Awaiting Approval
4. Waiting for Parts
5. In Repair
6. Testing / QA
7. Ready for Pickup
8. Closed

## Status Dalaman (Optional)
- Queued / Not Started
- Escalated
- Unrepairable / Customer Declined
- No Show / Storage Fee

---

## Flow (Mermaid)
```mermaid
flowchart TD
  A[Customer Drop-Off] --> B[Create Job Ticket + Check-In]
  B --> C[Triage Quick Check]
  C --> D[Diagnosing Tasks]
  D --> E{Perlu Parts / Kos tambahan?}
  E -- Tidak --> F[Repair Tasks]
  E -- Ya --> G[Send Quote + Await Approval]
  G --> H{Approve?}
  H -- Ya --> I[Order Parts]
  I --> J[Parts Arrived + Install]
  J --> F
  H -- Tidak --> X[Close as Declined / Return Device]
  F --> K[Testing / QA]
  K --> L[Ready for Pickup + Invoice]
  L --> M[Payment + Handover]
  M --> N[Close Ticket + Warranty Follow-up]
