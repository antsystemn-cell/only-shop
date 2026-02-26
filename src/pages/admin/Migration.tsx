import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload, FileText, Eye, Play, CheckCircle2, XCircle, Loader2,
  AlertTriangle, Users, UserPlus, UserCheck, UserX, ChevronDown,
  ChevronUp, Download,
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

interface ClassifyResult {
  total: number;
  toInsert: number;
  toMerge: number;
  toSkip: number;
  skipReasons: Array<{ legacy_id: string; reason: string }>;
  sampleRows: ParsedUser[];
  insertUsers: ParsedUser[];
  mergeUsers: Array<{ user: ParsedUser; existingUserId: string }>;
}

interface ImportProgress {
  totalBatches: number;
  completedBatches: number;
  inserted: number;
  merged: number;
  errors: Array<{ legacy_id: string; error: string }>;
}

type Phase = "upload" | "preview" | "importing" | "done";

const BATCH_SIZE = 200;

export default function Migration() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [xmlContent, setXmlContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [showSkipReasons, setShowSkipReasons] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
      setXmlContent(evt.target?.result as string);
      toast.success(`${file.name} файл уншигдлаа`);
    };
    reader.readAsText(file);
  };

  const runDryRun = async () => {
    setIsDryRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-users-xml", {
        body: { action: "parse_xml", xmlContent },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Dry run амжилтгүй");
      setClassifyResult(data.result as ClassifyResult);
      setPhase("preview");
      toast.success("Dry run амжилттай");
    } catch (err: any) {
      toast.error(`Dry run алдаа: ${err.message}`);
    } finally {
      setIsDryRunning(false);
    }
  };

  const runImport = useCallback(async () => {
    if (!classifyResult) return;
    setPhase("importing");
    const startedAt = new Date().toISOString();

    const insertBatches: ParsedUser[][] = [];
    for (let i = 0; i < classifyResult.insertUsers.length; i += BATCH_SIZE) {
      insertBatches.push(classifyResult.insertUsers.slice(i, i + BATCH_SIZE));
    }

    const mergeBatches: Array<Array<{ user: ParsedUser; existingUserId: string }>> = [];
    for (let i = 0; i < classifyResult.mergeUsers.length; i += BATCH_SIZE) {
      mergeBatches.push(classifyResult.mergeUsers.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = insertBatches.length + mergeBatches.length;
    const prog: ImportProgress = {
      totalBatches,
      completedBatches: 0,
      inserted: 0,
      merged: 0,
      errors: [],
    };
    setProgress({ ...prog });

    // Process insert batches
    for (const batch of insertBatches) {
      try {
        const { data, error } = await supabase.functions.invoke("import-users-xml", {
          body: {
            action: "import_batch",
            users: batch.map((u) => ({ user: u })),
            mode: "insert",
          },
        });
        if (error) throw error;
        prog.inserted += data.successCount || 0;
        if (data.errors?.length) prog.errors.push(...data.errors);
      } catch (err: any) {
        prog.errors.push({ legacy_id: "batch", error: err.message });
      }
      prog.completedBatches++;
      setProgress({ ...prog });
    }

    // Process merge batches
    for (const batch of mergeBatches) {
      try {
        const { data, error } = await supabase.functions.invoke("import-users-xml", {
          body: {
            action: "import_batch",
            users: batch,
            mode: "merge",
          },
        });
        if (error) throw error;
        prog.merged += data.successCount || 0;
        if (data.errors?.length) prog.errors.push(...data.errors);
      } catch (err: any) {
        prog.errors.push({ legacy_id: "batch", error: err.message });
      }
      prog.completedBatches++;
      setProgress({ ...prog });
    }

    // Log migration
    try {
      await supabase.functions.invoke("import-users-xml", {
        body: {
          action: "log_migration",
          startedAt,
          sourceFile: fileName,
          totalCount: classifyResult.total,
          processedCount: prog.inserted + prog.merged + classifyResult.toSkip,
          successCount: prog.inserted + prog.merged,
          errorCount: prog.errors.length,
          errors: prog.errors.slice(0, 100),
          status: prog.errors.length > 0 ? "completed_with_errors" : "completed",
        },
      });
    } catch (_) {}

    setPhase("done");
    queryClient.invalidateQueries({ queryKey: ["migration-jobs"] });
    toast.success("Импорт амжилттай дууслаа!");
  }, [classifyResult, fileName, queryClient]);

  const reset = () => {
    setPhase("upload");
    setXmlContent("");
    setFileName("");
    setClassifyResult(null);
    setProgress(null);
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

  const progressPct = progress
    ? Math.round((progress.completedBatches / Math.max(progress.totalBatches, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Legacy хэрэглэгч импорт</h1>
        <p className="text-muted-foreground mt-1">
          XML файлаас хэрэглэгчдийн мэдээллийг импортлох
        </p>
      </div>

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

      {/* Steps */}
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
                ["importing", "done"].includes(phase) && ["upload", "preview"].includes(step.key)
                  ? "bg-primary/20 text-primary"
                  : ""
              }
            >
              {step.label}
            </Badge>
          </div>
        ))}
      </div>

      {/* Upload */}
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
            <input ref={fileInputRef} type="file" accept=".xml" className="hidden" onChange={handleFileUpload} />
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{fileName}</p>
                    <p className="text-sm text-muted-foreground">{(xmlContent.length / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Файл оруулахын тулд энд дарна уу</p>
                  <p className="text-xs text-muted-foreground mt-1">Зөвхөн .xml файл</p>
                </div>
              )}
            </div>
            {xmlContent && (
              <Button onClick={runDryRun} disabled={isDryRunning} className="w-full">
                {isDryRunning ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Шалгаж байна...</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" />Dry Run — Шалгах</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {phase === "preview" && classifyResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold">{classifyResult.total}</p>
              <p className="text-sm text-muted-foreground">Нийт</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <UserPlus className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold text-primary">{classifyResult.toInsert}</p>
              <p className="text-sm text-muted-foreground">Шинэ нэмэх</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <UserCheck className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-bold text-amber-500">{classifyResult.toMerge}</p>
              <p className="text-sm text-muted-foreground">Нэгтгэх</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <UserX className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold">{classifyResult.toSkip}</p>
              <p className="text-sm text-muted-foreground">Алгасах</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Жишээ 10 хэрэглэгч</CardTitle></CardHeader>
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
                  {classifyResult.sampleRows.map((u, i) => (
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

          {classifyResult.skipReasons.length > 0 && (
            <Card>
              <CardHeader>
                <Button variant="ghost" className="w-full justify-between" onClick={() => setShowSkipReasons(!showSkipReasons)}>
                  <span>Алгасах шалтгаанууд ({classifyResult.skipReasons.length})</span>
                  {showSkipReasons ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CardHeader>
              {showSkipReasons && (
                <CardContent>
                  <div className="max-h-60 overflow-y-auto space-y-1 text-xs font-mono">
                    {classifyResult.skipReasons.map((s, i) => (
                      <div key={i} className="text-muted-foreground">[{s.legacy_id}] {s.reason}</div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>Буцах</Button>
            <Button
              onClick={runImport}
              disabled={classifyResult.toInsert === 0 && classifyResult.toMerge === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              Импорт эхлүүлэх ({classifyResult.toInsert + classifyResult.toMerge} хэрэглэгч)
            </Button>
          </div>
        </div>
      )}

      {/* Importing */}
      {phase === "importing" && progress && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">Импорт хийж байна...</p>
            <div className="max-w-md mx-auto space-y-2">
              <Progress value={progressPct} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {progress.completedBatches}/{progress.totalBatches} багц ({progressPct}%)
              </p>
              <div className="flex justify-center gap-6 text-sm">
                <span className="text-primary">✓ {progress.inserted} нэмсэн</span>
                <span className="text-amber-500">⟳ {progress.merged} нэгтгэсэн</span>
                {progress.errors.length > 0 && (
                  <span className="text-destructive">✗ {progress.errors.length} алдаа</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {phase === "done" && progress && (
        <div className="space-y-4">
          <Card className={progress.errors.length > 0 ? "border-amber-500/50" : "border-primary/50"}>
            <CardContent className="pt-6 text-center space-y-3">
              {progress.errors.length > 0 ? (
                <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
              ) : (
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              )}
              <p className="text-xl font-bold">Импорт дууслаа!</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold">{classifyResult?.total ?? 0}</p>
              <p className="text-sm text-muted-foreground">Нийт XML</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold text-primary">{progress.inserted}</p>
              <p className="text-sm text-muted-foreground">Шинэ нэмсэн</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold text-amber-500">{progress.merged}</p>
              <p className="text-sm text-muted-foreground">Нэгтгэсэн</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold text-destructive">{progress.errors.length}</p>
              <p className="text-sm text-muted-foreground">Алдаа</p>
            </CardContent></Card>
          </div>

          {progress.errors.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setShowErrors(!showErrors)}>
                    <XCircle className="h-4 w-4 mr-2 text-destructive" />
                    Алдаанууд ({progress.errors.length})
                    {showErrors ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportErrorsCsv(progress.errors)}>
                    <Download className="h-3 w-3 mr-1" />CSV
                  </Button>
                </div>
              </CardHeader>
              {showErrors && (
                <CardContent>
                  <div className="max-h-60 overflow-y-auto space-y-1 text-xs font-mono">
                    {progress.errors.map((e, i) => (
                      <div key={i} className="text-destructive">[{e.legacy_id}] {e.error}</div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <Button onClick={reset} variant="outline">Шинэ файл оруулах</Button>
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
                    <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                      {job.status}
                    </Badge>
                    <span className="font-medium capitalize">{job.job_type}</span>
                    {(job.params as any)?.source_file && (
                      <span className="text-xs text-muted-foreground">{(job.params as any).source_file}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{job.success_count}/{job.total_count} амжилттай</span>
                    {(job.error_count ?? 0) > 0 && <span className="text-destructive">{job.error_count} алдаа</span>}
                    <span>{new Date(job.created_at).toLocaleDateString("mn-MN")}</span>
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
