import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Download, Eye, Package, FlaskConical } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SearchResult {
  asin: string;
  title: string;
  brand?: string;
  mainImage?: string;
  browseClassification?: string;
  marketplace?: string;
}

export default function AmazonImport() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("keyword");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [lastSearchSandbox, setLastSearchSandbox] = useState(false);

  const { data: serverConfig } = useQuery({
    queryKey: ["amazon-config"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("amazon-api", { body: { action: "getConfig" } });
      return data;
    },
  });

  const { data: marketplaces } = useQuery({
    queryKey: ["amazon-marketplaces-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_marketplaces")
        .select("*")
        .eq("is_enabled", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const [marketplace, setMarketplace] = useState("");
  const isSandbox = serverConfig?.sandbox === true;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("amazon-api", {
        body: {
          action: "searchCatalog",
          params: {
            query: searchQuery,
            searchType,
            marketplaceId: marketplace || marketplaces?.[0]?.marketplace_id,
          },
        },
      });
      if (error) throw error;
      setResults(data?.items || []);
      setLastSearchSandbox(data?.sandbox === true);
      if (!data?.items?.length) toast({ title: "Бараа олдсонгүй" });
    } catch (e: any) {
      toast({ title: "Хайлтын алдаа", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const asins = Array.from(selected);
      const { data, error } = await supabase.functions.invoke("amazon-api", {
        body: {
          action: "importProducts",
          params: { asins, marketplaceId: marketplace || marketplaces?.[0]?.marketplace_id },
        },
      });
      if (error) throw error;
      toast({ title: "Импорт амжилттай", description: `${data?.imported || 0} бараа импортлогдлоо` });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["amazon-products"] });
    } catch (e: any) {
      toast({ title: "Импортын алдаа", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = (asin: string) => {
    const next = new Set(selected);
    if (next.has(asin)) next.delete(asin); else next.add(asin);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((r) => r.asin)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Amazon бараа импорт</h1>
          <p className="text-muted-foreground">Amazon каталогоос бараа хайж, импортлох</p>
        </div>
        {isSandbox && (
          <Badge variant="secondary">
            <FlaskConical className="h-3 w-3 mr-1" /> Sandbox
          </Badge>
        )}
      </div>

      {isSandbox && (
        <Card className="border-secondary/40 bg-secondary/10">
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <FlaskConical className="h-4 w-4" />
            Sandbox горимд тест бараанууд буцаагдана. Бодит Amazon каталог биш.
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Хайлт</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Хайлтын төрөл</Label>
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Түлхүүр үг</SelectItem>
                  <SelectItem value="asin">ASIN</SelectItem>
                  <SelectItem value="upc">UPC/EAN</SelectItem>
                  <SelectItem value="brand">Брэнд</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Хайлтын утга</Label>
              <Input
                placeholder={isSandbox ? "sandbox, headphones, cable..." : (searchType === "asin" ? "B08N5WRWNW" : "wireless headphones...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label>Marketplace</Label>
              <Select value={marketplace} onValueChange={setMarketplace}>
                <SelectTrigger><SelectValue placeholder="Сонгох" /></SelectTrigger>
                <SelectContent>
                  {marketplaces?.map((mp) => (
                    <SelectItem key={mp.marketplace_id} value={mp.marketplace_id}>{mp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Хайх
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Үр дүн ({results.length})
                {lastSearchSandbox && <Badge variant="outline" className="ml-2 text-amber-600 border-amber-500">Sandbox data</Badge>}
              </CardTitle>
              <Button onClick={handleImport} disabled={importing || selected.size === 0}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {selected.size} бараа импортлох
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selected.size === results.length && results.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Зураг</TableHead>
                  <TableHead>Нэр</TableHead>
                  <TableHead>ASIN</TableHead>
                  <TableHead>Брэнд</TableHead>
                  <TableHead>Ангилал</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((item) => (
                  <TableRow key={item.asin}>
                    <TableCell>
                      <Checkbox checked={selected.has(item.asin)} onCheckedChange={() => toggleSelect(item.asin)} />
                    </TableCell>
                    <TableCell>
                      {item.mainImage ? (
                        <img src={item.mainImage} alt="" className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">{item.title}</TableCell>
                    <TableCell><Badge variant="outline">{item.asin}</Badge></TableCell>
                    <TableCell>{item.brand || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.browseClassification || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
