import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Eye,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";

interface ParsedUser {
  legacy_id: string;
  login: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

interface ImportResult {
  total: number;
  toInsert: number;
  toMerge: number;
  toSkip: number;
  skipReasons: Array<{ legacy_id: string; reason: string }>;
  sampleRows: ParsedUser[];
  inserted?: number;
  merged?: number;
  skipped?: number;
  errors?: Array<{ legacy_id: string; error: string }>;
}

type Phase = "upload" | "preview" | "importing" | "done";

export default function Migration() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [xmlContent, setXmlContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showSkipReasons, setShowSkipReasons] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Past jobs
  const { data: pastJobs } = useQuery({
    queryKey: ["migration-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("migration_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Dry run mutation
  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("import-users-xml", {
        body: {
          action: "import_users_xml",
          xmlContent,
          sourceFile: fileName,
          dryRun: true,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Dry run амжилтгүй");
      return data.result as ImportResult;
    },
    onSuccess: (result) => {
      setPreviewResult(result);
      setPhase("preview");
      toast.success("Dry run амжилттай дууслаа");
    },
    onError: (error) => {
      toast.error(`Dry run алдаа: ${error.message}`);
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("import-users-xml", {
        body: {
          action: "import_users_xml",
          xmlContent,
          sourceFile: fileName,
          dryRun: false,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Импорт амжилтгүй");
      return data.result as ImportResult;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setPhase("done");
      queryClient.invalidateQueries({ queryKey: ["migration-jobs"] });
      toast.success("Импорт амжилттай дууслаа!");
    },
    onError: (error) => {
      toast.error(`Импорт алдаа: ${error.message}`);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xml")) {
      toast.error("Зөвхөн XML файл оруулна уу");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setXmlContent(content);
      toast.success(`${file.name} файл уншигдлаа`);
    };
    reader.readAsText(file);
  };

  const reset = () => {
    setPhase("upload");
    setXmlContent("");
    setFileName("");
    setPreviewResult(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const exportErrorsCsv = (errors: Array<{ legacy_id: string; error: string }>) => {
    const csv = ["legacy_id,error", ...errors.map((e) => `${e.legacy_id},"${e.error}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-errors-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Legacy хэрэглэгч импорт</h1>
        <p className="text-muted-foreground mt-1">
          XML файлаас хэрэглэгчдийн мэдээллийг импортлох
        </p>
      </div>

      {/* Warning */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Анхааруулга</p>
            <p className="text-sm text-muted-foreground mt-1">
              Импортлохоос өмнө заавал "Dry Run" хийж шалгаарай. Одоо байгаа хэрэглэгчдийн
              нууц үг, created_at, wallet баланс өөрчлөгдөхгүй.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: "upload", label: "1. Файл оруулах" },
          { key: "preview", label: "2. Dry Run" },
          { key: "importing", label: "3. Импорт" },
          { key: "done", label: "4. Дүн" },
        ].map((step, i) => (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <Badge
              variant={phase === step.key ? "default" : "outline"}
              className={
                ["importing", "done"].includes(phase) &&
                ["upload", "preview"].includes(step.key)
                  ? "bg-primary/20 text-primary"
                  : ""
              }
            >
              {step.label}
            </Badge>
          </div>
        ))}
      </div>

      {/* Phase: Upload */}
      {phase === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              XML файл оруулах
            </CardTitle>
            <CardDescription>
              Legacy системээс экспортолсон users-*.xml файлыг оруулна уу
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {(xmlContent.length / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    Файл оруулахын тулд энд дарна уу
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Зөвхөн .xml файл
                  </p>
                </div>
              )}
            </div>
            {xmlContent && (
              <Button
                onClick={() => dryRunMutation.mutate()}
                disabled={dryRunMutation.isPending}
                className="w-full"
              >
                {dryRunMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Шалгаж байна...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Dry Run — Шалгах
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Phase: Preview */}
      {phase === "preview" && previewResult && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{previewResult.total}</p>
                <p className="text-sm text-muted-foreground">Нийт</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <UserPlus className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold text-primary">{previewResult.toInsert}</p>
                <p className="text-sm text-muted-foreground">Шинэ нэмэх</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <UserCheck className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                <p className="text-2xl font-bold text-amber-500">{previewResult.toMerge}</p>
                <p className="text-sm text-muted-foreground">Нэгтгэх</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <UserX className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{previewResult.toSkip}</p>
                <p className="text-sm text-muted-foreground">Алгасах</p>
              </CardContent>
            </Card>
          </div>

          {/* Sample rows */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Жишээ 10 хэрэглэгч</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Legacy ID</TableHead>
                    <TableHead>Имэйл</TableHead>
                    <TableHead>Утас</TableHead>
                    <TableHead>Нэр</TableHead>
                    <TableHead>Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResult.sampleRows.map((u, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{u.legacy_id}</TableCell>
                      <TableCell className="text-xs">{u.email || "—"}</TableCell>
                      <TableCell className="text-xs">{u.phone || "—"}</TableCell>
                      <TableCell className="text-xs">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-xs">{u.login || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Skip reasons */}
          {previewResult.skipReasons.length > 0 && (
            <Card>
              <CardHeader>
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => setShowSkipReasons(!showSkipReasons)}
                >
                  <span>Алгасах шалтгаанууд ({previewResult.skipReasons.length})</span>
                  {showSkipReasons ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CardHeader>
              {showSkipReasons && (
                <CardContent>
                  <div className="max-h-60 overflow-y-auto space-y-1 text-xs font-mono">
                    {previewResult.skipReasons.map((s, i) => (
                      <div key={i} className="text-muted-foreground">
                        [{s.legacy_id}] {s.reason}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>
              Буцах
            </Button>
            <Button
              onClick={() => {
                setPhase("importing");
                importMutation.mutate();
              }}
              disabled={previewResult.toInsert === 0 && previewResult.toMerge === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              Импорт эхлүүлэх ({previewResult.toInsert + previewResult.toMerge} хэрэглэгч)
            </Button>
          </div>
        </div>
      )}

      {/* Phase: Importing */}
      {phase === "importing" && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">Импорт хийж байна...</p>
            <p className="text-sm text-muted-foreground">
              {previewResult?.toInsert || 0} шинэ нэмэх, {previewResult?.toMerge || 0} нэгтгэх
            </p>
            <Progress value={50} className="h-2 max-w-md mx-auto" />
          </CardContent>
        </Card>
      )}

      {/* Phase: Done */}
      {phase === "done" && importResult && (
        <div className="space-y-4">
          <Card className={importResult.errors && importResult.errors.length > 0 ? "border-amber-500/50" : "border-primary/50"}>
            <CardContent className="pt-6 text-center space-y-3">
              {importResult.errors && importResult.errors.length > 0 ? (
                <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
              ) : (
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              )}
              <p className="text-xl font-bold">Импорт дууслаа!</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold">{importResult.total}</p>
                <p className="text-sm text-muted-foreground">Нийт XML</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-primary">{importResult.inserted ?? 0}</p>
                <p className="text-sm text-muted-foreground">Шинэ нэмсэн</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-amber-500">{importResult.merged ?? 0}</p>
                <p className="text-sm text-muted-foreground">Нэгтгэсэн</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-destructive">
                  {importResult.errors?.length ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Алдаа</p>
              </CardContent>
            </Card>
          </div>

          {/* Errors */}
          {importResult.errors && importResult.errors.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setShowErrors(!showErrors)}
                  >
                    <XCircle className="h-4 w-4 mr-2 text-destructive" />
                    Алдаанууд ({importResult.errors.length})
                    {showErrors ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportErrorsCsv(importResult.errors!)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                </div>
              </CardHeader>
              {showErrors && (
                <CardContent>
                  <div className="max-h-60 overflow-y-auto space-y-1 text-xs font-mono">
                    {importResult.errors.map((e, i) => (
                      <div key={i} className="text-destructive">
                        [{e.legacy_id}] {e.error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <Button onClick={reset} variant="outline">
            Шинэ файл оруулах
          </Button>
        </div>
      )}

      {/* Past Jobs */}
      <Separator />
      <div>
        <h2 className="text-xl font-semibold mb-4">Өмнөх шилжүүлгүүд</h2>
        {pastJobs && pastJobs.length > 0 ? (
          <div className="space-y-2">
            {pastJobs.map((job: any) => (
              <Card key={job.id}>
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        job.status === "completed"
                          ? "default"
                          : job.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {job.status}
                    </Badge>
                    <span className="font-medium capitalize">{job.job_type}</span>
                    {(job.params as any)?.source_file && (
                      <span className="text-xs text-muted-foreground">
                        {(job.params as any).source_file}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {job.success_count}/{job.total_count} амжилттай
                    </span>
                    {(job.error_count ?? 0) > 0 && (
                      <span className="text-destructive">
                        {job.error_count} алдаа
                      </span>
                    )}
                    <span>
                      {new Date(job.created_at).toLocaleDateString("mn-MN")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Шилжүүлэг хийгдээгүй байна</p>
        )}
      </div>
    </div>
  );
}
