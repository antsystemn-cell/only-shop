import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MessageSquare, Plus, Send, Clock, CheckCircle2, AlertCircle, User,
} from "lucide-react";
import { format } from "date-fns";

const categories = [
  { value: "general", label: "Ерөнхий" },
  { value: "order", label: "Захиалга" },
  { value: "payment", label: "Төлбөр" },
  { value: "delivery", label: "Хүргэлт" },
  { value: "product", label: "Бараа" },
  { value: "account", label: "Бүртгэл" },
];

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Нээлттэй", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  in_progress: { label: "Шийдвэрлэж байна", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  resolved: { label: "Шийдэгдсэн", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  closed: { label: "Хаагдсан", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

export default function Support() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Form state
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");

  // Fetch tickets
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch messages for selected ticket
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["support-messages", selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTicket && detailOpen,
  });

  // Create ticket
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user!.id,
        subject,
        description,
        category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Тикет үүсгэгдлээ" });
      setCreateOpen(false);
      setSubject("");
      setDescription("");
      setCategory("general");
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  // Send message
  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedTicket!.id,
        user_id: user!.id,
        message: newMessage,
        is_admin: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-messages"] });
      setNewMessage("");
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">Нэвтэрнэ үү</h2>
        <p className="text-muted-foreground mb-4">Тусламж авахын тулд нэвтрэх шаардлагатай</p>
        <Button onClick={() => navigate("/auth")}>Нэвтрэх</Button>
      </div>
    );
  }

  const openDetail = (ticket: any) => {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  };

  return (
    <div className="container py-6 max-w-4xl animate-fade-in">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Нүүр хуудас
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          Тусламж
        </h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Тикет үүсгэх
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : tickets && tickets.length > 0 ? (
        <div className="space-y-3">
          {tickets.map((t: any) => {
            const st = statusMap[t.status] || statusMap.open;
            const catLabel = categories.find((c) => c.value === t.category)?.label || t.category;
            return (
              <Card
                key={t.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openDetail(t)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{t.subject}</h3>
                      <Badge variant="outline" className="text-xs shrink-0">{catLabel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{t.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(t.created_at), "yyyy-MM-dd HH:mm")}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ml-4 ${st.color}`}>
                    {st.label}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-1">Тикет байхгүй</p>
          <p className="text-sm">Асуудал тулгарвал шинэ тикет үүсгэнэ үү</p>
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Шинэ тикет үүсгэх</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Гарчиг</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Асуудлын товч тайлбар" className="mt-1" />
            </div>
            <div>
              <Label>Ангилал</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Дэлгэрэнгүй тайлбар</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Асуудлаа дэлгэрэнгүй тайлбарлана уу..." className="mt-1" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Болих</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!subject.trim() || !description.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Үүсгэж байна..." : "Үүсгэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-left">
              {selectedTicket?.subject}
            </SheetTitle>
          </SheetHeader>

          {selectedTicket && (
            <div className="flex-1 flex flex-col mt-4 min-h-0">
              {/* Ticket info */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
                <p>{selectedTicket.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{format(new Date(selectedTicket.created_at), "yyyy-MM-dd HH:mm")}</span>
                  <span className={`px-2 py-0.5 rounded-full ${(statusMap[selectedTicket.status] || statusMap.open).color}`}>
                    {(statusMap[selectedTicket.status] || statusMap.open).label}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {messagesLoading ? (
                  <div className="space-y-2">
                    {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : messages && messages.length > 0 ? (
                  messages.map((m: any) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg text-sm ${
                        m.is_admin
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {m.is_admin ? "Тусламж" : "Та"}
                        <span>• {format(new Date(m.created_at), "MM-dd HH:mm")}</span>
                      </div>
                      <p>{m.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Мессеж байхгүй</p>
                )}
              </div>

              {/* Send message */}
              {selectedTicket.status !== "closed" && (
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Мессеж бичих..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newMessage.trim()) sendMutation.mutate();
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMutation.mutate()}
                    disabled={!newMessage.trim() || sendMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
