"use client";

import Image from "next/image";
import { useMemo } from "react";
import { getFullBoardCategories } from "@/lib/board/fullBoard";
import type { RenderableChoice } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import { ChoiceIcon } from "./icons";

/**
 * Every approved word, grouped, with no AI involved.
 *
 * The Default board is a curated 24 tiles for speed. This is the floor
 * underneath it: the other half of the vocabulary — Mom, Dad, Home, School,
 * Play, Worried — existed in the catalog but could only be reached if the
 * classifier happened to propose it, which meant the AI was the only route to
 * half of what someone could say. That inverts the whole idea. The AI
 * surfaces options; it does not hold the keys.
 *
 * Touches no network, no classifier and no asset stream. Bundled artwork if
 * the file exists, the word's symbol otherwise, and a caregiver photo ahead
 * of both.
 */
export function FullBoardScreen({
  profile,
  photos,
  onSpeak,
}: {
  profile: ChildProfile;
  photos?: Map<string, string>;
  onSpeak: (phrase: string) => void;
}) {
  const groups = useMemo(() => getFullBoardCategories(), []);

  return (
    <section className="full-board-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Always available</span>
          <h1>Full board</h1>
          <p>Every word, with no AI and no connection needed.</p>
        </div>
      </div>

      {groups.map((group) => (
        <section className="full-board-group" key={group.key} aria-label={group.label}>
          <h2>{group.label}</h2>
          <div className="full-board-grid">
            {group.choices.map((choice) => (
              <FullBoardTile
                key={choice.id}
                choice={choice}
                photo={photos?.get(choice.id)}
                large={profile.buttonSize === "large"}
                showLabel={profile.textLabelsEnabled}
                onSelect={onSpeak}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function FullBoardTile({
  choice,
  photo,
  large,
  showLabel,
  onSelect,
}: {
  choice: RenderableChoice;
  photo: string | undefined;
  large: boolean;
  showLabel: boolean;
  onSelect: (phrase: string) => void;
}) {
  // `toRenderableChoice` only marks a visual ready when the file is actually
  // on disk, so anything still pending here has no artwork and shows its
  // symbol. Nothing on this screen waits for an image.
  const bundled = choice.visual.status === "ready" ? choice.visual.url : undefined;

  return (
    <button
      type="button"
      className={`aac-card${photo || bundled ? "" : " text-only"}${large ? " large-buttons" : ""}`}
      onClick={() => onSelect(choice.spokenPhrase)}
      aria-label={showLabel ? undefined : choice.label}
    >
      {photo ? (
        // A data URL from the device; next/image cannot optimize it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" />
      ) : bundled ? (
        <Image src={bundled} alt="" width={256} height={256} sizes="(max-width: 800px) 20vw, 140px" />
      ) : (
        <span className="tile-symbol">
          <ChoiceIcon iconKey={choice.iconKey} size={large ? 40 : 34} />
        </span>
      )}
      {showLabel ? <span>{choice.label}</span> : null}
    </button>
  );
}
