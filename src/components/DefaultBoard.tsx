"use client";

import Image from "next/image";
import { Delete } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChildProfile } from "@/types/profile";
import type { VocabularyItem } from "@/types/vocabulary";
import { resolveDefaultBoard } from "@/lib/board/defaultBoardLayout";
import { imageExists } from "@/lib/images/imageManifest";
import { ChoiceIcon } from "./icons";

/**
 * The manual board.
 *
 * Works with no OpenAI key, no Supabase, and no network: every tile comes from
 * the approved vocabulary and every picture is bundled with the app. This is
 * the floor the whole product stands on — if the AI side is broken, this is
 * still a complete communication device.
 */
export function DefaultBoard({
  profile,
  photos,
  onSpeak,
}: {
  profile: ChildProfile;
  /** Caregiver photos by vocabulary id. These outrank the bundled artwork. */
  photos?: Map<string, string>;
  onSpeak: (phrase: string) => void;
}) {
  const rows = useMemo(() => resolveDefaultBoard(), []);
  const [message, setMessage] = useState<VocabularyItem[]>([]);

  function selectWord(item: VocabularyItem) {
    setMessage((current) => [...current, item]);
    onSpeak(item.label);
  }

  const sentence = message.map((item) => item.label).join(" ");

  return (
    <section className="board-view">
      <section className="aac-content" aria-label="Default AAC vocabulary">
        {rows.map((row) => (
          <section className={`aac-row aac-row-${row.category}`} key={row.category} aria-label={row.label}>
            <div className="aac-grid">
              {row.items.map((item) => (
                <AacTile
                  key={item.id}
                  item={item}
                  photo={photos?.get(item.id)}
                  large={profile.buttonSize === "large"}
                  showLabel={profile.textLabelsEnabled}
                  onSelect={selectWord}
                />
              ))}
            </div>
          </section>
        ))}
      </section>

      <section className="message-bar" aria-label="Message">
        <div className="message-layout">
          <div className="message-heading">
            <h2>Your message</h2>
            <span>
              {message.length} {message.length === 1 ? "word" : "words"}
            </span>
          </div>
          <div className="message-box">
            <div className="message-chips" aria-live="polite">
              {message.length ? (
                message.map((item, index) => (
                  <span className="message-chip" key={`${item.id}-${index}`}>
                    {item.label}
                  </span>
                ))
              ) : (
                <span className="message-empty">Tap a picture to build a sentence</span>
              )}
            </div>
            <div className="message-actions">
              <button
                type="button"
                aria-label="Delete last word"
                disabled={!message.length}
                onClick={() => setMessage((current) => current.slice(0, -1))}
              >
                <Delete aria-hidden="true" size={22} />
              </button>
              <button type="button" disabled={!message.length} onClick={() => setMessage([])}>
                Clear
              </button>
              <button
                type="button"
                className="speak-message"
                disabled={!message.length}
                onClick={() => onSpeak(sentence)}
              >
                Speak
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function AacTile({
  item,
  photo,
  large,
  showLabel,
  onSelect,
}: {
  item: VocabularyItem;
  photo: string | undefined;
  large: boolean;
  showLabel: boolean;
  onSelect: (item: VocabularyItem) => void;
}) {
  // The manifest is generated at build time from what is actually in public/,
  // so a catalog entry naming an asset that was never produced renders its
  // icon instead of a broken-image box.
  // Personal photo first, exactly as the image priority specifies: a drawing
  // of a cup is not this person's cup.
  const bundled = item.imageUrl && imageExists(item.imageUrl) ? item.imageUrl : undefined;
  const image = photo ?? bundled;

  return (
    <button
      type="button"
      className={`aac-card${image ? "" : " text-only"}${large ? " large-buttons" : ""}`}
      onClick={() => onSelect(item)}
      aria-label={showLabel ? undefined : item.label}
    >
      {photo ? (
        // A data URL from the device; next/image cannot optimize it and must
        // not try.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" />
      ) : image ? (
        <Image src={image} alt="" width={256} height={256} sizes="(max-width: 800px) 16vw, 180px" />
      ) : (
        <span className="tile-symbol">
          <ChoiceIcon iconKey={item.iconKey} size={large ? 48 : 40} />
        </span>
      )}
      {showLabel ? <span>{item.label}</span> : null}
    </button>
  );
}
