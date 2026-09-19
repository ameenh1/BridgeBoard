"use client";

import {
  AlertCircle, ArrowRight, ArrowRightLeft, Ban, Blocks, BookOpen, Car, Check,
  CheckCheck, CircleHelp, Clock, Cloud, CloudDrizzle, CupSoda, DoorOpen,
  Ellipsis, Flame, Footprints, Frown, Hand, HandHeart, Heart, HeartPulse,
  Hourglass, House, LayoutGrid, LifeBuoy, MapPin, MessageCircle, Moon, Music,
  Pause, Plus, RotateCcw, School, Shapes, Smile, Thermometer, ThumbsDown,
  Trees, User, Users, Utensils, Waves, X, type LucideIcon,
} from "lucide-react";
import type { BoardAction } from "@/types/board";

/**
 * Every `iconKey` the approved vocabulary can name.
 *
 * A tile whose picture has not arrived still has to say something, so the icon
 * is the floor beneath every visual — never a placeholder for a missing label.
 * Unknown keys fall back to a neutral shape rather than rendering nothing.
 */
export const ICONS: Record<string, LucideIcon> = {
  "arrow-right": ArrowRight,
  "arrow-right-left": ArrowRightLeft,
  ban: Ban,
  blocks: Blocks,
  "book-open": BookOpen,
  car: Car,
  check: Check,
  "check-check": CheckCheck,
  "circle-help": CircleHelp,
  clock: Clock,
  cloud: Cloud,
  "cloud-drizzle": CloudDrizzle,
  "cup-soda": CupSoda,
  "door-open": DoorOpen,
  ellipsis: Ellipsis,
  flame: Flame,
  footprints: Footprints,
  frown: Frown,
  hand: Hand,
  "hand-heart": HandHeart,
  heart: Heart,
  "heart-pulse": HeartPulse,
  hourglass: Hourglass,
  house: House,
  "life-buoy": LifeBuoy,
  "map-pin": MapPin,
  "message-circle": MessageCircle,
  moon: Moon,
  music: Music,
  pause: Pause,
  plus: Plus,
  "rotate-ccw": RotateCcw,
  school: School,
  shapes: Shapes,
  smile: Smile,
  thermometer: Thermometer,
  "thumbs-down": ThumbsDown,
  trees: Trees,
  user: User,
  users: Users,
  utensils: Utensils,
  waves: Waves,
  x: X,
};

export function ChoiceIcon({
  iconKey,
  size = 44,
}: {
  iconKey: string | undefined;
  size?: number;
}) {
  const Icon = (iconKey && ICONS[iconKey]) || Shapes;
  return <Icon aria-hidden="true" size={size} strokeWidth={1.8} />;
}

/**
 * Support actions and the exact words they speak.
 *
 * These phrases are authored here for the same reason vocabulary phrases are
 * authored in the catalog: nothing a model produced is ever spoken aloud.
 * `full_board` speaks nothing — it is navigation, not an utterance.
 */
export const ACTIONS: Record<
  BoardAction,
  { label: string; phrase: string; icon: LucideIcon }
> = {
  help: { label: "Help", phrase: "I need help.", icon: LifeBuoy },
  repeat: { label: "Repeat", phrase: "Please repeat that.", icon: RotateCcw },
  something_else: { label: "Something else", phrase: "I want something else.", icon: Ellipsis },
  not_that: { label: "Not that", phrase: "Not that.", icon: Ban },
  need_more_time: { label: "More time", phrase: "I need more time.", icon: Hourglass },
  full_board: { label: "Full board", phrase: "", icon: LayoutGrid },
};

export { AlertCircle };
