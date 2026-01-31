import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
          <SheetTitle>Сагс</SheetTitle>
        </SheetHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 rounded-full bg-muted">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Сагс хоосон байна</p>
            <p className="text-sm text-muted-foreground">
              Бараа нэмж эхлээрэй
            </p>
          </div>
          <Link to="/shop">
            <Button className="mt-4">
              Дэлгүүр үзэх
            </Button>
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

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {items.map((item) => (
          <div key={item.product.id} className="flex gap-4 animate-fade-in">
            {/* Product Image */}
            <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden shrink-0">
              {item.product.images && item.product.images[0] ? (
                <img
                  src={item.product.images[0]}
                  alt={item.product.name_mn}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ShoppingBag className="h-6 w-6" />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm line-clamp-2">
                {item.product.name_mn}
              </h4>
              <p className="text-primary font-semibold mt-1">
                {formatPrice(item.product.price)}
              </p>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
                  onClick={() => removeFromCart(item.product.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
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
          <Button
            variant="outline"
            className="w-full"
            onClick={clearCart}
          >
            Сагс хоослох
          </Button>
        </div>
      </div>
    </div>
  );
}
