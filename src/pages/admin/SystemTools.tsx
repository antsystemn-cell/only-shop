import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";

export default function SystemTools() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Системийн хэрэгслүүд</h1>
        <p className="text-muted-foreground mt-1">Системийн тохиргоо, мониторинг</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Систем
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Системийн хэрэгслүүд энд харагдана.</p>
        </CardContent>
      </Card>
    </div>
  );
}
