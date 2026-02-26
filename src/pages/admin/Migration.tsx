import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Users,
  ShoppingCart,
  Wallet,
  MapPin,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MigrationStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  action: string;
}

const STEPS: MigrationStep[] = [
  {
    id: "users",
    title: "Хэрэглэгчид & Profile",
    description: "OT API-аас бүх хэрэглэгчдийн мэдээллийг татаж profiles хүснэгтэд хадгална",
    icon: Users,
    action: "migrate_users",
  },
  {
    id: "orders",
    title: "Захиалгын түүх",
    description: "Өмнөх захиалгуудыг OT API-аас татаж orders хүснэгтэд импортлоно",
    icon: ShoppingCart,
    action: "migrate_orders",
  },
  {
    id: "wallets",
    title: "Wallet баланс",
    description: "Хэрэглэгчдийн хуучин wallet үлдэгдлийг шилжүүлнэ",
    icon: Wallet,
    action: "migrate_wallets",
  },
  {
    id: "addresses",
    title: "Хаягийн мэдээлэл",
    description: "Хэрэглэгчдийн хадгалсан хаягуудыг импортлоно",
    icon: MapPin,
    action: "migrate_addresses",
  },
];

interface JobResult {
  success: boolean;
  jobId: string;
  totalCount: number;
  processed: number;
  successCount: number;
  errorCount: number;
  hasMore: boolean;
  nextPosition: number;
}

interface JobState {
  jobId?: string;
  status: "idle" | "running" | "completed" | "failed";
  totalCount: number;
  processed: number;
  successCount: number;
  errorCount: number;
  errors?: Array<{ item: string; error: string }>;
}

export default function Migration() {
  const [activeStep, setActiveStep] = useState(0);
  const [jobStates, setJobStates] = useState<Record<string, JobState>>({});
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  // Fetch past jobs
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

  const runMigration = useMutation({
    mutationFn: async ({
      action,
      stepId,
      jobId,
      nextPosition,
    }: {
      action: string;
      stepId: string;
      jobId?: string;
      nextPosition?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("migrate-legacy", {
        body: {
          action,
          jobId,
          params: {
            framePosition: nextPosition || 0,
            frameSize: 50,
          },
        },
      });
      if (error) throw error;
      return { ...data, stepId } as JobResult & { stepId: string };
    },
    onSuccess: async (result) => {
      const { stepId } = result;

      setJobStates((prev) => ({
        ...prev,
        [stepId]: {
          jobId: result.jobId,
          status: result.hasMore ? "running" : "completed",
          totalCount: result.totalCount,
          processed: result.processed,
          successCount: (prev[stepId]?.successCount || 0) + result.successCount,
          errorCount: (prev[stepId]?.errorCount || 0) + result.errorCount,
        },
      }));

      if (result.hasMore) {
        // Continue with next batch
        const step = STEPS.find((s) => s.id === stepId);
        if (step) {
          runMigration.mutate({
            action: step.action,
            stepId,
            jobId: result.jobId,
            nextPosition: result.nextPosition,
          });
        }
      } else {
        toast.success(`${stepId} импорт амжилттай дууслаа`);
        queryClient.invalidateQueries({ queryKey: ["migration-jobs"] });
      }
    },
    onError: (error, variables) => {
      setJobStates((prev) => ({
        ...prev,
        [variables.stepId]: {
          ...prev[variables.stepId],
          status: "failed",
          totalCount: prev[variables.stepId]?.totalCount || 0,
          processed: prev[variables.stepId]?.processed || 0,
          successCount: prev[variables.stepId]?.successCount || 0,
          errorCount: prev[variables.stepId]?.errorCount || 0,
        },
      }));
      toast.error(`Алдаа: ${error.message}`);
    },
  });

  const startStep = (step: MigrationStep) => {
    setJobStates((prev) => ({
      ...prev,
      [step.id]: {
        status: "running",
        totalCount: 0,
        processed: 0,
        successCount: 0,
        errorCount: 0,
      },
    }));
    runMigration.mutate({ action: step.action, stepId: step.id });
  };

  const getStepState = (stepId: string): JobState => {
    return (
      jobStates[stepId] || {
        status: "idle",
        totalCount: 0,
        processed: 0,
        successCount: 0,
        errorCount: 0,
      }
    );
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Play className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Legacy шилжүүлэг</h1>
        <p className="text-muted-foreground mt-1">
          OT API-аас хэрэглэгч, захиалга, wallet, хаягийн мэдээллийг импортлох wizard
        </p>
      </div>

      {/* Warning */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">
              Анхааруулга
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Энэ процесс нь OT API-аас өгөгдлийг татаж шинэ системд хадгална.
              Давхардсан бичлэгүүдийг автоматаар алгасна. Эхлэхийн өмнө backup хийхийг зөвлөе.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Wizard Steps */}
      <div className="grid gap-4">
        {STEPS.map((step, index) => {
          const state = getStepState(step.id);
          const progress =
            state.totalCount > 0
              ? Math.round((state.processed / state.totalCount) * 100)
              : 0;
          const isCurrentStep = activeStep === index;

          return (
            <Card
              key={step.id}
              className={`transition-all ${
                isCurrentStep ? "ring-2 ring-primary" : ""
              }`}
            >
              <CardHeader
                className="cursor-pointer"
                onClick={() => setActiveStep(index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-muted-foreground text-sm font-normal">
                          Алхам {index + 1}
                        </span>
                        {step.title}
                      </CardTitle>
                      <CardDescription>{step.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusIcon status={state.status} />
                    {isCurrentStep ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isCurrentStep && (
                <CardContent className="space-y-4">
                  {/* Progress */}
                  {state.status !== "idle" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          Боловсруулсан: {state.processed} / {state.totalCount}
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="flex gap-4 text-sm">
                        <span className="text-primary">
                          ✓ Амжилттай: {state.successCount}
                        </span>
                        <span className="text-destructive">
                          ✗ Алдаа: {state.errorCount}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {state.errors && state.errors.length > 0 && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedErrors((prev) => ({
                            ...prev,
                            [step.id]: !prev[step.id],
                          }))
                        }
                      >
                        Алдаанууд ({state.errors.length})
                        {expandedErrors[step.id] ? (
                          <ChevronUp className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        )}
                      </Button>
                      {expandedErrors[step.id] && (
                        <div className="mt-2 max-h-40 overflow-y-auto rounded border p-2 text-xs font-mono space-y-1">
                          {state.errors.map((e, i) => (
                            <div key={i} className="text-destructive">
                              [{e.item}] {e.error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => startStep(step)}
                      disabled={state.status === "running"}
                    >
                      {state.status === "running" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Ажиллаж байна...
                        </>
                      ) : state.status === "completed" ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Дахин ажиллуулах
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Эхлүүлэх
                        </>
                      )}
                    </Button>
                    {state.status === "completed" && index < STEPS.length - 1 && (
                      <Button
                        variant="outline"
                        onClick={() => setActiveStep(index + 1)}
                      >
                        Дараагийн алхам
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

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
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {job.success_count}/{job.total_count} амжилттай
                    </span>
                    {job.error_count > 0 && (
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
          <p className="text-muted-foreground text-sm">
            Шилжүүлэг хийгдээгүй байна
          </p>
        )}
      </div>
    </div>
  );
}
