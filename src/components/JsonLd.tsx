/**
 * Structured data block renderer for JSON-LD schemas.
 *
 * NOTE: (§7.3) Escapes opening angle brackets to prevent XSS and premature script tag closure.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

