import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAnonymousSession } from "@/services/otSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  Loader2,
  TrendingUp,
  TrendingDown,
  History,
  RefreshCw,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AccountInfo {
  Balance?: number;
  CurrencySign?: string;
  UserId?: string;
  [key: string]: any;
}

interface StatementItem {
  Id?: string;
  Date?: string;
  Description?: string;
  Amount?: number;
  CurrencySign?: string;
  OperationType?: string;
  [key: string]: any;
}

async function callProxy<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ot-api", {
    body: { action, params: { language: "en", ...params } },
  });
  if (error) throw new Error(error.message);
  return data as T;
}

export default function Wallet() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [statements, setStatements] = useState<StatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);
      const sessionId = await getAnonymousSession();
      // Use getUserInfo to get the OT user id, then getAccountInfo
      const userInfo = await callProxy<any>("getUserInfo", { sessionId });
      const userId = userInfo?.Result?.Id || userInfo?.UserId;
      if (userId) {
        const accData = await callProxy<any>("getAccountInfo", { userId });
        setAccount(accData?.Result || accData);
      }
    } catch (err: any) {
      console.error("Account load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStatements = useCallback(async () => {
    try {
      setStatementsLoading(true);
      const sessionId = await getAnonymousSession();
      const userInfo = await callProxy<any>("getUserInfo", { sessionId });
      const userId = userInfo?.Result?.Id || userInfo?.UserId;
      if (userId) {
        const data = await callProxy<any>("getStatementForOperator", { userId, page, pageSize: 20 });
        const rawItems = data?.Result?.Items;
        setStatements(Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []);
      }
    } catch (err: any) {
      console.error("Statement load error:", err);
    } finally {
      setStatementsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (user) {
      loadAccount();
      loadStatements();
    }
  }, [user, loadAccount, loadStatements]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Нүүр хуудас
      </Link>

      <h1 className="text-3xl font-bold mb-6">Данс / Wallet</h1>

      {/* Balance Card */}
      <Card className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Дансны үлдэгдэл</p>
              <p className="text-4xl font-bold text-primary">
                {account?.CurrencySign || "¥"}{(account?.Balance ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="p-4 rounded-full bg-primary/10">
              <WalletIcon className="h-8 w-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Гүйлгээний түүх
            </span>
            <Button variant="outline" size="icon" onClick={loadStatements}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statementsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : statements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Гүйлгээ олдсонгүй</p>
            </div>
          ) : (
            <div className="space-y-2">
              {statements.map((item, i) => {
                const isPositive = (item.Amount ?? 0) >= 0;
                return (
                  <div key={item.Id || i} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className={`p-2 rounded-full ${isPositive ? "bg-primary/10" : "bg-destructive/10"}`}>
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-primary" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.Description || item.OperationType || "Гүйлгээ"}</p>
                      {item.Date && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.Date).toLocaleString("mn-MN")}
                        </p>
                      )}
                    </div>
                    <span className={`font-semibold ${isPositive ? "text-primary" : "text-destructive"}`}>
                      {isPositive ? "+" : ""}{item.CurrencySign || "¥"}{Math.abs(item.Amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {statements.length > 0 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Өмнөх
              </Button>
              <Button variant="outline" size="sm" disabled={statements.length < 20} onClick={() => setPage((p) => p + 1)}>
                Дараах
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
