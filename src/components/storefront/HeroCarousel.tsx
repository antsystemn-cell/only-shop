import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  button_text: string | null;
  button_link: string | null;
  display_order: number | null;
  is_active: boolean | null;
}

// Fallback slides when no banners in database
const fallbackSlides = [
  {
    id: "1",
    title: "Шинэ бараанууд",
    subtitle: "Хамгийн сүүлийн үеийн загварууд ирлээ",
    button_text: "Үзэх",
    button_link: "/shop?new=true",
    image_url: "",
  },
  {
    id: "2",
    title: "Хямдрал 50%",
    subtitle: "Сонгогдсон бүтээгдэхүүнүүдэд",
    button_text: "Хямдралаа үзэх",
    button_link: "/shop?sale=true",
    image_url: "",
  },
  {
    id: "3",
    title: "Үнэгүй хүргэлт",
    subtitle: "100,000₮-с дээш захиалгад",
    button_text: "Дэлгүүр үзэх",
    button_link: "/shop",
    image_url: "",
  },
];

export function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: banners } = useQuery({
    queryKey: ["banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Banner[];
    },
  });

  const slides = banners && banners.length > 0 ? banners : fallbackSlides;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

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
  const hasImage = slide.image_url && slide.image_url.length > 0;

  return (
    <div className="relative overflow-hidden">
      <div
        className="text-white min-h-[50vh] md:min-h-[70vh] lg:min-h-[80vh] transition-all duration-500 relative flex items-center"
        style={
          hasImage
            ? {
                backgroundImage: `url(${slide.image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {/* Gradient background when no image */}
        {!hasImage && (
          <div className="absolute inset-0 gradient-hero" />
        )}
        
        {/* Subtle overlay for text readability */}
        {hasImage && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
        )}
        
        <div className="container relative z-10">
          <div className="max-w-xl animate-fade-in" key={currentSlide}>
            {/* Brand subtitle */}
            {slide.subtitle && (
              <p className="text-lg md:text-xl text-white/90 mb-2 font-light">
                {slide.subtitle}
              </p>
            )}
            {/* Main title */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 text-white drop-shadow-lg">
              {slide.title}
            </h1>
            {slide.button_link && slide.button_text && (
              <Link to={slide.button_link}>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                >
                  {slide.button_text}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {slides.length > 1 && (
        <>
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
        </>
      )}

      {/* Dots */}
      {slides.length > 1 && (
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
      )}
    </div>
  );
}
