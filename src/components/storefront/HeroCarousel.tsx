import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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

  const slide = slides[currentSlide];
  const hasImage = slide.image_url && slide.image_url.length > 0;

  return (
    <div className="relative overflow-hidden rounded-xl md:rounded-2xl">
      <div
        className="relative min-h-[160px] md:min-h-[320px] lg:min-h-[400px] transition-all duration-500 flex items-center"
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
        {!hasImage && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/70" />
        )}

        {hasImage && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
        )}

        <div className="relative z-10 p-4 md:p-8 lg:p-12 max-w-lg" key={currentSlide}>
          {slide.subtitle && (
            <p className="text-white/80 text-xs md:text-sm mb-1">{slide.subtitle}</p>
          )}
          <h2 className="text-white text-lg md:text-3xl lg:text-4xl font-bold mb-3">
            {slide.title}
          </h2>
          {slide.button_link && slide.button_text && (
            <Link to={slide.button_link}>
              <Button size="sm" className="rounded-full text-xs md:text-sm bg-primary hover:bg-primary/90">
                {slide.button_text}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? "bg-white w-5"
                  : "bg-white/40 w-1.5"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
