import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function UserActivityLog() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Хэрэглэгчийн үйл ажиллагааны лог</h1>
        <p className="text-muted-foreground mt-1">Хэрэглэгчийн үйлдлүүдийн түүх</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Лог бичлэгүүд
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Хэрэглэгчийн үйл ажиллагааны лог энд харагдана.</p>
        </CardContent>
      </Card>
    </div>
  );
}
