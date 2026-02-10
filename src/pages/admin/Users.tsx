import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Users as UsersIcon, Shield, User, Eye, Mail, Phone,
  ShoppingCart, Wallet, Plus, Minus,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  user_roles: { role: string }[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch users with roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users", searchQuery, roleFilter],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      const { data: profiles, error } = await query;
      if (error) throw error;

      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      let result = profiles?.map(p => ({
        ...p,
        user_roles: roles?.filter(r => r.user_id === p.user_id) || [],
      })) as UserProfile[];

      if (roleFilter === "admin") {
        result = result.filter(u => u.user_roles.some(r => r.role === "admin"));
      } else if (roleFilter === "user") {
        result = result.filter(u => !u.user_roles.some(r => r.role === "admin"));
      }

      return result;
    },
  });

  const getRoleBadge = (roles: { role: string }[]) => {
    const isAdmin = roles.some(r => r.role === "admin");
    if (isAdmin) {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <Shield className="h-3 w-3 mr-1" />Админ
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <User className="h-3 w-3 mr-1" />Хэрэглэгч
      </Badge>
    );
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Хэрэглэгч удирдах</h1>
        <p className="text-muted-foreground mt-1">Бүртгэлтэй хэрэглэгчдийг харах, удирдах</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Нэр, имэйл, утасаар хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Бүх эрх" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүгд</SelectItem>
                <SelectItem value="admin">Админ</SelectItem>
                <SelectItem value="user">Хэрэглэгч</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            Хэрэглэгчийн жагсаалт
            {users && <Badge variant="secondary">{users.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : users && users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Хэрэглэгч</TableHead>
                    <TableHead>Утас</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead className="text-center">Эрх</TableHead>
                    <TableHead className="text-center">Бүртгүүлсэн</TableHead>
                    <TableHead className="text-center">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                              {getInitials(user.full_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.full_name || "—"}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.phone || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{user.user_id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-center">{getRoleBadge(user.user_roles)}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {format(new Date(user.created_at), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setDetailOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Хэрэглэгч олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Sheet */}
      <UserDetailSheet
        user={selectedUser}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}

// ─── User Detail Sheet ──────────────────────────────────────

function UserDetailSheet({ user, open, onClose }: { user: UserProfile | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  // Fetch user's orders
  const { data: userOrders } = useQuery({
    queryKey: ["admin", "user-orders", user?.user_id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, created_at")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch user's addresses
  const { data: addresses } = useQuery({
    queryKey: ["admin", "user-addresses", user?.user_id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user.user_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Toggle admin role
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" as any });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin" as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Эрх шинэчлэгдлээ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) return null;

  const isAdmin = user.user_roles.some(r => r.role === "admin");

  const statusMap: Record<string, string> = {
    pending: "Хүлээгдэж",
    processing: "Бэлтгэгдэж",
    shipped: "Хүргэлтэд",
    delivered: "Хүргэгдсэн",
    cancelled: "Цуцлагдсан",
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Хэрэглэгчийн мэдээлэл
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Profile Info */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-xl bg-secondary">
                    {user.full_name?.slice(0, 2).toUpperCase() || user.email.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-bold">{user.full_name || "Нэр байхгүй"}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {isAdmin ? (
                      <Badge className="bg-primary/20 text-primary"><Shield className="h-3 w-3 mr-1" />Админ</Badge>
                    ) : (
                      <Badge variant="secondary"><User className="h-3 w-3 mr-1" />Хэрэглэгч</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{user.email}</div>
                {user.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{user.phone}</div>}
                <div className="text-muted-foreground text-xs">ID: {user.user_id}</div>
                <div className="text-muted-foreground text-xs">Бүртгүүлсэн: {format(new Date(user.created_at), "yyyy-MM-dd HH:mm")}</div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant={isAdmin ? "destructive" : "default"}
                  onClick={() => toggleAdminMutation.mutate({ userId: user.user_id, makeAdmin: !isAdmin })}
                  disabled={toggleAdminMutation.isPending}
                >
                  <Shield className="h-4 w-4 mr-1" />
                  {isAdmin ? "Админ эрх хасах" : "Админ болгох"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          {addresses && addresses.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Хүргэлтийн хаягууд</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {addresses.map(addr => (
                  <div key={addr.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{addr.label || "Хаяг"}</Badge>
                      {addr.is_default && <Badge className="text-xs">Үндсэн</Badge>}
                    </div>
                    <p className="mt-1">{addr.city}, {addr.district}</p>
                    <p>{addr.street_address}</p>
                    {addr.phone && <p className="text-muted-foreground">Утас: {addr.phone}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Захиалгууд ({userOrders?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userOrders && userOrders.length > 0 ? (
                <div className="space-y-2">
                  {userOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div>
                        <div className="font-mono font-medium">{order.order_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "yyyy-MM-dd")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(Number(order.total))}</div>
                        <Badge variant="outline" className="text-xs">
                          {statusMap[order.status] || order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Захиалга байхгүй</p>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
