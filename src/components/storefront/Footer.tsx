import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram } from "lucide-react";
import onlyLogo from "@/assets/only-logo.png";

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={onlyLogo} alt="Only" className="h-10 w-auto" />
              <span className="text-xl font-bold text-primary">Only</span>
            </Link>
            <p className="text-sm text-secondary-foreground/70">
              Монголын шилдэг онлайн дэлгүүр. Чанартай бүтээгдэхүүн, хурдан хүргэлт.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary">Холбоосууд</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/shop" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                  Дэлгүүр
                </Link>
              </li>
              <li>
                <Link to="/categories" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                  Ангилал
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                  Бидний тухай
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                  Холбоо барих
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary">Холбоо барих</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-secondary-foreground/70">
                <Phone className="h-4 w-4 text-primary" />
                <span>+976 7700-0000</span>
              </li>
              <li className="flex items-center gap-2 text-secondary-foreground/70">
                <Mail className="h-4 w-4 text-primary" />
                <span>info@only.mn</span>
              </li>
              <li className="flex items-start gap-2 text-secondary-foreground/70">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Улаанбаатар хот, Сүхбаатар дүүрэг</span>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary">Сошиал</h3>
            <div className="flex gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-secondary-foreground/10 hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-secondary-foreground/10 hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-secondary-foreground/10 mt-8 pt-8 text-center text-sm text-secondary-foreground/50">
          <p>&copy; {new Date().getFullYear()} Only. Бүх эрх хуулиар хамгаалагдсан.</p>
        </div>
      </div>
    </footer>
  );
}
