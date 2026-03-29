import { useEffect } from 'react';

type SeoJsonLdProps = {
  id: string;
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function SeoJsonLd({ id, data }: SeoJsonLdProps) {
  useEffect(() => {
    const scriptId = `seo-jsonld-${id}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = scriptId;
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(data);

    return () => {
      script?.remove();
    };
  }, [data, id]);

  return null;
}
