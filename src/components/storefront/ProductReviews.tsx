import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addItemReview } from "@/services/otApi";
import { getAnonymousSession } from "@/services/otSession";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Send, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface ProductReviewsProps {
  itemId: string;
}

export function ProductReviews({ itemId }: ProductReviewsProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const sessionId = await getAnonymousSession();
      return addItemReview(sessionId, itemId, reviewText, rating);
    },
    onSuccess: () => {
      toast.success("Сэтгэгдэл илгээгдлээ! Хянагдсаны дараа харагдана.");
      setReviewText("");
      setRating(5);
      setSubmitted(true);
    },
    onError: (e: any) => {
      toast.error("Алдаа: " + e.message);
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Сэтгэгдэл бичих
      </h3>

      {!user ? (
        <p className="text-sm text-muted-foreground">
          Сэтгэгдэл бичихийн тулд <a href="/auth" className="text-primary hover:underline">нэвтэрнэ үү</a>.
        </p>
      ) : submitted ? (
        <Card>
          <CardContent className="py-6 text-center">
            <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500 fill-yellow-500" />
            <p className="font-medium">Сэтгэгдэл илгээгдлээ!</p>
            <p className="text-sm text-muted-foreground mt-1">Хянагдсаны дараа бусдад харагдана.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setSubmitted(false)}>
              Дахин бичих
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {/* Star rating */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Үнэлгээ</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="focus:outline-none"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      className={`h-6 w-6 transition-colors ${
                        star <= (hoverRating || rating)
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>
              </div>
            </div>

            {/* Review text */}
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Барааны талаар сэтгэгдлээ бичнэ үү..."
              rows={3}
            />

            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!reviewText.trim() || submitMutation.isPending}
              className="w-full"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Илгээж байна...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Сэтгэгдэл илгээх
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
