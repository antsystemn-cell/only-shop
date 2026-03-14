import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/usePWA';
import { usePwaConfig } from '@/hooks/usePwaConfig';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const { data: config } = usePwaConfig();
  const [dismissed, setDismissed] = useState(true);

  const dismissDays = config?.dismiss_days ?? 7;
  const DISMISS_KEY = 'pwa-install-dismissed';

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const diff = Date.now() - Number(dismissedAt);
      if (diff < dismissDays * 86400000) return;
    }
    setDismissed(false);
  }, [dismissDays]);

  if (!config || config.enabled === false) return null;
  if (isInstalled || !isInstallable || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleInstall = async () => {
    await install();
    setDismissed(true);
  };

  const radiusMap: Record<string, string> = {
    sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl', '2xl': 'rounded-2xl'
  };
  const radiusClass = radiusMap[config.border_radius] || 'rounded-2xl';

  const positionClasses = {
    bottom: 'fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80',
    top: 'fixed top-4 left-4 right-4 md:left-auto md:right-6 md:w-80',
    center: 'fixed inset-0 flex items-center justify-center bg-black/40 p-4',
  };

  const bannerContent = (
    <div
      className={cn(
        'shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4',
        radiusClass,
        config.position === 'center' ? 'w-full max-w-sm' : ''
      )}
      style={{
        backgroundColor: config.bg_color || 'hsl(var(--secondary))',
        color: config.text_color || 'hsl(var(--secondary-foreground))',
      }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
        style={{
          backgroundColor: config.text_color ? `${config.text_color}15` : 'hsl(var(--secondary-foreground) / 0.1)',
        }}
      >
        {config.logo_url ? (
          <img src={config.logo_url} alt="App logo" className="w-8 h-8 object-contain" />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{config.title}</p>
        <p className="text-xs opacity-80 mt-0.5">{config.subtitle}</p>
        <button
          onClick={handleInstall}
          className="mt-3 text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
          style={{
            backgroundColor: config.button_bg_color || (config.text_color ? `${config.text_color}33` : 'hsl(var(--secondary-foreground) / 0.2)'),
            color: config.button_text_color || 'inherit',
          }}
        >
          {config.button_text}
        </button>
      </div>
      {config.show_close_button && (
        <button onClick={handleDismiss} className="shrink-0 p-1 rounded-full hover:opacity-80">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  if (config.position === 'center') {
    return (
      <div className={cn(positionClasses.center, 'z-50')} onClick={handleDismiss}>
        <div onClick={(e) => e.stopPropagation()}>
          {bannerContent}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(positionClasses[config.position] || positionClasses.bottom, 'z-50')}>
      {bannerContent}
    </div>
  );
}
