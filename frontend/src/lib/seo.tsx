import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE = 'Farm2Home';
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const DEFAULT_DESCRIPTION =
  'Buy fresh fruit, vegetables, plantation crops, honey and livestock products directly from verified Indian farms.';

interface PageMetaProps {
  title?: string;
  description?: string;
  image?: string | null;
  /** Keep private or transient pages out of search results. */
  noindex?: boolean;
  type?: 'website' | 'product' | 'profile';
  jsonLd?: object;
}

export function PageMeta({ title, description = DEFAULT_DESCRIPTION, image, noindex, type = 'website', jsonLd }: PageMetaProps) {
  const { pathname } = useLocation();
  const fullTitle = title ? `${title} · ${SITE}` : `${SITE} — Fresh from verified farms`;
  const canonical = SITE_URL ? `${SITE_URL}${pathname}` : undefined;
  const absoluteImage = image && SITE_URL && image.startsWith('/') ? `${SITE_URL}${image}` : image;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
      {canonical && !noindex ? <link rel="canonical" href={canonical} /> : null}
      <meta property="og:site_name" content={SITE} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {absoluteImage ? <meta property="og:image" content={absoluteImage} /> : null}
      <meta name="twitter:card" content={absoluteImage ? 'summary_large_image' : 'summary'} />
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Helmet>
  );
}

export function siteUrl(path: string) {
  return SITE_URL ? `${SITE_URL}${path}` : path;
}
