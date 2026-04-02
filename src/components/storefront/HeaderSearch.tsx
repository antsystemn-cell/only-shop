import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderSearchProps {
  className?: string;
  autoFocus?: boolean;
  onSearchComplete?: () => void;
}

export default function HeaderSearch({ className, autoFocus, onSearchComplete }: HeaderSearchProps) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = searchInput.trim();
    if (!text) return;
    navigate(`/shop?q=${encodeURIComponent(text)}`);
    onSearchComplete?.();
  };

  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={handleSearch} className="flex items-center gap-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Бараа хайх..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 pr-3 rounded-r-none h-10 bg-muted/50"
            autoFocus={autoFocus}
          />
        </div>
        <Button type="submit" className="shrink-0 rounded-l-none h-10 px-4">
          <Search className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline text-sm">Хайх</span>
        </Button>
      </form>
    </div>
  );
}
