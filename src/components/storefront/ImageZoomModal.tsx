import { useState, useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";

interface ImageZoomModalProps {
  images: string[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageZoomModal({ images, initialIndex, open, onOpenChange }: ImageZoomModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [initialIndex, open]);

  // Push history state when modal opens so back button closes modal
  useEffect(() => {
    if (!open) return;
    const handlePop = () => {
      onOpenChange(false);
    };
    window.history.pushState({ imageZoom: true }, "");
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
    };
  }, [open, onOpenChange]);

  const closeModal = useCallback(() => {
    // Pop the history entry we pushed
    if (window.history.state?.imageZoom) {
      window.history.back();
    } else {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  // Click on backdrop (not on image/buttons) closes modal
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (scale > 1) return; // don't close while zoomed
    const target = e.target as HTMLElement;
    // Only close if clicking the backdrop div itself, not children like image
    if (target === e.currentTarget) {
      closeModal();
    }
  }, [scale, closeModal]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
    resetZoom();
  }, [resetZoom]);

  const goPrev = useCallback(() => {
    goTo((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, goTo]);

  const goNext = useCallback(() => {
    goTo((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, goTo]);

  const toggleZoom = useCallback(() => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  }, [scale, resetZoom]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goPrev, goNext, closeModal]);

  // Mouse drag for panning when zoomed
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({ x: posStart.current.x + dx, y: posStart.current.y + dy });
  }, [isDragging, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch swipe for navigation (when not zoomed) and panning (when zoomed)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      if (scale > 1) {
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        posStart.current = { ...position };
        setIsDragging(true);
      }
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setPosition({ x: posStart.current.x + dx, y: posStart.current.y + dy });
    }
  }, [isDragging, scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setIsDragging(false);
    if (scale > 1) return; // Don't swipe when zoomed
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const absDx = Math.abs(dx);
    if (absDx > 50) {
      if (dx > 0) goPrev();
      else goNext();
    }
  }, [scale, goPrev, goNext]);

  if (!images.length) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) closeModal(); }}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 border-0 bg-black/95 [&>button]:hidden">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 safe-area-top">
          <span className="text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full">
            {currentIndex + 1} / {images.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-9 w-9"
              onClick={toggleZoom}
            >
              {scale > 1 ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-9 w-9"
              onClick={closeModal}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Image + backdrop click */}
        <div
          className="flex items-center justify-center w-full h-full select-none"
          onClick={handleBackdropClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
        >
          <img
            ref={imageRef}
            src={images[currentIndex]}
            alt=""
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            }}
            draggable={false}
            onDoubleClick={(e) => { e.stopPropagation(); toggleZoom(); }}
            onClick={(e) => e.stopPropagation()}
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-10 w-10"
              onClick={goPrev}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-10 w-10"
              onClick={goNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 max-w-[90vw] overflow-x-auto px-2 pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  i === currentIndex ? "border-white ring-1 ring-white/50" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
