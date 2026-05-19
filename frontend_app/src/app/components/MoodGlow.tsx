import { motion } from "motion/react";

interface MoodGlowProps {
  mood: string;
  isDark: boolean;
}

const MOOD_COLORS: Record<string, string> = {
  neutral: "#E2E8F0",       // pale silver
  affectionate: "#F5C97A",  // muted amber/gold
  warm: "#F5C97A",
  playful: "#DC2626",       // deep crimson
  aroused: "#DC2626",
  analytical: "#7DD3FC",    // ice blue
  cold: "#7DD3FC",
};

export function MoodGlow({ mood, isDark }: MoodGlowProps) {
  const color = MOOD_COLORS[mood?.toLowerCase()] ?? MOOD_COLORS.neutral;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
      animate={{ opacity: isDark ? 0.5 : 0.35 }}
      transition={{ duration: 2 }}
    >
      <motion.div
        key={color}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 3, ease: "easeInOut" }}
        className="absolute -top-1/3 -left-1/4 w-[140%] h-[140%]"
        style={{
          background: `radial-gradient(circle at 30% 40%, ${color} 0%, transparent 55%)`,
          opacity: 0.06,
          filter: "blur(80px)",
        }}
      />
      <motion.div
        key={`b-${color}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 3, delay: 0.3 }}
        className="absolute -bottom-1/3 -right-1/4 w-[120%] h-[120%]"
        style={{
          background: `radial-gradient(circle at 70% 60%, ${color} 0%, transparent 50%)`,
          opacity: 0.04,
          filter: "blur(100px)",
        }}
      />
    </motion.div>
  );
}
