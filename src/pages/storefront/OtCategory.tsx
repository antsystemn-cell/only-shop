import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { fetchSubcategories } from "@/services/otApi";
import { OtCategoryCardComponent } from "@/components/storefront/OtCategoryCard";
import { Button } from "@/components/ui/button";

export default function OtCategory() {
  const { categoryId } = useParams<{ categoryId: string }>();

  const { data: subcategories, isLoading } = useQuery({
    queryKey: ["ot-subcategories", categoryId],
    queryFn: () => fetchSubcategories(categoryId!),
    enabled: !!categoryId,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div className="container py-6 md:py-8 animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/ot">
          <Button variant="ghost" size="sm">
            ← Буцах
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Дэд ангилалууд</h1>
      </div>

      {/* Browse by category link */}
      <div className="mb-6">
        <Link to={`/ot?category=${categoryId}`}>
          <Button variant="default">
            Энэ ангилалын бараа харах →
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : subcategories && subcategories.length > 0 ? (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-4">
          {subcategories.map((cat) => (
            <OtCategoryCardComponent key={cat.id} category={cat} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Дэд ангилал олдсонгүй</p>
          <Link to={`/ot?category=${categoryId}`} className="mt-4 inline-block">
            <Button>Бараа харах</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
