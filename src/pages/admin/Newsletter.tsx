import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Search } from "lucide-react";
import { format } from "date-fns";

export default function Newsletter() {
  const [newEmail, setNewEmail] = useState("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: subscribers, isLoading } = useQuery({
    queryKey: ["admin", "newsletter", search],
    queryFn: async () => {
      let q = supabase.from("newsletter_subscribers").select("*").order("created_at", { ascending: false });
      if (search) q = q.ilike("email", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from("newsletter_subscribers").insert([{ email }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "newsletter"] }); toast.success("Нэмэгдлээ"); setNewEmail(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "newsletter"] }); toast.success("Устгагдлаа"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-3xl font-bold">Мэдээллийн товхимол</h1><p className="text-muted-foreground mt-1">Бүртгэлтэй хүмүүсийн жагсаалт</p></div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Имэйл хайх..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Input placeholder="Шинэ имэйл нэмэх" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-64" />
            <Button onClick={() => { if (newEmail) addMutation.mutate(newEmail); }}><Plus className="h-4 w-4 mr-2" />Нэмэх</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Бүртгэлтэй {subscribers && <Badge variant="secondary">{subscribers.length}</Badge>}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Имэйл</TableHead><TableHead>Нэр</TableHead><TableHead>Эх сурвалж</TableHead><TableHead>Огноо</TableHead><TableHead className="text-right">Үйлдэл</TableHead></TableRow></TableHeader>
            <TableBody>
              {subscribers?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell>{s.full_name || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{s.source}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(s.created_at), "yyyy-MM-dd")}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => { if (confirm("Устгах уу?")) deleteMutation.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
              {(!subscribers || subscribers.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Бүртгэл олдсонгүй</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
