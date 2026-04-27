import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Smartphone, Wallet } from "lucide-react";
import qpayLogo from "@/assets/payments/qpay.webp";
import storepayLogo from "@/assets/payments/storepay.webp";

export type PaymentMethod = "qpay" | "omniway" | "storepay" | "wallet" | "card" | "bank_transfer";

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  logo?: string;
  icon?: React.ReactNode;
  enabled: boolean;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    id: "wallet",
    name: "Хэтэвчнээс төлөх",
    description: "Хэтэвчний үлдэгдлээс шууд төлөх",
    icon: <Wallet className="h-5 w-5" />,
    enabled: true,
  },
  {
    id: "qpay",
    name: "QPay",
    description: "QR кодоор төлөх (бүх банк)",
    logo: qpayLogo,
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
    description: "Хүүгүй хуваан төлөх үйлчилгээ",
    logo: storepayLogo,
    enabled: true,
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
                selected === method.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50 cursor-pointer"
              }`}
            >
              <RadioGroupItem value={method.id} id={`payment-${method.id}`} />
              <Label
                htmlFor={`payment-${method.id}`}
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {method.logo ? (
                    <div className="w-11 h-11 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={method.logo}
                        alt={method.name}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {method.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{method.name}</p>
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
