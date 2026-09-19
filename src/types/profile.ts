/**
 * Caregiver-configurable presentation settings.
 *
 * Deliberately small: no demographic fields, no medical fields, nothing that
 * would make this look like a clinical record.
 */
export type ChildProfile = {
  id: string;

  /** Upper bound on how many choices a board may show. */
  maxChoices: 2 | 4 | 6;

  visuals: "photos_first" | "mixed" | "icons_first";

  speechEnabled: boolean;
  quietMode: boolean;
  textLabelsEnabled: boolean;
  historyEnabled: boolean;
};

/** Used whenever no profile is stored, or stored settings fail to parse. */
export const DEFAULT_PROFILE: ChildProfile = {
  id: "default-profile",
  maxChoices: 4,
  visuals: "photos_first",
  speechEnabled: true,
  quietMode: false,
  textLabelsEnabled: true,
  historyEnabled: true,
};
