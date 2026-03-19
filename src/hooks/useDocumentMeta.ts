import { useEffect } from "react";

interface DocumentMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

function setMetaTag(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement | null;
  }
  if (el) {
    el.setAttribute("content", content);
  } else {
    el = document.createElement("meta");
    if (property.startsWith("og:") || property.startsWith("twitter:")) {
      el.setAttribute("property", property);
    } else {
      el.setAttribute("name", property);
    }
    el.setAttribute("content", content);
    document.head.appendChild(el);
  }
}

export function useDocumentMeta(meta: DocumentMeta) {
  useEffect(() => {
    const prevTitle = document.title;

    if (meta.title) {
      document.title = `${meta.title} | Онли`;
      setMetaTag("og:title", meta.title);
      setMetaTag("twitter:title", meta.title);
    }
    if (meta.description) {
      setMetaTag("description", meta.description);
      setMetaTag("og:description", meta.description);
      setMetaTag("twitter:description", meta.description);
    }
    if (meta.image) {
      setMetaTag("og:image", meta.image);
      setMetaTag("twitter:image", meta.image);
    }
    if (meta.url) {
      setMetaTag("og:url", meta.url);
    }
    if (meta.type) {
      setMetaTag("og:type", meta.type);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [meta.title, meta.description, meta.image, meta.url, meta.type]);
}
