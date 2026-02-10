import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star, MessageSquare, Search, CheckCircle } from "lucide-react";
import {
  getItemReviewSettings,
  approveItemReviews,
} from "@/services/otApi";

export default function Reviews() {
  const [reviewIds, setReviewIds] = useState("");
  const [approving, setApproving] = useState(false);

  const { data: reviewSettings, isLoading } = useQuery<any>({
    queryKey: ["admin", "review-settings"],
    queryFn: async () => {
      try {
        return await getItemReviewSettings();
      } catch (e: any) {
        return { error: e.message };
      }
    },
    retry: false,
  });

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
        <p className="text-muted-foreground mt-1">OT API сэтгэгдлийн удирдлага</p>
      </div>

      {/* Review Settings */}
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
          ) : reviewSettings?.error ? (
            <p className="text-sm text-destructive">{reviewSettings.error}</p>
          ) : (
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-48">
              {JSON.stringify(reviewSettings, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

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
          <p>• Сэтгэгдлийн тохиргоог дээрх хэсгээс харна уу</p>
        </CardContent>
      </Card>
    </div>
  );
}
