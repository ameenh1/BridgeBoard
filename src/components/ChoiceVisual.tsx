"use client";

import Image from "next/image";
import type { ChoiceVisual as ChoiceVisualData } from "@/types/board";
import { ChoiceIcon } from "./icons";

/**
 * Bundled artwork lives under this prefix and is the only thing allowed
 * through `next/image`. Everything else is a runtime-resolved asset.
 */
const BUNDLED_PREFIX = "/default-images/";

/**
 * Whether a runtime-resolved URL may be used as an image source.
 *
 * The server already re-encodes every web result through sharp and hands back
 * either an inline WebP or a signed Supabase URL, so a provider's own URL
 * should never reach the browser as a `src`. This is the belt-and-braces
 * check on that: an arbitrary remote URL is not rendered, and neither is
 * anything carrying credentials or a non-image data payload.
 */
export function isRenderableVisualUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (url.startsWith(BUNDLED_PREFIX)) return true;
  if (/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/**
 * One tile's picture area.
 *
 * The space is reserved by aspect ratio before anything loads, so a picture
 * arriving later never reflows the board under someone's finger. The icon sits
 * underneath at every stage — pending, unavailable, or failed-to-decode — so
 * the tile is legible and selectable from the first paint.
 */
export function ChoiceVisual({
  visual,
  iconKey,
  label,
  large = false,
}: {
  visual: ChoiceVisualData;
  iconKey: string | undefined;
  label: string;
  large?: boolean;
}) {
  const ready = visual.status === "ready" && isRenderableVisualUrl(visual.url);
  const bundled = ready && visual.url!.startsWith(BUNDLED_PREFIX);

  return (
    <span className={`choice-visual${large ? " is-large" : ""}`} data-status={visual.status}>
      {ready ? (
        bundled ? (
          <Image
            src={visual.url!}
            alt=""
            width={256}
            height={256}
            className="choice-visual-img"
            sizes="(max-width: 800px) 22vw, 180px"
          />
        ) : (
          // Runtime assets are inline WebP or short-lived signed URLs. They
          // cannot be optimized ahead of time and must not be routed through
          // the image optimizer, so they render as a plain element.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={visual.url} alt="" className="choice-visual-img" loading="lazy" decoding="async" />
        )
      ) : (
        <span className="choice-symbol">
          <ChoiceIcon iconKey={iconKey} size={large ? 52 : 44} />
        </span>
      )}

      {visual.status === "pending" ? (
        <span className="visual-status" role="status">
          <span className="visual-spinner" aria-hidden="true" />
          <span className="sr-only">Finding a picture for {label}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Attribution, shown only when the provider supplied it. */
export function VisualAttribution({ visual }: { visual: ChoiceVisualData }) {
  if (!visual.attribution) return null;
  const href = visual.sourceUrl;
  return (
    <small className="visual-attribution">
      {href && isRenderableVisualUrl(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {visual.attribution}
        </a>
      ) : (
        visual.attribution
      )}
    </small>
  );
}
