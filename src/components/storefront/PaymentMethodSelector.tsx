import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Smartphone, Building2 } from "lucide-react";

export type PaymentMethod = "qpay" | "omniway" | "storepay" | "card" | "bank_transfer";

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  badge?: string;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    id: "qpay",
    name: "QPay",
    description: "Банкны аппликейшнээр QR код уншуулж төлөх",
    icon: <Smartphone className="h-5 w-5" />,
    enabled: true,
  },
  {
    id: "omniway",
    name: "OmniWay",
    description: "OmniWay аппликейшнээр хялбар төлөх",
    icon: <Smartphone className="h-5 w-5" />,
    enabled: true,
  },
  {
    id: "storepay",
    name: "Storepay",
    description: "Storepay зээлээр хялбар төлөх",
    icon: <Smartphone className="h-5 w-5" />,
    enabled: true,
    badge: "Зээл",
  },
  {
    id: "card",
    name: "Картаар төлөх",
    description: "Visa, Mastercard картаар онлайн төлбөр",
    icon: <CreditCard className="h-5 w-5" />,
    enabled: false,
    badge: "Тун удахгүй",
  },
  {
    id: "bank_transfer",
    name: "Банк шилжүүлэг",
    description: "Банкны дансруу шууд шилжүүлэх",
    icon: <Building2 className="h-5 w-5" />,
    enabled: false,
    badge: "Тун удахгүй",
  },
];

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  title?: string;
}

export default function PaymentMethodSelector({
  selected,
  onSelect,
  title = "Төлбөрийн хэлбэр",
}: PaymentMethodSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selected}
          onValueChange={(v) => onSelect(v as PaymentMethod)}
          className="space-y-3"
        >
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`flex items-center space-x-3 p-4 border rounded-lg transition-colors ${
                method.enabled
                  ? selected === method.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50 cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <RadioGroupItem
                value={method.id}
                id={`payment-${method.id}`}
                disabled={!method.enabled}
              />
              <Label
                htmlFor={`payment-${method.id}`}
                className={`flex-1 ${method.enabled ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {method.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{method.name}</p>
                      {method.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {method.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {method.description}
                    </p>
                  </div>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
