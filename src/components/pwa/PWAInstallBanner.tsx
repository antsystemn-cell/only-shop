import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/usePWA';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 7;

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const diff = Date.now() - Number(dismissedAt);
      if (diff < DISMISS_DAYS * 86400000) return;
    }
    setDismissed(false);
  }, []);

  if (isInstalled || !isInstallable || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleInstall = async () => {
    await install();
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 bg-secondary text-secondary-foreground rounded-2xl shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-secondary-foreground/10 flex items-center justify-center">
        <Download className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Only.mn апп суулгах</p>
        <p className="text-xs opacity-80 mt-0.5">Илүү хурдан, илүү тохиромжтой хэрэглээ.</p>
        <button onClick={handleInstall} className="mt-3 text-xs font-semibold px-4 py-1.5 rounded-lg bg-secondary-foreground/20 hover:bg-secondary-foreground/30 transition-colors">
          Суулгах
        </button>
      </div>
      <button onClick={handleDismiss} className="shrink-0 p-1 rounded-full hover:bg-secondary-foreground/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
