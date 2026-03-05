import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrderGuide() {
  return (
    <div className="container py-8 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Нүүр</Link>
      </Button>

      <h1 className="text-2xl font-bold mb-6">Захиалга хийх заавар</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Компьютерээс захиалга хийх заавар</h2>
          <div className="aspect-video rounded-lg overflow-hidden border">
            <iframe
              src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fonlymng%2Fvideos%2F303755125531468%2F&show_text=0&width=560"
              width="100%"
              height="100%"
              style={{ border: "none", overflow: "hidden" }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Гар утаснаас захиалга хийх заавар</h2>
          <div className="aspect-[9/16] max-w-xs mx-auto rounded-lg overflow-hidden border">
            <iframe
              src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fonlymng%2Fvideos%2F1978388145896780%2F&show_text=0&width=221"
              width="100%"
              height="100%"
              style={{ border: "none", overflow: "hidden" }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
