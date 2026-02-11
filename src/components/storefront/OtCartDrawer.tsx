import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, Loader2, BookmarkMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useOtCartSafe } from "@/contexts/OtCartContext";

function formatPrice(price: number, currency = "¥") {
  return `${currency}${price.toFixed(2)}`;
}

export function OtCartDrawer() {
  const { items, groups, isLoading, subtotal, clearCart, updateItemQuantity, removeItem, moveToNote } = useOtCartSafe();
  const navigate = useNavigate();

  const handleCheckout = () => {
    navigate("/ot/checkout");
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>Сагс</SheetTitle>
        </SheetHeader>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>Сагс</SheetTitle>
        </SheetHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 rounded-full bg-muted">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Сагс хоосон байна</p>
            <p className="text-sm text-muted-foreground">Бараа нэмж эхлээрэй</p>
          </div>
          <Link to="/ot">
            <Button className="mt-4">Маркетплэйс үзэх</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SheetHeader>
        <SheetTitle>Сагс ({items.length} бараа)</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {groups.map((group) => (
          <div key={group.providerType}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                {group.providerType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {group.items.length} бараа
              </span>
            </div>

            <div className="space-y-4">
              {group.items.map((item) => (
                <div key={item.orderLineId} className="flex gap-3 animate-fade-in">
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-2">{item.title}</h4>
                    <p className="text-primary font-semibold text-sm mt-0.5">
                      {formatPrice(item.price, item.currency)}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateItemQuantity(item.orderLineId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateItemQuantity(item.orderLineId, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => moveToNote(item.orderLineId)}
                        title="Тэмдэглэл рүү зөөх"
                      >
                        <BookmarkMinus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-auto text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.orderLineId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Нийт дүн:</span>
          <span className="text-xl font-bold text-primary">
            {formatPrice(subtotal)}
          </span>
        </div>
        <Separator />
        <div className="space-y-2">
          <SheetClose asChild>
            <Button className="w-full" size="lg" onClick={handleCheckout}>
              Захиалга өгөх
            </Button>
          </SheetClose>
          <Button variant="outline" className="w-full" onClick={clearCart}>
            Сагс хоослох
          </Button>
        </div>
      </div>
    </div>
  );
}
