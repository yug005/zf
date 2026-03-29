import { useEffect } from 'react';

type PageMetaProps = {
  title: string;
  description?: string;
  canonicalPath?: string;
  noIndex?: boolean;
};

const DEFAULT_DESCRIPTION =
  'Zer0Friction helps teams monitor websites, APIs, SSL, DNS, incidents, status pages, and deploy health from one focused dashboard.';

function upsertMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let tag = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

export function PageMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  noIndex = false,
}: PageMetaProps) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const canonicalUrl = canonicalPath
      ? new URL(canonicalPath, window.location.origin).toString()
      : window.location.href;

    upsertMeta('description', description);
    upsertMeta('application-name', 'Zer0Friction');
    upsertMeta('theme-color', '#0f172a');
    upsertMeta('og:title', title, 'property');
    upsertMeta('og:description', description, 'property');
    upsertMeta('og:type', 'website', 'property');
    upsertMeta('og:url', canonicalUrl, 'property');
    upsertMeta('twitter:card', 'summary_large_image');
    upsertMeta('twitter:title', title);
    upsertMeta('twitter:description', description);
    upsertMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    upsertLink('canonical', canonicalUrl);

    return () => {
      document.title = previousTitle;
    };
  }, [canonicalPath, description, noIndex, title]);

  return null;
}
