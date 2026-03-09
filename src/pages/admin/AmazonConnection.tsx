import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Wifi, RefreshCw, Settings, Shield, AlertTriangle, FlaskConical } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const REGIONS = [
  { value: "us-east-1", label: "North America (US East)" },
  { value: "eu-west-1", label: "Europe (EU West)" },
  { value: "us-west-2", label: "Far East (US West)" },
];

export default function AmazonConnection() {
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Get server-side config (sandbox mode, secrets presence)
  const { data: serverConfig } = useQuery({
    queryKey: ["amazon-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("amazon-api", {
        body: { action: "getConfig" },
      });
      if (error) return null;
      return data;
    },
  });

  const { data: connection, isLoading } = useQuery({
    queryKey: ["amazon-connection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_connections")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ region: "us-east-1", seller_id: "" });

  useEffect(() => {
    if (connection) {
      setForm({
        region: connection.region || "us-east-1",
        seller_id: connection.seller_id || "",
      });
    }
  }, [connection]);

  const isSandbox = serverConfig?.sandbox === true;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (connection) {
        const { error } = await supabase
          .from("amazon_connections")
          .update({ region: form.region, seller_id: form.seller_id, updated_at: new Date().toISOString() })
          .eq("id", connection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("amazon_connections")
          .insert({ region: form.region, seller_id: form.seller_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-connection"] });
      toast({ title: "Тохиргоо хадгалагдлаа" });
    },
    onError: () => toast({ title: "Алдаа гарлаа", variant: "destructive" }),
  });

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("amazon-api", {
        body: { action: "testConnection" },
      });
      if (error) {
        setTestResult({ success: false, error: error.message });
        toast({ title: "Холболт амжилтгүй", description: error.message, variant: "destructive" });
      } else if (data && !data.success) {
        setTestResult(data);
        toast({ title: "Холболт амжилтгүй", description: data.error || "Unknown error", variant: "destructive" });
      } else {
        setTestResult(data);
        toast({ title: "Холболт амжилттай!", description: data?.message || "Amazon SP-API-тай холбогдлоо" });
        queryClient.invalidateQueries({ queryKey: ["amazon-connection"] });
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
      toast({ title: "Алдаа", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const getAuthStatusBadge = () => {
    const status = connection?.auth_status;
    switch (status) {
      case "authorized":
        return (
          <Badge>
            <CheckCircle className="h-3 w-3 mr-1" /> Зөвшөөрөгдсөн
          </Badge>
        );
      case "token_only":
        return (
          <Badge variant="secondary">
            <AlertTriangle className="h-3 w-3 mr-1" /> Токен OK, API эрх дутуу
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" /> Амжилтгүй
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" /> Тохируулаагүй
          </Badge>
        );
    }
  };

  const secretsInfo = serverConfig?.secrets;

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Amazon холболтын тохиргоо</h1>
          <p className="text-muted-foreground">Amazon SP-API холболтын мэдээлэл, статус</p>
        </div>
        {isSandbox && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <FlaskConical className="h-4 w-4 mr-1" /> Sandbox Mode
          </Badge>
        )}
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5" /> Холболтын статус</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Зөвшөөрлийн статус</p>
              {getAuthStatusBadge()}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Горим</p>
              <Badge variant={isSandbox ? "outline" : "default"}>{isSandbox ? "Sandbox" : "Production"}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Сүүлийн токен шинэчлэл</p>
              <p className="text-sm font-medium">
                {connection?.last_token_refresh_at ? new Date(connection.last_token_refresh_at).toLocaleString("mn-MN") : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Сүүлийн амжилттай дуудлага</p>
              <p className="text-sm font-medium">
                {connection?.last_successful_api_call_at ? new Date(connection.last_successful_api_call_at).toLocaleString("mn-MN") : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Result Detail */}
      {testResult && !testResult.success && (
        <Card className="border-destructive/50">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-semibold">Холболтын алдаа</span>
            </div>
            <p className="text-sm">{testResult.error}</p>
            {testResult.step && (
              <p className="text-xs text-muted-foreground">Алхам: {testResult.step}</p>
            )}
            {testResult.details && (
              <div className="text-xs space-y-1 mt-2">
                <p>AMAZON_LWA_CLIENT_ID: {testResult.details.hasClientId ? "✅" : "❌ тохируулаагүй"}</p>
                <p>AMAZON_LWA_CLIENT_SECRET: {testResult.details.hasClientSecret ? "✅" : "❌ тохируулаагүй"}</p>
                <p>AMAZON_REFRESH_TOKEN: {testResult.details.hasRefreshToken ? "✅" : "❌ тохируулаагүй"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {testResult?.success && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">{testResult.message}</span>
            {testResult.sandbox && <Badge variant="outline" className="ml-2">Sandbox</Badge>}
          </CardContent>
        </Card>
      )}

      {/* Credentials Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> API нууц түлхүүрүүд</CardTitle>
          <CardDescription>
            Серверт хадгалагдсан. "Холболт шалгах" товч дарж тохируулагдсан эсэхийг шалгана уу.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "LWA Client ID", key: "hasClientId" },
              { label: "LWA Client Secret", key: "hasClientSecret" },
              { label: "Refresh Token", key: "hasRefreshToken" },
            ].map((item) => {
              const verified = secretsInfo?.[item.key];
              return (
                <div key={item.label} className="flex items-center gap-2 p-3 rounded-lg border">
                  {verified === true ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : verified === false ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {verified === true ? "Тохируулагдсан" : verified === false ? "Тохируулаагүй" : "Шалгаагүй"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Тохиргоо</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Бүс нутаг (Region)</Label>
              <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Seller ID (заавал биш)</Label>
              <Input
                value={form.seller_id}
                onChange={(e) => setForm({ ...form, seller_id: e.target.value })}
                placeholder="AXXXXXXXXX"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Хадгалах
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Холболт шалгах
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
