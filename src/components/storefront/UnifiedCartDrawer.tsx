import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, Loader2, BookmarkMinus, Globe, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useOtCartSafe } from "@/contexts/OtCartContext";
import { useCart } from "@/contexts/CartContext";

function formatMntPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(price)) + "₮";
}

function formatOtPrice(price: number, currency = "¥") {
  return `${currency}${price.toFixed(2)}`;
}

export function UnifiedCartDrawer() {
  const {
    items: otItems,
    groups: otGroups,
    isLoading: otLoading,
    subtotal: otSubtotal,
    clearCart: clearOtCart,
    updateItemQuantity: updateOtQuantity,
    removeItem: removeOtItem,
    moveToNote,
  } = useOtCartSafe();

  const {
    items: localItems,
    removeFromCart: removeLocalItem,
    updateQuantity: updateLocalQuantity,
    clearCart: clearLocalCart,
    getSubtotal: getLocalSubtotal,
  } = useCart();

  const navigate = useNavigate();
  const localSubtotal = getLocalSubtotal();
  const totalItems = otItems.length + localItems.length;
  const hasOtItems = otItems.length > 0;
  const hasLocalItems = localItems.length > 0;

  const handleCheckout = () => {
    // Navigate to unified checkout (or OT checkout if only OT items)
    if (hasOtItems && !hasLocalItems) {
      navigate("/ot/checkout");
    } else if (hasLocalItems && !hasOtItems) {
      navigate("/checkout");
    } else {
      // Both types - go to unified checkout
      navigate("/checkout");
    }
  };

  // Empty state
  if (otLoading && totalItems === 0) {
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

  if (totalItems === 0) {
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
          <div className="flex gap-2">
            <Link to="/ot">
              <Button variant="outline" size="sm">Маркетплэйс</Button>
            </Link>
            <Link to="/shop">
              <Button variant="outline" size="sm">Дэлгүүр</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SheetHeader>
        <SheetTitle>Сагс ({totalItems} бараа)</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {/* ─── OTAPI Items (Гадаадаас захиалга) ─── */}
        {hasOtItems && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold">Гадаадаас захиалга</span>
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                {otItems.length}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs text-muted-foreground h-6"
                onClick={clearOtCart}
              >
                Хоослох
              </Button>
            </div>

            {otGroups.map((group) => (
              <div key={group.providerType} className="space-y-3 mb-4">
                <Badge variant="outline" className="text-[10px] ml-1">
                  {group.providerType}
                </Badge>
                {group.items.map((item) => (
                  <div key={item.orderLineId} className="flex gap-3 animate-fade-in">
                    <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 border">
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
                          <ShoppingBag className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">{item.title}</h4>
                      <p className="text-primary font-semibold text-sm mt-0.5">
                        {formatOtPrice(item.price, item.currency)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Button variant="outline" size="icon" className="h-6 w-6"
                          onClick={() => updateOtQuantity(item.orderLineId, item.quantity - 1)}
                          disabled={item.quantity <= 1}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6"
                          onClick={() => updateOtQuantity(item.orderLineId, item.quantity + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"
                          onClick={() => moveToNote(item.orderLineId)} title="Тэмдэглэл">
                          <BookmarkMinus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto text-destructive"
                          onClick={() => removeOtItem(item.orderLineId)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="flex justify-between text-sm px-1 text-muted-foreground">
              <span>Гадаад бараа дүн:</span>
              <span className="font-medium text-foreground">{formatOtPrice(otSubtotal)}</span>
            </div>
          </div>
        )}

        {hasOtItems && hasLocalItems && <Separator />}

        {/* ─── Local Items (Бэлэн бараа) ─── */}
        {hasLocalItems && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Package className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold">Бэлэн бараа</span>
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                {localItems.length}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs text-muted-foreground h-6"
                onClick={clearLocalCart}
              >
                Хоослох
              </Button>
            </div>

            <div className="space-y-3">
              {localItems.map((item) => (
                <div key={item.product.id} className="flex gap-3 animate-fade-in">
                  <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 border">
                    {item.product.images && item.product.images[0] ? (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name_mn}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingBag className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-2">{item.product.name_mn}</h4>
                    <p className="text-primary font-semibold text-sm mt-0.5">
                      {formatMntPrice(item.product.price)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Button variant="outline" size="icon" className="h-6 w-6"
                        onClick={() => updateLocalQuantity(item.product.id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6"
                        onClick={() => updateLocalQuantity(item.product.id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto text-destructive"
                        onClick={() => removeLocalItem(item.product.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm px-1 mt-3 text-muted-foreground">
              <span>Бэлэн бараа дүн:</span>
              <span className="font-medium text-foreground">{formatMntPrice(localSubtotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t pt-4 space-y-3">
        {hasOtItems && hasLocalItems && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>🔵 Гадаад бараа:</span>
              <span>{formatOtPrice(otSubtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>🟢 Бэлэн бараа:</span>
              <span>{formatMntPrice(localSubtotal)}</span>
            </div>
          </div>
        )}
        <Separator />
        <div className="space-y-2">
          <SheetClose asChild>
            <Button className="w-full" size="lg" onClick={handleCheckout}>
              Захиалга өгөх
            </Button>
          </SheetClose>
        </div>
      </div>
    </div>
  );
}
