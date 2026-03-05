import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DOMPurify from "dompurify";

interface DynamicContentPageProps {
  slug?: string;
}

export default function DynamicContentPage({ slug: propSlug }: DynamicContentPageProps) {
  const { slug: paramSlug } = useParams();
  const slug = propSlug || paramSlug;

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["content-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pages")
        .select("*")
        .eq("slug", slug!)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="container py-8 max-w-4xl">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-10 w-3/4 mb-6" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="container py-8 max-w-4xl text-center">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Нүүр</Link>
        </Button>
        <h1 className="text-2xl font-bold mb-4">Хуудас олдсонгүй</h1>
        <p className="text-muted-foreground">Энэ хуудас одоогоор бэлэн болоогүй байна.</p>
      </div>
    );
  }

  const sanitizedContent = DOMPurify.sanitize(page.content || "", {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "src", "width", "height", "style"],
  });

  return (
    <div className="container py-8 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Нүүр</Link>
      </Button>

      <h1 className="text-2xl font-bold mb-6">{page.title}</h1>

      <div
        className="prose prose-sm max-w-none [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold [&_img]:rounded-lg [&_img]:max-w-full [&_iframe]:rounded-lg [&_iframe]:max-w-full [&_iframe]:aspect-video [&_iframe]:w-full"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    </div>
  );
}
