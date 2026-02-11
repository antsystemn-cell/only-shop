import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Shield, Plus, Trash2, ChevronRight, Loader2, FolderTree } from "lucide-react";
import { callWithOperatorSession } from "@/services/otSession";
import { normalizeOtResponse } from "@/utils/otNormalizer";
import { toast } from "sonner";

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

interface OtRole {
  Id?: string | { Value?: string };
  Name?: string;
  Description?: string;
  IsSystem?: boolean;
}

interface RightNode {
  Id?: string;
  Name?: string;
  Description?: string;
  Children?: { Item?: RightNode[] };
  SubItems?: RightNode[];
}

export default function OtRoles() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rolesRaw, isLoading: rolesLoading } = useQuery<any>({
    queryKey: ["admin", "ot-roles"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getAvailableRoleList"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: rightsRaw, isLoading: rightsLoading } = useQuery<any>({
    queryKey: ["admin", "ot-right-tree"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getOperatorRightTree"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const roles = normalizeOtResponse<any>(rolesRaw);
  const rights = normalizeOtResponse<any>(rightsRaw);

  const roleList: OtRole[] = (() => {
    const d = roles.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.RoleInfoList?.Item)) return d.RoleInfoList.Item;
    if (Array.isArray(d?.Roles)) return d.Roles;
    return [];
  })();

  const rightTree: RightNode[] = (() => {
    const d = rights.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.OperatorRightTree?.Item)) return d.OperatorRightTree.Item;
    if (Array.isArray(d?.Rights)) return d.Rights;
    return [];
  })();

  const deleteMut = useMutation({
    mutationFn: async (roleId: string) => {
      await callWithOperatorSession("deleteInstanceRole", { roleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-roles"] });
      toast.success("Роль устгагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Нэр оруулна уу"); return; }
    setSaving(true);
    try {
      await callWithOperatorSession("createInstanceRole", { roleName: newName, ...(newDesc ? { roleDescription: newDesc } : {}) });
      toast.success("Роль үүсгэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-roles"] });
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const getRoleId = (role: OtRole) => typeof role.Id === "object" ? role.Id?.Value : role.Id;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OT Роль & Эрхүүд</h1>
          <p className="text-muted-foreground mt-1">Инстанс роль удирдлага, эрхийн мод</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Роль үүсгэх</Button>
      </div>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Ролиуд
            {roleList.length > 0 && <Badge variant="secondary">{roleList.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !roles.success ? (
            <ErrorAlert message={roles.error || "Роль ачаалж чадсангүй"} />
          ) : roleList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Роль олдсонгүй</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Нэр</TableHead>
                  <TableHead>Тайлбар</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-center">Төрөл</TableHead>
                  <TableHead className="text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleList.map((role, i) => {
                  const id = getRoleId(role);
                  return (
                    <TableRow key={id || i}>
                      <TableCell className="font-medium">{role.Name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{role.Description || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{id || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={role.IsSystem ? "default" : "outline"}>{role.IsSystem ? "Систем" : "Дүрэм"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!role.IsSystem && id && (
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Устгах уу?")) deleteMut.mutate(id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rights Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            Эрхийн мод (Rights Tree)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rightsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !rights.success ? (
            <ErrorAlert message={rights.error || "Эрхийн мод ачаалж чадсангүй"} />
          ) : rightTree.length === 0 ? (
            <p className="text-sm text-muted-foreground">Эрхийн мод олдсонгүй</p>
          ) : (
            <div className="space-y-1">
              {rightTree.map((node, i) => (
                <RightNodeRow key={node.Id || i} node={node} depth={0} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Шинэ роль үүсгэх</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Нэр *</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ролийн нэр" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Тайлбар</label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Тайлбар..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Болих</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Үүсгэх
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RightNodeRow({ node, depth }: { node: RightNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const children = node.Children?.Item || node.SubItems || [];
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        ) : (
          <div className="w-4" />
        )}
        <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">{node.Name || node.Id || "—"}</span>
        {node.Description && <span className="text-xs text-muted-foreground ml-2">{node.Description}</span>}
      </div>
      {expanded && children.map((child, i) => (
        <RightNodeRow key={child.Id || i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
