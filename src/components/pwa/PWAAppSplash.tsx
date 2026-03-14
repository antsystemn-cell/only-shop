import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { usePwaConfig } from "@/hooks/usePwaConfig";

const isStandaloneMode = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

export function PWAAppSplash() {
  const { data: config } = usePwaConfig();
  const [visible, setVisible] = useState(isStandaloneMode());

  useEffect(() => {
    if (!visible) return;

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [visible]);

  const logoUrl = useMemo(() => {
    const value = config?.logo_url?.trim();
    return value && value.length > 0 ? value : "";
  }, [config?.logo_url]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: config?.bg_color || "hsl(var(--background))" }}
      aria-label="App launch splash"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="size-20 rounded-2xl flex items-center justify-center overflow-hidden border border-border"
          style={{
            backgroundColor: config?.text_color
              ? `${config.text_color}15`
              : "hsl(var(--muted))",
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Only logo" className="size-14 object-contain" />
          ) : (
            <Download className="size-8 text-foreground" />
          )}
        </div>
        <p className="text-sm font-medium text-foreground">Only.mn</p>
      </div>
    </div>
  );
}
