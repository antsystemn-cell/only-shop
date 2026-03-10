import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Save,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Phone,
  Activity,
} from "lucide-react";

export default function SmsGateway() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings", "sms_gateway"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("category", "sms_gateway");
      if (error) throw error;
      return data;
    },
  });

  // SMS Logs
  const { data: smsLogs } = useQuery({
    queryKey: ["admin", "sms_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("admin_settings")
        .update({ setting_value: JSON.stringify(value) })
        .eq("setting_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings", "sms_gateway"] });
      toast.success("Хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getVal = (key: string, fallback = "") => {
    const s = settings?.find((s) => s.setting_key === key);
    try {
      return s ? JSON.parse(String(s.setting_value)) : fallback;
    } catch {
      return s?.setting_value || fallback;
    }
  };

  const isTruthy = (key: string) => {
    const v = getVal(key, "false");
    return v === "true" || v === true;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          SMS Gateway
        </h1>
        <p className="text-muted-foreground mt-1">SMS провайдерын тохиргоо</p>
      </div>

      {/* Gateway settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Провайдерын тохиргоо</CardTitle>
          <CardDescription>
            CallPro / MessagePro SMS сервисийн тохиргоо
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">SMS илгээх боломж</p>
              <p className="text-sm text-muted-foreground">
                SMS илгээх боломжийг идэвхжүүлэх / идэвхгүйжүүлэх
              </p>
            </div>
            <Switch
              checked={isTruthy("sms_enabled")}
              onCheckedChange={() => {
                const current = isTruthy("sms_enabled");
                updateMutation.mutate({ key: "sms_enabled", value: current ? "false" : "true" });
              }}
            />
          </div>

          <Separator />

          <SettingField
            label="Провайдерын нэр"
            value={getVal("sms_provider_name", "MessagePro")}
            onSave={(v) => updateMutation.mutate({ key: "sms_provider_name", value: v })}
          />

          <SettingField
            label="API хаяг (URL)"
            value={getVal("sms_base_url", "https://api.messagepro.mn/send")}
            onSave={(v) => updateMutation.mutate({ key: "sms_base_url", value: v })}
          />

          <SettingField
            label="Илгээгчийн дугаар (from)"
            value={getVal("sms_sender_number", "")}
            placeholder="Тусгай дугаар"
            onSave={(v) => updateMutation.mutate({ key: "sms_sender_number", value: v })}
          />

          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-1">API Key</p>
            <p className="text-xs text-muted-foreground">
              API key нь серверийн нууц хэлбэрээр хадгалагдсан байна (MESSAGEPRO_API_KEY).
              Өөрчлөх бол Lovable Cloud секрет тохиргоог шинэчилнэ үү.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test SMS */}
      <TestSmsCard />

      {/* SMS Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Сүүлийн SMS логууд
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!smsLogs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              SMS лог олдсонгүй
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {smsLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border text-sm"
                >
                  {log.success ? (
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{log.to_phone}</span>
                      <Badge variant="outline" className="text-xs">
                        {log.type}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {new Date(log.created_at).toLocaleString("mn-MN")}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate mt-0.5">{log.message}</p>
                    {log.provider_status && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: {log.provider_status}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Test SMS Card ────────────────────────────────────────────
function TestSmsCard() {
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("Only.mn тест мессеж");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    response?: any;
  } | null>(null);

  const handleSend = async () => {
    const digits = phone.replace(/[\s\-\+\(\)]/g, "");
    if (!/^[89]\d{7}$/.test(digits) && !/^976[89]\d{7}$/.test(digits)) {
      toast.error("Монгол утасны дугаар оруулна уу");
      return;
    }
    if (!text.trim()) {
      toast.error("Мессежийн агуулга оруулна уу");
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("phone-auth", {
        body: { action: "send-test-sms", phone, text },
      });

      if (error) {
        setResult({ success: false, error: error.message });
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Тест мессеж илгээх
        </CardTitle>
        <CardDescription>SMS gateway-г шалгахын тулд тест мессеж илгээх</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Утасны дугаар
          </Label>
          <Input
            type="tel"
            placeholder="99112233"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={12}
          />
        </div>

        <div className="space-y-2">
          <Label>Мессежийн агуулга</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground text-right">{text.length}/160</p>
        </div>

        <Button onClick={handleSend} disabled={sending} className="w-full">
          {sending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Илгээх
        </Button>

        {result && (
          <div
            className={`p-4 rounded-lg border ${
              result.success
                ? "bg-primary/5 border-primary/20"
                : "bg-destructive/5 border-destructive/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="font-medium text-primary">
                    Амжилттай илгээлээ
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="font-medium text-destructive">
                    Илгээхэд алдаа гарлаа
                  </span>
                </>
              )}
            </div>
            {result.error && (
              <p className="text-sm text-destructive">{result.error}</p>
            )}
            {result.response && (
              <pre className="text-xs mt-2 p-2 rounded bg-muted overflow-x-auto">
                {JSON.stringify(result.response, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Setting Field ────────────────────────────────────────────
function SettingField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={() => onSave(val)}
          disabled={val === value}
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
