import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Star, MessageSquare, CheckCircle, AlertTriangle, BarChart3 } from "lucide-react";
import { approveItemReviews } from "@/services/otApi";
import { callWithOperatorSession } from "@/services/otSession";
import { normalizeOtResponse } from "@/utils/otNormalizer";

interface ReviewProviderStat {
  Id: string;
  Name: string;
  DisplayName: string;
  Count: number;
}

interface ReviewSettings {
  Version?: string;
  ReviewCount?: number;
  WholePlatformReviewCount?: number;
  ShowWholePlatformReviews?: boolean;
  ReviewedItemCountByProviders?: {
    Item?: ReviewProviderStat[];
  };
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export default function Reviews() {
  const [reviewIds, setReviewIds] = useState("");
  const [approving, setApproving] = useState(false);

  const { data: settingsRaw, isLoading } = useQuery<any>({
    queryKey: ["admin", "review-settings"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getItemReviewSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const settings = normalizeOtResponse<ReviewSettings>(settingsRaw);
  const info = settings.data;
  const providerStats = info?.ReviewedItemCountByProviders?.Item || [];

  const handleApprove = async () => {
    if (!reviewIds.trim()) {
      toast.error("Сэтгэгдлийн ID оруулна уу");
      return;
    }
    setApproving(true);
    try {
      await approveItemReviews(reviewIds.trim());
      toast.success("Сэтгэгдлүүд батлагдлаа");
      setReviewIds("");
    } catch (e: any) {
      toast.error("Алдаа: " + e.message);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Сэтгэгдэл & Үнэлгээ</h1>
        <p className="text-muted-foreground mt-1">Сэтгэгдлийн тохиргоо, статистик</p>
      </div>

      {/* Review Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Сэтгэгдлийн тохиргоо
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !settings.success ? (
            <ErrorAlert message={settings.error || "Тохиргоо ачаалж чадсангүй"} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatItem label="Манай сэтгэгдэл" value={(info?.ReviewCount ?? 0).toLocaleString()} />
                <StatItem label="Платформ нийт" value={(info?.WholePlatformReviewCount ?? 0).toLocaleString()} />
                <StatItem label="Хувилбар" value={info?.Version || "—"} />
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <Badge variant={info?.ShowWholePlatformReviews ? "default" : "secondary"} className="text-sm">
                    {info?.ShowWholePlatformReviews ? "Идэвхтэй" : "Идэвхгүй"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">Платформ сэтгэгдэл харуулах</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Stats */}
      {settings.success && providerStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Нийлүүлэгч бүрийн сэтгэгдэл
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Нийлүүлэгч</TableHead>
                    <TableHead className="text-right">Сэтгэгдлийн тоо</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerStats.map((p) => (
                    <TableRow key={p.Id}>
                      <TableCell className="font-medium">{p.DisplayName}</TableCell>
                      <TableCell className="text-right">{p.Count.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Сэтгэгдэл батлах
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Сэтгэгдлийн ID-ууд (таслалаар тусгаарлах)</Label>
            <Textarea
              value={reviewIds}
              onChange={(e) => setReviewIds(e.target.value)}
              placeholder="review_id_1, review_id_2, ..."
              rows={3}
            />
          </div>
          <Button onClick={handleApprove} disabled={approving}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Батлах
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Сэтгэгдлийн удирдлага
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• OT API-р дамжуулан барааны сэтгэгдлийг удирдана</p>
          <p>• Сэтгэгдлийг батлах, хариулах, устгах боломжтой</p>
          <p>• Хэрэглэгчийн сэтгэгдэл нь OT API-н session-аар дамжуулан бүртгэгдэнэ</p>
        </CardContent>
      </Card>
    </div>
  );
}
