import type { VocabularyItem } from "@/types/vocabulary";
import { CORE_VOCABULARY } from "./coreVocabulary";

/**
 * Context vocabulary the classifier may propose for a given question.
 *
 * Kept deliberately small — only enough to cover the demo paths (breakfast,
 * feelings, needs, personal cups). Grow this as demos require, not
 * speculatively: every entry here is text we are promising to speak on a
 * communicator's behalf.
 */
const CONTEXT_VOCABULARY: VocabularyItem[] = [
  // Food
  {
    id: "food_waffles",
    label: "Waffles",
    spokenPhrase: "I want waffles.",
    category: "food",
    imageUrl: "/default-images/waffles.png",
    iconKey: "utensils",
    allowedForAI: true,
    isCore: false,
  },
  {
    id: "food_pancakes",
    label: "Pancakes",
    spokenPhrase: "I want pancakes.",
    category: "food",
    imageUrl: "/default-images/pancakes.png",
    iconKey: "utensils",
    allowedForAI: true,
    isCore: false,
  },

  {
    id: "food_eat",
    label: "Eat",
    spokenPhrase: "I want to eat.",
    category: "food",
    iconKey: "utensils",
    allowedForAI: true,
    isCore: true,
  },

  // Feelings
  {
    id: "emotion_happy",
    label: "Happy",
    spokenPhrase: "I feel happy.",
    category: "feelings",
    iconKey: "smile",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "emotion_sad",
    label: "Sad",
    spokenPhrase: "I feel sad.",
    category: "feelings",
    iconKey: "frown",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "emotion_angry",
    label: "Angry",
    spokenPhrase: "I feel angry.",
    category: "feelings",
    iconKey: "flame",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "emotion_worried",
    label: "Worried",
    spokenPhrase: "I feel worried.",
    category: "feelings",
    iconKey: "cloud-drizzle",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "emotion_tired",
    label: "Tired",
    spokenPhrase: "I am tired.",
    category: "feelings",
    iconKey: "moon",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "emotion_overwhelmed",
    label: "Overwhelmed",
    spokenPhrase: "I am overwhelmed.",
    category: "feelings",
    iconKey: "cloud",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "emotion_sick",
    label: "Sick",
    spokenPhrase: "I feel sick.",
    category: "feelings",
    iconKey: "thermometer",
    allowedForAI: true,
    isCore: true,
  },

  // Needs
  {
    id: "need_break",
    label: "I need a break",
    spokenPhrase: "I need a break.",
    category: "needs",
    iconKey: "pause",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "need_help",
    label: "I need help",
    spokenPhrase: "I need help.",
    category: "needs",
    iconKey: "life-buoy",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "need_water",
    label: "Water",
    spokenPhrase: "I want water.",
    category: "drink",
    iconKey: "cup-soda",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "need_bathroom",
    label: "Bathroom",
    spokenPhrase: "I need the bathroom.",
    category: "bathroom",
    iconKey: "door-open",
    allowedForAI: true,
    isCore: true,
  },

  // People
  {
    id: "person_mom",
    label: "Mom",
    spokenPhrase: "I want Mom.",
    category: "people",
    iconKey: "user",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "person_dad",
    label: "Dad",
    spokenPhrase: "I want Dad.",
    category: "people",
    iconKey: "user",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "person_teacher",
    label: "Teacher",
    spokenPhrase: "I want my teacher.",
    category: "people",
    iconKey: "user",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "person_friend",
    label: "Friend",
    spokenPhrase: "I want my friend.",
    category: "people",
    iconKey: "users",
    allowedForAI: true,
    isCore: true,
  },

  // Places
  {
    id: "place_home",
    label: "Home",
    spokenPhrase: "I want to go home.",
    category: "places",
    iconKey: "house",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "place_school",
    label: "School",
    spokenPhrase: "I want to go to school.",
    category: "places",
    iconKey: "school",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "place_outside",
    label: "Outside",
    spokenPhrase: "I want to go outside.",
    category: "places",
    iconKey: "trees",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "place_car",
    label: "Car",
    spokenPhrase: "I want to go in the car.",
    category: "places",
    iconKey: "car",
    allowedForAI: true,
    isCore: true,
  },

  // Activities
  {
    id: "activity_play",
    label: "Play",
    spokenPhrase: "I want to play.",
    category: "activities",
    iconKey: "blocks",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "activity_music",
    label: "Music",
    spokenPhrase: "I want music.",
    category: "activities",
    iconKey: "music",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "activity_read",
    label: "Read",
    spokenPhrase: "I want to read.",
    category: "activities",
    iconKey: "book-open",
    allowedForAI: true,
    isCore: true,
  },
  {
    id: "activity_walk",
    label: "Walk",
    spokenPhrase: "I want to go for a walk.",
    category: "activities",
    iconKey: "footprints",
    allowedForAI: true,
    isCore: true,
  },

  // Personal items — these carry caregiver-supplied photos and exist to show
  // that a personal image can stand in for a generic one.
  {
    id: "personal_blue_cup",
    label: "Blue Cup",
    spokenPhrase: "I want my blue cup.",
    category: "drink",
    imageUrl: "/demo-photos/blue-cup.png",
    iconKey: "cup-soda",
    allowedForAI: true,
    isCore: false,
  },
  {
    id: "personal_red_cup",
    label: "Red Cup",
    spokenPhrase: "I want my red cup.",
    category: "drink",
    imageUrl: "/demo-photos/red-cup.png",
    iconKey: "cup-soda",
    allowedForAI: true,
    isCore: false,
  },
];

/** The single source of truth. Nothing outside this list is ever renderable. */
export const approvedVocabulary: VocabularyItem[] = [
  ...CORE_VOCABULARY,
  ...CONTEXT_VOCABULARY,
];
