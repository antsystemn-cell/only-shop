import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Trash2, Plus, Users, Settings } from "lucide-react";

const ROLES = [
  { value: "admin", label: "Админ", description: "Бүрэн эрхтэй" },
  { value: "super_admin", label: "Супер Админ", description: "Бүрэн + системийн эрх" },
  { value: "order_staff", label: "Захиалгын ажилтан", description: "Захиалга, хүргэлт удирдах" },
  { value: "user", label: "Хэрэглэгч", description: "Энгийн хэрэглэгч" },
];

const PERMISSION_GROUPS = [
  {
    label: "Захиалга",
    permissions: [
      { key: "orders.view", label: "Захиалга харах" },
      { key: "orders.create", label: "Захиалга үүсгэх" },
      { key: "orders.edit", label: "Захиалга засварлах" },
      { key: "orders.delete", label: "Захиалга устгах" },
      { key: "orders.update_payment_status", label: "Төлбөрийн төлөв солих" },
      { key: "orders.update_fulfillment_status", label: "Биелэлтийн төлөв солих" },
      { key: "orders.add_notes", label: "Тэмдэглэл нэмэх" },
      { key: "orders.save_draft", label: "Ноорог хадгалах" },
    ],
  },
  {
    label: "Хүргэлт",
    permissions: [
      { key: "delivery.access", label: "Хүргэлтийн хуудас нэвтрэх" },
    ],
  },
  {
    label: "Систем",
    permissions: [
      { key: "users.manage", label: "Хэрэглэгч удирдах" },
      { key: "settings.manage", label: "Тохиргоо удирдах" },
    ],
  },
];

export default function Permissions() {
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [activeTab, setActiveTab] = useState("users");
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["admin", "user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = data.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name, phone").in("user_id", userIds);
      return data.map((r) => ({ ...r, profile: profiles?.find((p) => p.user_id === r.user_id) }));
    },
  });

  const { data: permissions } = useQuery({
    queryKey: ["admin", "role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role: role as any }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "user-roles"] }); toast.success("Эрх нэмэгдлээ"); setNewUserId(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("user_roles").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "user-roles"] }); toast.success("Эрх устгагдлаа"); },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePermissionMutation = useMutation({
    mutationFn: async ({ role, permissionKey, isAllowed }: { role: string; permissionKey: string; isAllowed: boolean }) => {
      const { error } = await supabase
        .from("role_permissions")
        .upsert({ role: role as any, permission_key: permissionKey, is_allowed: isAllowed }, { onConflict: "role,permission_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "role-permissions"] });
      toast.success("Эрх шинэчлэгдлээ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isPermissionAllowed = (role: string, key: string) => {
    const perm = permissions?.find((p: any) => p.role === role && p.permission_key === key);
    return perm?.is_allowed ?? false;
  };

  const getRoleBadge = (role: string) => {
    const r = ROLES.find((r) => r.value === role);
    const colors: Record<string, string> = {
      super_admin: "bg-red-100 text-red-800",
      admin: "bg-primary/20 text-primary",
      order_staff: "bg-blue-100 text-blue-800",
      user: "bg-gray-100 text-gray-800",
    };
    return <Badge className={colors[role] || ""}>{r?.label || role}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Админууд & Эрх</h1>
        <p className="text-muted-foreground mt-1">Хэрэглэгчийн эрхийн удирдлага болон эрхийн тохиргоо</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Хэрэглэгчид</TabsTrigger>
          <TabsTrigger value="permissions"><Settings className="h-4 w-4 mr-1" />Эрхийн тохиргоо</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
          {/* Add role */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <label className="text-sm text-muted-foreground">Хэрэглэгчийн User ID</label>
                  <Input placeholder="User UUID" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} />
                </div>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div>
                          <div className="font-medium">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => { if (newUserId) addRoleMutation.mutate({ userId: newUserId, role: newRole }); }}>
                  <Plus className="h-4 w-4 mr-2" />Эрх нэмэх
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Users table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Эрхтэй хэрэглэгчид
                {roles && <Badge variant="secondary">{roles.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Хэрэглэгч</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead className="text-center">Эрх</TableHead>
                    <TableHead className="text-right">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles?.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.profile?.full_name || "—"}</div>
                        <div className="text-sm text-muted-foreground">{r.profile?.email || "—"}</div>
                        {r.profile?.phone && <div className="text-xs text-muted-foreground">{r.profile.phone}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.user_id}</TableCell>
                      <TableCell className="text-center">{getRoleBadge(r.role)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Эрх устгах уу?")) deleteRoleMutation.mutate(r.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!roles || roles.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Эрх олдсонгүй</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">Эрх тус бүрийн нарийвчилсан тохиргоо. Админ болон Захиалгын ажилтан эрхүүдийн хандах боломжийг тохируулна.</p>

          {["order_staff", "admin"].map((role) => {
            const roleInfo = ROLES.find((r) => r.value === role);
            return (
              <Card key={role}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {getRoleBadge(role)}
                    <span className="text-sm text-muted-foreground font-normal">{roleInfo?.description}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.label}>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">{group.label}</h4>
                        <div className="grid gap-2">
                          {group.permissions.map((perm) => (
                            <div key={perm.key} className="flex items-center justify-between py-1 px-3 rounded hover:bg-muted/50">
                              <Label className="text-sm cursor-pointer">{perm.label}</Label>
                              <Switch
                                checked={isPermissionAllowed(role, perm.key)}
                                onCheckedChange={(checked) =>
                                  togglePermissionMutation.mutate({ role, permissionKey: perm.key, isAllowed: checked })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
