import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";

function formatPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(price) + "₮";
}

export function CartDrawer() {
  const { items, removeFromCart, updateQuantity, getSubtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const subtotal = getSubtotal();

  const handleCheckout = () => {
    navigate("/checkout");
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <SheetHeader>
          <SheetTitle className="text-lg">Сагс</SheetTitle>
        </SheetHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Сагс хоосон байна</p>
            <p className="text-sm text-muted-foreground mt-1">Бараа нэмж эхлээрэй</p>
          </div>
          <Link to="/shop">
            <Button className="rounded-xl mt-2">Дэлгүүр үзэх</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SheetHeader>
        <SheetTitle className="text-lg">Сагс ({items.length})</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {items.map((item) => (
          <div key={item.product.id} className="flex gap-3 p-3 rounded-xl bg-muted/50 animate-fade-in">
            <div className="w-16 h-16 rounded-xl bg-card overflow-hidden shrink-0 border">
              {item.product.images && item.product.images[0] ? (
                <img src={item.product.images[0]} alt={item.product.name_mn} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm line-clamp-2 leading-tight">{item.product.name_mn}</h4>
              <p className="text-primary font-bold text-sm mt-1">{formatPrice(item.product.price)}</p>
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-destructive hover:text-destructive rounded-lg" onClick={() => removeFromCart(item.product.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-muted-foreground text-sm">Нийт дүн</span>
          <span className="text-xl font-bold text-primary">{formatPrice(subtotal)}</span>
        </div>
        <SheetClose asChild>
          <Button className="w-full rounded-xl h-12 text-base font-semibold" onClick={handleCheckout}>
            Захиалга өгөх
          </Button>
        </SheetClose>
        <Button variant="ghost" className="w-full text-muted-foreground text-sm" onClick={clearCart}>
          Сагс хоослох
        </Button>
      </div>
    </div>
  );
}
