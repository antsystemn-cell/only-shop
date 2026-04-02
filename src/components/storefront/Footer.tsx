import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram } from "lucide-react";
import onlyLogo from "@/assets/only-logo.png";

export function Footer() {
  return (
    <footer className="bg-foreground text-background/80 pb-20 md:pb-0">
      <div className="container py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2">
              <img src={onlyLogo} alt="Only" className="h-8 w-auto brightness-0 invert" />
            </Link>
            <p className="text-sm text-background/50">
              Монголын шилдэг онлайн дэлгүүр. Чанартай бүтээгдэхүүн, хурдан хүргэлт.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-background text-sm">Холбоосууд</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/shop" className="text-background/50 hover:text-primary transition-colors">Дэлгүүр</Link></li>
              <li><Link to="/page/terms_of_use" className="text-background/50 hover:text-primary transition-colors">Үйлчилгээний нөхцөл</Link></li>
              <li><Link to="/page/privacy-policy" className="text-background/50 hover:text-primary transition-colors">Нууцлалын бодлого</Link></li>
              <li><Link to="/page/faq" className="text-background/50 hover:text-primary transition-colors">Түгээмэл асуултууд</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-background text-sm">Холбоо барих</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-background/50">
                <Phone className="h-4 w-4 text-primary" />
                <span>+976 7299-2222</span>
              </li>
              <li className="flex items-center gap-2 text-background/50">
                <Mail className="h-4 w-4 text-primary" />
                <span>info@only.mn</span>
              </li>
              <li className="flex items-start gap-2 text-background/50">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Улаанбаатар хот</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-background text-sm">Сошиал</h3>
            <div className="flex gap-3">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-background/10 hover:bg-primary hover:text-primary-foreground transition-colors">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-background/10 hover:bg-primary hover:text-primary-foreground transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10 mt-8 pt-6 text-center text-xs text-background/30">
          <p>&copy; {new Date().getFullYear()} Only. Бүх эрх хуулиар хамгаалагдсан.</p>
        </div>
      </div>
    </footer>
  );
}
