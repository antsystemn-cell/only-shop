import { useProvider, type ProviderFilter } from "@/contexts/ProviderContext";
import { Shield, ShoppingBag, Globe } from "lucide-react";

const PROVIDERS: { value: ProviderFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Бүгд", icon: <Globe className="h-3.5 w-3.5" /> },
  { value: "Poizon", label: "Poizon China", icon: <Shield className="h-3.5 w-3.5" /> },
  { value: "Taobao", label: "Taobao & Tmall", icon: <ShoppingBag className="h-3.5 w-3.5" /> },
];

export function ProviderStrip() {
  const { selectedProvider, setSelectedProvider } = useProvider();

  return (
    <div className="w-full bg-muted/50 border-b">
      <div className="container flex items-center gap-1 py-1.5 overflow-x-auto scrollbar-hide">
        <span className="text-xs text-muted-foreground mr-1 shrink-0">Нийлүүлэгч:</span>
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            onClick={() => setSelectedProvider(p.value)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              selectedProvider === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-card hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
