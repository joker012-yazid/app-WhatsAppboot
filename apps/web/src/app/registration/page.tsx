"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import AuthGuard from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { QrCode, Download, Copy, RefreshCw, Share2, Smartphone } from 'lucide-react';

export default function RegistrationPage() {
  const toast = useToast();
  const [qrImage, setQrImage] = useState<string>('');
  const [registrationUrl, setRegistrationUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    generateQRCode();
  }, []);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      // Use NEXT_PUBLIC_REGISTRATION_BASE_URL if available, otherwise fallback to old behavior
      const baseUrl = process.env.NEXT_PUBLIC_REGISTRATION_BASE_URL ||
        (typeof window !== 'undefined'
          ? `${window.location.protocol}//${window.location.hostname}:4000`
          : 'http://localhost:4000');

      const url = `${baseUrl}/public/register/index.html`;
      setRegistrationUrl(url);

      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 350,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });

      setQrImage(qrDataUrl);
    } catch (error) {
      toast.error('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrImage) return;
    const link = document.createElement('a');
    link.download = `customer-registration-qr.png`;
    link.href = qrImage;
    link.click();
    toast.success('QR Code downloaded!');
  };

  const copyLink = () => {
    if (!registrationUrl) return;

    // Simple fallback method that works everywhere
    const textArea = document.createElement('textarea');
    textArea.value = registrationUrl;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        toast.success('Link copied! Share via WhatsApp.');
      } else {
        toast.error('Copy failed. Please select and copy the link manually.');
      }
    } catch (err) {
      document.body.removeChild(textArea);
      toast.error('Copy failed. Please select and copy the link manually.');
    }
  };

  const shareViaWhatsApp = () => {
    if (!registrationUrl) return;
    const message = encodeURIComponent(`Sila scan QR atau klik link ini untuk daftar device anda: ${registrationUrl}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <AuthGuard>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30 mb-4"
            >
              <QrCode className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Customer Registration</h1>
            <p className="text-muted-foreground">
              Scan QR code untuk daftar customer baru
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card/80 backdrop-blur-lg shadow-2xl overflow-hidden"
          >
            <div className="p-8 bg-gradient-to-br from-purple-900/10 to-blue-900/10">
              <div className="flex justify-center">
                {isGenerating ? (
                  <div className="w-[350px] h-[350px] flex items-center justify-center bg-muted/50 rounded-2xl">
                    <RefreshCw className="h-12 w-12 text-muted-foreground animate-spin" />
                  </div>
                ) : qrImage ? (
                  <motion.div
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="bg-card p-4 rounded-2xl shadow-inner border border-border"
                  >
                    <img
                      src={qrImage}
                      alt="Registration QR Code"
                      className="w-[320px] h-[320px]"
                    />
                  </motion.div>
                ) : (
                  <div className="w-[350px] h-[350px] flex items-center justify-center bg-muted/50 rounded-2xl">
                    <p className="text-muted-foreground">QR Code tidak tersedia</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-6 border-t border-border/50">
              <h3 className="font-semibold text-foreground mb-4 text-center">Cara Penggunaan</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 font-semibold">1</div>
                  <p className="text-muted-foreground">Customer scan QR code menggunakan telefon</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 font-semibold">2</div>
                  <p className="text-muted-foreground">Isi maklumat dalam form pendaftaran</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 text-green-400 font-semibold">3</div>
                  <p className="text-muted-foreground">Submit dan pendaftaran selesai!</p>
                </div>
              </div>
            </div>

            {/* LINK DISPLAY - CLICK TO SELECT ALL */}
            {registrationUrl && (
              <div className="px-8 pb-6">
                <label className="text-xs font-semibold text-foreground mb-2 block uppercase tracking-wide">
                  Registration Link - Klik untuk select & copy:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={registrationUrl}
                    readOnly
                    onClick={(e) => {
                      e.currentTarget.select();
                      toast.success('Link selected! Tekan Ctrl+C atau Cmd+C untuk copy.');
                    }}
                    className="w-full px-4 py-3 bg-muted/70 border-2 border-primary/30 rounded-lg text-sm text-foreground font-mono cursor-pointer hover:bg-muted hover:border-primary/50 transition-all select-all focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  👆 Klik pada link di atas, kemudian tekan <kbd className="px-2 py-1 bg-muted rounded">Ctrl+C</kbd> untuk copy
                </p>
              </div>
            )}

            <div className="px-8 pb-8">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={downloadQRCode}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/20"
                  disabled={!qrImage}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download QR
                </Button>
                <Button
                  variant="outline"
                  onClick={copyLink}
                  disabled={!registrationUrl}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={shareViaWhatsApp}
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500/50"
                  disabled={!registrationUrl}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={generateQRCode}
                  disabled={isGenerating}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Refresh QR
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"
          >
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-300">Tips</p>
                <p className="text-xs text-blue-300/70 mt-1">
                  Cetak QR code ini dan letak di kaunter untuk customer walk-in scan.
                  Atau share link melalui WhatsApp untuk customer yang tidak di kedai.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </AuthGuard>
  );
}
