'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // Show loading animation while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Logo */}
        <motion.div
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 shadow-xl shadow-primary/25"
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Zap className="h-10 w-10 text-white" />
        </motion.div>

        {/* Text */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Bot POS</h1>
          <p className="text-sm text-muted-foreground mt-1">SuperApp</p>
        </div>

        {/* Loading dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              animate={{ y: [-4, 0, -4] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
