import { motion } from "motion/react";

interface MoodGlowProps {
  mood: string;
  isDark: boolean;
}

const MOOD_COLORS: Record<string, string> = {
  neutral: "#E2E8F0",        // pale silver
  affectionate: "#F5C97A",   // warm amber/gold
  warm: "#F5C97A",
  happy: "#FFB84D",          // soft gold
  excited: "#FF6B6B",        // deep coral / crimson
  playful: "#DC2626",        // deep crimson
  aroused: "#DC2626",
  sleepy: "#B19FFB",         // soft lavender
  cozy: "#F0A58F",           // rosewood peach
  angry: "#E11D48",          // deep crimson red
  jealous: "#10B981",        // emerald green
  annoyed: "#A855F7",        // plum purple
  sad: "#2563EB",            // oceanic blue
  bored: "#6B7280",          // slate gray
  analytical: "#7DD3FC",     // ice blue
  cold: "#7DD3FC",
};

export function MoodGlow({ mood, isDark }: MoodGlowProps) {
  return null;
}

