import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, X, Loader2, GripVertical } from "lucide-react";
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
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleAddExternalUrl = () => {
    const url = externalUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast({ title: "URL буруу байна", variant: "destructive" });
      return;
    }
    if (images.length >= maxImages) {
      toast({ title: `Хамгийн ихдээ ${maxImages} зураг`, variant: "destructive" });
      return;
    }
    onImagesChange([...images, url]);
    setExternalUrl("");
    setShowUrlInput(false);
    toast({ title: "Зураг нэмэгдлээ" });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Зураг нэмэх боломжгүй",
        description: `Хамгийн ихдээ ${maxImages} зураг оруулах боломжтой`,
        variant: "destructive",
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} зураг биш байна`);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} хэтэрхий том байна (5MB хүртэл)`);
        }

        // Create unique filename
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("products")
          .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      onImagesChange([...images, ...uploadedUrls]);

      toast({
        title: "Зураг амжилттай орууллаа",
        description: `${uploadedUrls.length} зураг нэмэгдлээ`,
      });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = async (index: number) => {
    const imageUrl = images[index];
    
    // Extract file path from URL for deletion
    try {
      const urlParts = imageUrl.split("/products/");
      if (urlParts.length > 1) {
        const filePath = `products/${urlParts[1]}`;
        await supabase.storage.from("products").remove([filePath]);
      }
    } catch (error) {
      console.error("Error deleting image from storage:", error);
    }

    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    onImagesChange(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium">
          Барааны зураг ({images.length}/{maxImages})
        </span>
        {images.length < maxImages && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4 mr-2" />
              )}
              Файл оруулах
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              🔗 URL оруулах
            </Button>
          </div>
        )}
      </div>

      {showUrlInput && images.length < maxImages && (
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/image.jpg"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddExternalUrl())}
            className="flex-1"
          />
          <Button type="button" size="sm" onClick={handleAddExternalUrl}>Нэмэх</Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {images.map((image, index) => (
            <div
              key={image}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative group aspect-square rounded-lg overflow-hidden border-2 bg-muted cursor-move transition-all",
                draggedIndex === index ? "opacity-50 border-primary" : "border-transparent hover:border-primary/50",
                index === 0 && "ring-2 ring-primary ring-offset-2"
              )}
            >
              <img
                src={image}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Drag handle */}
              <div className="absolute top-1 left-1 p-1 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-3 w-3 text-white" />
              </div>

              {/* Remove button */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveImage(index)}
              >
                <X className="h-3 w-3" />
              </Button>

              {/* Main image badge */}
              {index === 0 && (
                <div className="absolute bottom-1 left-1 right-1 bg-primary/90 text-primary-foreground text-xs text-center py-0.5 rounded">
                  Үндсэн зураг
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <ImagePlus className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Зураг оруулахын тулд дарна уу
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PNG, JPG, WEBP (5MB хүртэл)
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Чирж байрлалыг өөрчлөх боломжтой. Эхний зураг үндсэн зураг болно.
      </p>
    </div>
  );
}
