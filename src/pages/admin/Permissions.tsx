import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, Trash2, Plus, Users } from "lucide-react";

export default function Permissions() {
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["admin", "user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      // Get profiles for each user
      const userIds = data.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds);
      return data.map((r) => ({ ...r, profile: profiles?.find((p) => p.user_id === r.user_id) }));
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-3xl font-bold">Админууд & Эрх</h1><p className="text-muted-foreground mt-1">Хэрэглэгчийн эрхийн удирдлага</p></div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm text-muted-foreground">Хэрэглэгчийн User ID</label>
              <Input placeholder="User UUID" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} />
            </div>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Админ</SelectItem>
                <SelectItem value="user">Хэрэглэгч</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { if (newUserId) addRoleMutation.mutate({ userId: newUserId, role: newRole }); }}><Plus className="h-4 w-4 mr-2" />Эрх нэмэх</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Эрхтэй хэрэглэгчид {roles && <Badge variant="secondary">{roles.length}</Badge>}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Хэрэглэгч</TableHead><TableHead>User ID</TableHead><TableHead className="text-center">Эрх</TableHead><TableHead className="text-right">Үйлдэл</TableHead></TableRow></TableHeader>
            <TableBody>
              {roles?.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.profile?.full_name || "—"}</div>
                    <div className="text-sm text-muted-foreground">{r.profile?.email || "—"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.user_id}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={r.role === "admin" ? "bg-primary/20 text-primary" : ""}>{r.role === "admin" ? "Админ" : "Хэрэглэгч"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Эрх устгах уу?")) deleteRoleMutation.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!roles || roles.length === 0) && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Эрх олдсонгүй</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
