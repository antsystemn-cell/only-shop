import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  cta: string;
  link: string;
  bgClass: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: "Шинэ бараанууд",
    subtitle: "Хамгийн сүүлийн үеийн загварууд ирлээ",
    cta: "Үзэх",
    link: "/shop?new=true",
    bgClass: "gradient-hero",
  },
  {
    id: 2,
    title: "Хямдрал 50%",
    subtitle: "Сонгогдсон бүтээгдэхүүнүүдэд",
    cta: "Хямдралаа үзэх",
    link: "/shop?sale=true",
    bgClass: "bg-gradient-to-r from-brand-blue-dark via-destructive/80 to-brand-blue",
  },
  {
    id: 3,
    title: "Үнэгүй хүргэлт",
    subtitle: "100,000₮-с дээш захиалгад",
    cta: "Дэлгүүр үзэх",
    link: "/shop",
    bgClass: "bg-gradient-to-r from-brand-blue to-brand-blue-light",
  },
];

export function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const goToPrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const slide = slides[currentSlide];

  return (
    <div className="relative overflow-hidden">
      <div
        className={`${slide.bgClass} text-white py-20 md:py-32 transition-all duration-500`}
      >
        <div className="container relative z-10">
          <div className="max-w-2xl animate-fade-in" key={currentSlide}>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-glow">
              {slide.title}
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8">
              {slide.subtitle}
            </p>
            <Link to={slide.link}>
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 glow-green"
              >
                {slide.cta}
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-10 right-40 w-48 h-48 rounded-full bg-white blur-2xl" />
        </div>
      </div>

      {/* Navigation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white"
        onClick={goToPrev}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white"
        onClick={goToNext}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentSlide
                ? "bg-primary w-6"
                : "bg-white/50 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
