import { RefreshCw } from "lucide-react";
import { usePWAUpdate } from "@/hooks/usePWA";
import { usePwaConfig } from "@/hooks/usePwaConfig";
import { cn } from "@/lib/utils";

export function PWAUpdatePrompt() {
  const { needRefresh, update, dismiss, isStandalone, isUpdating } = usePWAUpdate();
  const { data: config } = usePwaConfig();

  if (!config?.update_enabled || !isStandalone || !needRefresh) return null;

  const radiusMap: Record<string, string> = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
  };
  const radiusClass = radiusMap[config.border_radius] || "rounded-2xl";

  const positionClasses = {
    bottom: "fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80",
    top: "fixed top-4 left-4 right-4 md:left-auto md:right-6 md:w-80",
    center: "fixed inset-0 flex items-center justify-center bg-background/80 p-4",
  };

  const promptContent = (
    <div
      className={cn(
        "border border-border shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4",
        radiusClass,
        config.update_position === "center" ? "w-full max-w-sm" : ""
      )}
      style={{
        backgroundColor: config.bg_color || "hsl(var(--card))",
        color: config.text_color || "hsl(var(--card-foreground))",
      }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          backgroundColor: config.text_color
            ? `${config.text_color}15`
            : "hsl(var(--muted))",
        }}
      >
        <RefreshCw className={cn("h-5 w-5", isUpdating && "animate-spin")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{config.update_title}</p>
        <p className="text-xs opacity-80 mt-0.5">{config.update_subtitle}</p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={update}
            disabled={isUpdating}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-70"
            style={{
              backgroundColor:
                config.button_bg_color ||
                (config.text_color
                  ? `${config.text_color}33`
                  : "hsl(var(--secondary))"),
              color: config.button_text_color || "inherit",
            }}
          >
            {isUpdating ? "Шинэчилж байна..." : config.update_button_text}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={isUpdating}
            className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-muted disabled:opacity-70"
          >
            {config.update_later_text}
          </button>
        </div>
      </div>
    </div>
  );

  if (config.update_position === "center") {
    return (
      <div className={cn(positionClasses.center, "z-50")}>{promptContent}</div>
    );
  }

  return (
    <div className={cn(positionClasses[config.update_position] || positionClasses.bottom, "z-50")}>
      {promptContent}
    </div>
  );
}
