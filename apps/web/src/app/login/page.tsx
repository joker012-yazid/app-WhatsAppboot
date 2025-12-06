'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Zap,
  Shield,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from 'lucide-react';

import { AnimatedButton } from '@/components/ui/animated-button';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: 'WhatsApp Automation',
    description: 'Automate customer communications with smart templates',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Real-time Analytics',
    description: 'Track performance metrics and business insights',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Secure & Reliable',
    description: 'Enterprise-grade security for your data',
  },
];

export default function LoginPage() {
  const { login, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason) {
      setError(reason);
      toast.error(reason);
    }
  }, [searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      setSuccess(true);
      toast.success('Welcome back! Redirecting...', {
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
      
      // Delay for animation
      setTimeout(() => {
        router.replace('/dashboard');
      }, 1000);
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <motion.div
        className="flex-1 flex items-center justify-center p-6 md:p-12"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full max-w-md">
          {/* Logo */}
          <motion.div
            className="flex items-center gap-3 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-lg shadow-primary/25">
              <Zap className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">SuperApp</h1>
              <p className="text-xs text-muted-foreground">WhatsApp Bot POS</p>
            </div>
          </motion.div>

          {/* Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-3xl font-bold text-foreground mb-2">Welcome back</h2>
            <p className="text-muted-foreground">
              Sign in to your account to continue managing your business
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={onSubmit}
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email Address
              </label>
              <motion.input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  'w-full rounded-lg border bg-card px-4 py-3 text-sm transition-all duration-200',
                  'placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  error ? 'border-destructive' : 'border-border'
                )}
                placeholder="Enter your email"
                autoComplete="username"
                required
                whileFocus={{ scale: 1.01 }}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  Password
                </label>
                <Link
                  href="#"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <motion.input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border bg-card px-4 py-3 pr-12 text-sm transition-all duration-200',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                    error ? 'border-destructive' : 'border-border'
                  )}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  whileFocus={{ scale: 1.01 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={showPassword ? 'hide' : 'show'}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </button>
              </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <AnimatedButton
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={submitting || loading || success}
              loading={submitting}
              loadingText="Signing in..."
              rightIcon={!submitting && !success && <ArrowRight className="h-4 w-4" />}
            >
              {success ? (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Success!
                </motion.div>
              ) : (
                'Sign In'
              )}
            </AnimatedButton>
          </motion.form>

          {/* Footer */}
          <motion.p
            className="mt-8 text-center text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Need help?{' '}
            <Link
              href="/docs/roadmap"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Read the documentation
            </Link>
          </motion.p>
        </div>
      </motion.div>

      {/* Right Panel - Decorative */}
      <motion.div
        className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary/20 via-card to-purple-500/20"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute bottom-20 right-20 h-96 w-96 rounded-full bg-purple-500/30 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        </div>

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center p-12 max-w-lg mx-auto">
          {/* Features */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, staggerChildren: 0.1 }}
          >
            <h3 className="text-2xl font-bold text-foreground mb-8">
              Everything you need to manage your business
            </h3>

            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="flex items-start gap-4 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                whileHover={{ scale: 1.02, x: 5 }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            className="mt-12 grid grid-cols-3 gap-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            {[
              { value: '10K+', label: 'Messages Sent' },
              { value: '500+', label: 'Active Users' },
              { value: '99.9%', label: 'Uptime' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.1 + index * 0.1 }}
              >
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
