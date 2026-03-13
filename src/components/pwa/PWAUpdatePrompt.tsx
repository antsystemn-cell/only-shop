import { usePWAUpdate } from '@/hooks/usePWA';
import { RefreshCw } from 'lucide-react';

export function PWAUpdatePrompt() {
  const { needRefresh, update, dismiss } = usePWAUpdate();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 bg-card border border-border rounded-2xl shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
        <RefreshCw className="h-5 w-5 text-secondary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Шинэ хувилбар бэлэн боллоо</p>
        <p className="text-xs text-muted-foreground mt-0.5">Хамгийн сүүлийн хувилбарыг ашиглахын тулд шинэчлэнэ үү.</p>
        <div className="flex gap-2 mt-3">
          <button onClick={update} className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-secondary text-secondary-foreground">
            Шинэчлэх
          </button>
          <button onClick={dismiss} className="text-xs font-medium px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            Дараа
          </button>
        </div>
      </div>
    </div>
  );
}
