import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function Reviews() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Сэтгэгдэл & Үнэлгээ</h1>
        <p className="text-muted-foreground mt-1">Барааны сэтгэгдэл, үнэлгээний удирдлага</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Сэтгэгдлийн удирдлага
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Сэтгэгдлийн систем удахгүй нэмэгдэнэ.</p>
        </CardContent>
      </Card>
    </div>
  );
}
