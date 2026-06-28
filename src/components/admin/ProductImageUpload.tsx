import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, X, Loader2, GripVertical, Link as LinkIcon, Upload, Star, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ProductImageUpload({
  images,
  onImagesChange,
  maxImages = 5,
}: ProductImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDropZoneActive, setIsDropZoneActive] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const slotsLeft = maxImages - images.length;
  const canAddMore = slotsLeft > 0;

  const uploadFiles = async (filesList: FileList | File[]) => {
    const files = Array.from(filesList);
    if (!files.length) return;

    if (!canAddMore) {
      toast({
        title: "Зураг нэмэх боломжгүй",
        description: `Хамгийн ихдээ ${maxImages} зураг`,
        variant: "destructive",
      });
      return;
    }

    const filesToUpload = files.slice(0, slotsLeft);
    setIsUploading(true);

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} зураг биш байна`);
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} хэтэрхий том (5MB хүртэл)`);
        }
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `products/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("products").getPublicUrl(filePath);
        return data.publicUrl;
      });
      const uploaded = await Promise.all(uploadPromises);
      onImagesChange([...images, ...uploaded]);
      toast({ title: `${uploaded.length} зураг нэмэгдлээ` });
    } catch (error: any) {
      toast({ title: "Алдаа", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddExternalUrl = () => {
    const url = externalUrl.trim();
    if (!url) return;
    try { new URL(url); } catch {
      toast({ title: "URL буруу байна", variant: "destructive" });
      return;
    }
    if (!canAddMore) {
      toast({ title: `Хамгийн ихдээ ${maxImages} зураг`, variant: "destructive" });
      return;
    }
    onImagesChange([...images, url]);
    setExternalUrl("");
    setShowUrlInput(false);
    toast({ title: "Зураг нэмэгдлээ" });
  };

  const handleRemoveImage = async (index: number) => {
    const imageUrl = images[index];
    try {
      const urlParts = imageUrl.split("/products/");
      if (urlParts.length > 1) {
        await supabase.storage.from("products").remove([`products/${urlParts[1]}`]);
      }
    } catch (error) {
      console.error("storage delete error:", error);
    }
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onImagesChange(next);
  };

  const setAsMain = (index: number) => move(index, 0);

  // --- Drag & drop reorder ---
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };
  const handleDropItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    move(draggedIndex, index);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // --- File drop zone ---
  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setIsDropZoneActive(true);
  };
  const handleZoneDragLeave = () => setIsDropZoneActive(false);
  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropZoneActive(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-sm font-semibold">Барааны зураг</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {images.length}/{maxImages} зураг · Эхний зураг үндсэн зураг
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowUrlInput((v) => !v)}
            disabled={!canAddMore}
          >
            <LinkIcon className="h-4 w-4 mr-1.5" /> URL
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !canAddMore}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5" />
            )}
            Файл сонгох
          </Button>
        </div>
      </div>

      {/* URL input */}
      {showUrlInput && canAddMore && (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Input
            placeholder="https://example.com/image.jpg"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddExternalUrl())}
            className="flex-1"
            autoFocus
          />
          <Button type="button" size="sm" onClick={handleAddExternalUrl}>Нэмэх</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setShowUrlInput(false); setExternalUrl(""); }}>Болих</Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        className="hidden"
      />

      {/* Drop zone (always-on for file drops) */}
      {canAddMore && (
        <div
          onDragOver={handleZoneDragOver}
          onDragLeave={handleZoneDragLeave}
          onDrop={handleZoneDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center text-center",
            images.length === 0 ? "p-10" : "p-5",
            isDropZoneActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <div className={cn(
            "rounded-full bg-muted flex items-center justify-center transition-transform",
            images.length === 0 ? "h-14 w-14 mb-3" : "h-10 w-10 mb-2",
            isDropZoneActive && "scale-110 bg-primary/10"
          )}>
            <ImagePlus className={cn(
              "text-muted-foreground",
              images.length === 0 ? "h-7 w-7" : "h-5 w-5",
              isDropZoneActive && "text-primary"
            )} />
          </div>
          <p className="text-sm font-medium">
            {isDropZoneActive ? "Энд тавиарай" : "Зургийг чирж тавих эсвэл дарж сонгох"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PNG · JPG · WEBP · 5MB хүртэл · Дахин {slotsLeft}
          </p>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((image, index) => (
            <div
              key={image + index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOverItem(e, index)}
              onDrop={(e) => handleDropItem(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative group aspect-square rounded-xl overflow-hidden border-2 bg-muted transition-all",
                draggedIndex === index && "opacity-40 scale-95",
                dragOverIndex === index && draggedIndex !== index && "border-primary ring-2 ring-primary/30 scale-[1.02]",
                index === 0 ? "border-primary shadow-md" : "border-transparent",
                draggedIndex !== index && dragOverIndex !== index && "hover:border-primary/40"
              )}
            >
              <img
                src={image}
                alt={`Зураг ${index + 1}`}
                className="w-full h-full object-cover pointer-events-none"
              />

              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Position badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1">
                <span className="h-6 min-w-6 px-1.5 rounded-full bg-background/95 text-foreground text-[11px] font-semibold flex items-center justify-center shadow-sm">
                  {index + 1}
                </span>
                {index === 0 && (
                  <span className="h-6 px-2 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center gap-1 shadow-sm">
                    <Star className="h-3 w-3 fill-current" /> Үндсэн
                  </span>
                )}
              </div>

              {/* Drag handle */}
              <div className="absolute top-2 right-2 h-6 w-6 rounded-md bg-background/90 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </div>

              {/* Bottom action bar */}
              <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    className="h-7 w-7 rounded-md bg-background/95 hover:bg-background flex items-center justify-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Зүүн"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === images.length - 1}
                    className="h-7 w-7 rounded-md bg-background/95 hover:bg-background flex items-center justify-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Баруун"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-1">
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => setAsMain(index)}
                      className="h-7 w-7 rounded-md bg-background/95 hover:bg-primary hover:text-primary-foreground flex items-center justify-center shadow-sm transition-colors"
                      title="Үндсэн болгох"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="h-7 w-7 rounded-md bg-destructive/95 hover:bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                    title="Устгах"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 1 && (
        <p className="text-xs text-muted-foreground">
          💡 Зургуудыг чирж дараалал өөрчилнө. Эхний зураг бараа жагсаалт дээр үндсэн зураг болж харагдана.
        </p>
      )}
    </div>
  );
}
