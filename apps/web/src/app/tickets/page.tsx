"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import QRCode from 'qrcode';
import AuthGuard from '@/components/auth-guard';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { Ticket, QrCode, Smartphone, UserPlus, X, Download, Copy, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';

type Customer = { id: string; name: string; phone: string };
type Device = { id: string; deviceType: string; model?: string | null; brand?: string | null };
type TicketItem = {
  id: string;
  title: string;
  status: 'PENDING' | 'QUOTED' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  customer: { id: string; name: string; phone?: string };
  device: { id: string; deviceType: string; brand?: string | null; model?: string | null };
  createdAt: string;
  qrToken: string;
  description?: string | null;
};

export default function TicketsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ url: string; image: string; ticket: TicketItem } | null>(null);
  
  // Manual entry form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceBrand, setDeviceBrand] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  
  const toast = useToast();

  // Get PENDING tickets only (new registrations)
  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'pending'],
    queryFn: async () => {
      const tickets = await apiGet<TicketItem[]>('/api/jobs?status=PENDING');
      return tickets;
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      // Create or get customer
      let customerId: string;
      try {
        const customers = await apiGet<Customer[]>(`/api/customers?phone=${encodeURIComponent(customerPhone)}`);
        if (customers && customers.length > 0) {
          customerId = customers[0].id;
        } else {
          const newCustomer = await apiPost<Customer>('/api/customers', {
            name: customerName,
            phone: customerPhone,
          });
          customerId = newCustomer.id;
        }
      } catch {
        const newCustomer = await apiPost<Customer>('/api/customers', {
          name: customerName,
          phone: customerPhone,
        });
        customerId = newCustomer.id;
      }

      // Create device
      const device = await apiPost<Device>('/api/devices', {
        customerId,
        deviceType,
        brand: deviceBrand || undefined,
        model: deviceModel || undefined,
        notes: issueDescription || undefined,
      });

      // Create ticket
      const result = await apiPost<{ job: TicketItem; qr_url: string }>('/api/jobs', {
        customerId,
        deviceId: device.id,
        title: issueTitle || `${deviceType} - ${customerName}`,
        description: issueDescription || undefined,
        priority: 'NORMAL',
      });

      return result;
    },
    onSuccess: async (data) => {
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setDeviceType('');
      setDeviceModel('');
      setDeviceBrand('');
      setIssueTitle('');
      setIssueDescription('');
      
      await qc.invalidateQueries({ queryKey: ['tickets'] });
      
      // Auto-generate QR code
      if (data.job.qrToken) {
        await generateQRCode(data.job, data.qr_url);
      }
      
      toast.success('Ticket created! QR Code generated.');
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Failed to create ticket');
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/api/jobs/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket deleted');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete ticket'),
  });

  const generateQRCode = async (ticket: TicketItem, url?: string) => {
    try {
      const registrationUrl = url || `http://localhost:4000/public/register/index.html?token=${ticket.qrToken}`;
      const qrImage = await QRCode.toDataURL(registrationUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      
      setQrCodeData({
        url: registrationUrl,
        image: qrImage,
        ticket,
      });
      setShowQRModal(true);
    } catch (error) {
      toast.error('Failed to generate QR code');
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeData) return;
    const link = document.createElement('a');
    link.download = `ticket-${qrCodeData.ticket.customer.name}-qr.png`;
    link.href = qrCodeData.image;
    link.click();
    toast.success('QR Code downloaded!');
  };

  const copyLink = () => {
    if (!qrCodeData) return;
    navigator.clipboard.writeText(qrCodeData.url);
    toast.success('Link copied to clipboard!');
  };

  const tickets = ticketsQuery.data || [];

  return (
    <AuthGuard>
      <section className="space-y-6">
        {/* Header */}
        <div className="rounded-xl border bg-gradient-to-br from-purple-900/20 to-blue-900/20 px-6 py-5 shadow-lg backdrop-blur">
          <SectionHeader
            icon={<Ticket className="h-5 w-5" />}
            overline="Registration Portal"
            title="Customer Tickets"
            description="Generate QR codes for customer self-registration or create tickets manually."
          />
        </div>

        {!hasAnyRole(user?.role, ['ADMIN', 'MANAGER', 'TECHNICIAN']) && (
          <div className="rounded-lg border border-amber-400/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            ⚠️ You have read-only access. Contact administrator for permissions.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Registration Methods */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Tab Selector */}
              <div className="flex gap-2 rounded-xl bg-slate-900/60 p-1">
                <button
                  onClick={() => setActiveTab('qr')}
                  className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    activeTab === 'qr'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="mx-auto mb-1 h-5 w-5" />
                  QR Code
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    activeTab === 'manual'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="mx-auto mb-1 h-5 w-5" />
                  Manual Entry
                </button>
              </div>

              {/* QR Code Creation */}
              {activeTab === 'qr' && (
                <div className="animate-in slide-in-from-left rounded-xl border border-slate-800/70 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-6 shadow-xl backdrop-blur">
                  <div className="mb-4 flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20">
                    <QrCode className="h-16 w-16 text-purple-400" />
                  </div>
                  
                  <h3 className="mb-2 text-lg font-bold text-slate-50">Quick QR Registration</h3>
                  <p className="mb-4 text-sm text-slate-400">
                    Create a ticket and instantly generate a QR code for customer to scan and complete their registration.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createTicketMutation.mutate();
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <input
                        type="text"
                        placeholder="Customer Name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="Phone (e.g., 0123456789)"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        required
                      />
                    </div>
                    <div>
                      <select
                        value={deviceType}
                        onChange={(e) => setDeviceType(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        required
                      >
                        <option value="">Select Device Type</option>
                        <option value="laptop">Laptop</option>
                        <option value="desktop">Desktop/PC</option>
                        <option value="printer">Printer</option>
                        <option value="phone">Phone</option>
                        <option value="tablet">Tablet</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30"
                      disabled={createTicketMutation.isPending}
                    >
                      {createTicketMutation.isPending ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <QrCode className="mr-2 h-4 w-4" />
                          Generate QR Code
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="mt-4 rounded-lg bg-blue-900/20 border border-blue-500/20 p-3">
                    <p className="text-xs text-blue-300">
                      💡 <strong>How it works:</strong> Customer will scan the QR code and complete their device details on their phone.
                    </p>
                  </div>
                </div>
              )}

              {/* Manual Entry */}
              {activeTab === 'manual' && (
                <div className="animate-in slide-in-from-right rounded-xl border border-slate-800/70 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-6 shadow-xl backdrop-blur">
                  <h3 className="mb-4 text-lg font-bold text-slate-50">Manual Ticket Entry</h3>
                  
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createTicketMutation.mutate();
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">Customer Name</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">Phone Number</label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">Device Type</label>
                      <select
                        value={deviceType}
                        onChange={(e) => setDeviceType(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        required
                      >
                        <option value="">Select Type</option>
                        <option value="laptop">Laptop</option>
                        <option value="desktop">Desktop/PC</option>
                        <option value="printer">Printer</option>
                        <option value="phone">Phone</option>
                        <option value="tablet">Tablet</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">Brand</label>
                        <input
                          type="text"
                          value={deviceBrand}
                          onChange={(e) => setDeviceBrand(e.target.value)}
                          placeholder="e.g., HP"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">Model</label>
                        <input
                          type="text"
                          value={deviceModel}
                          onChange={(e) => setDeviceModel(e.target.value)}
                          placeholder="e.g., Pavilion"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">Issue Title</label>
                      <input
                        type="text"
                        value={issueTitle}
                        onChange={(e) => setIssueTitle(e.target.value)}
                        placeholder="e.g., Screen not working"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
                      <textarea
                        value={issueDescription}
                        onChange={(e) => setIssueDescription(e.target.value)}
                        rows={3}
                        placeholder="Describe the issue..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                      disabled={createTicketMutation.isPending}
                    >
                      {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Right: Pending Tickets List */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 shadow-xl backdrop-blur">
              <div className="border-b border-slate-800/70 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-50">Pending Registrations</h2>
                    <p className="text-sm text-slate-400">New tickets waiting for customer completion</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-purple-900/20 border border-purple-500/20 px-3 py-1.5">
                    <Clock className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-semibold text-purple-300">{tickets.length} Pending</span>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-800/50">
                {ticketsQuery.isLoading ? (
                  <div className="p-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
                    <p className="mt-3 text-sm text-slate-400">Loading tickets...</p>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20">
                      <Ticket className="h-10 w-10 text-purple-400" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-100">No Pending Tickets</h3>
                    <p className="mb-4 text-sm text-slate-400">
                      Create a new ticket to get started with customer registration.
                    </p>
                  </div>
                ) : (
                  tickets.map((ticket, idx) => (
                    <div
                      key={ticket.id}
                      className="group p-6 transition hover:bg-slate-900/50"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="mb-3 flex items-start justify-between">
                            <div>
                              <h3 className="mb-1 font-semibold text-slate-50">{ticket.title}</h3>
                              <div className="flex items-center gap-3 text-sm text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Smartphone className="h-3 w-3" />
                                  {ticket.customer.name}
                                </span>
                                <span>•</span>
                                <span>{ticket.device.deviceType}</span>
                                {ticket.device.brand && <span>• {ticket.device.brand}</span>}
                              </div>
                            </div>
                            <span className="rounded-full bg-amber-900/20 border border-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300">
                              Awaiting Registration
                            </span>
                          </div>

                          {ticket.description && (
                            <p className="mb-3 text-sm text-slate-500">{ticket.description}</p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generateQRCode(ticket)}
                              className="border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-900/20"
                            >
                              <QrCode className="mr-1.5 h-3.5 w-3.5" />
                              Show QR
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const url = `http://localhost:4000/public/register/index.html?token=${ticket.qrToken}`;
                                navigator.clipboard.writeText(url);
                                toast.success('Link copied!');
                              }}
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              Copy Link
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                            >
                              <Link href={`/jobs/${ticket.id}`}>View Details</Link>
                            </Button>
                          </div>
                        </div>

                        {hasAnyRole(user?.role, ['ADMIN', 'MANAGER']) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteTicketMutation.mutate(ticket.id)}
                            disabled={deleteTicketMutation.isPending}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQRModal && qrCodeData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg animate-in zoom-in slide-in-from-bottom-4 rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl">
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setQrCodeData(null);
                }}
                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/50">
                  <QrCode className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-50">Scan to Register</h2>
                <p className="mt-1 text-sm text-slate-400">Customer can scan this QR code with their phone</p>
              </div>

              <div className="mb-6 flex justify-center rounded-2xl bg-white p-6 shadow-inner">
                <img src={qrCodeData.image} alt="QR Code" className="h-auto w-full max-w-[300px]" />
              </div>

              <div className="mb-6 space-y-3 rounded-lg border border-slate-800/70 bg-slate-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Customer</span>
                  <span className="text-sm font-semibold text-slate-100">{qrCodeData.ticket.customer.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Device</span>
                  <span className="text-sm text-slate-300">
                    {[qrCodeData.ticket.device.deviceType, qrCodeData.ticket.device.brand, qrCodeData.ticket.device.model]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Valid Until</span>
                  <span className="text-sm text-emerald-400">7 days</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  onClick={downloadQRCode}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download QR
                </Button>
                <Button
                  variant="outline"
                  onClick={copyLink}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AuthGuard>
  );
}
