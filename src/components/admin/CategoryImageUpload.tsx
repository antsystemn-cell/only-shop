import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, X, Loader2 } from "lucide-react";

interface CategoryImageUploadProps {
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
}

export function CategoryImageUpload({
  imageUrl,
  onImageChange,
}: CategoryImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Алдаа",
        description: "Зөвхөн зураг оруулах боломжтой",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Алдаа",
        description: "Зураг хэтэрхий том байна (5MB хүртэл)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Delete old image if exists
      if (imageUrl) {
        const urlParts = imageUrl.split("/categories/");
        if (urlParts.length > 1) {
          const filePath = `categories/${urlParts[1]}`;
          await supabase.storage.from("categories").remove([filePath]);
        }
      }

      // Create unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `categories/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("categories")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("categories")
        .getPublicUrl(filePath);

      onImageChange(publicUrlData.publicUrl);

      toast({
        title: "Амжилттай",
        description: "Зураг орууллаа",
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

  const handleRemoveImage = async () => {
    if (imageUrl) {
      try {
        const urlParts = imageUrl.split("/categories/");
        if (urlParts.length > 1) {
          const filePath = `categories/${urlParts[1]}`;
          await supabase.storage.from("categories").remove([filePath]);
        }
      } catch (error) {
        console.error("Error deleting image from storage:", error);
      }
    }
    onImageChange(null);
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Ангилалын зураг</span>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {imageUrl ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted group">
          <img
            src={imageUrl}
            alt="Category"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Солих"
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-8 w-8"
              onClick={handleRemoveImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
          ) : (
            <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            Зураг оруулах
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PNG, JPG, WEBP (5MB хүртэл)
          </p>
        </div>
      )}
    </div>
  );
}
