import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function Avatar() {
  const [blink, setBlink] = useState(false);
  const [mouth, setMouth] = useState(0);

  useEffect(() => {
    const blinkInt = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3800);
    const speed = 1100;
    const mouthInt = setInterval(() => {
      setMouth((m) => (m + 1) % 3);
    }, speed);
    return () => {
      clearInterval(blinkInt);
      clearInterval(mouthInt);
    };
  }, []);

  const mouthPaths = [
    "M 195 295 Q 215 305 235 295",
    "M 195 295 Q 215 312 235 295",
    "M 195 298 Q 215 300 235 298",
  ];

  return (
    <motion.svg
      viewBox="0 0 430 430"
      className="w-full h-full"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#3a0e1c" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0a0508" stopOpacity="1" />
        </radialGradient>
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d49072" />
          <stop offset="100%" stopColor="#a86445" />
        </linearGradient>
        <linearGradient id="skinShade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#3a1810" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="hairBrown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1810" />
          <stop offset="100%" stopColor="#0f0805" />
        </linearGradient>
        <linearGradient id="hairBlonde" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c89968" />
          <stop offset="100%" stopColor="#7a5a32" />
        </linearGradient>
        <linearGradient id="lips" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a1a2a" />
          <stop offset="100%" stopColor="#3a0810" />
        </linearGradient>
        <linearGradient id="dress" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a0a12" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <filter id="soft">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>

      {/* background */}
      <rect width="430" height="430" fill="url(#bgGlow)" />

      {/* ambient particles */}
      {[...Array(12)].map((_, i) => (
        <motion.circle
          key={i}
          cx={30 + ((i * 37) % 370)}
          cy={50 + ((i * 53) % 330)}
          r={1.2}
          fill="#b07a4f"
          opacity={0.35}
          animate={{ opacity: [0.1, 0.5, 0.1], y: [0, -8, 0] }}
          transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      <motion.g
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* back hair (blonde-brown volume behind body) */}
        <path
          d="M 215 100 C 130 100, 100 160, 100 260 C 100 350, 120 430, 140 430 L 290 430 C 310 430, 330 350, 330 260 C 330 160, 300 100, 215 100 Z"
          fill="url(#hairBlonde)"
        />
        <path
          d="M 215 100 C 130 100, 100 160, 100 260 C 100 350, 120 430, 140 430 L 290 430 C 310 430, 330 350, 330 260 C 330 160, 300 100, 215 100 Z"
          fill="url(#hairBrown)"
          opacity="0.85"
        />

        {/* shoulders / dress */}
        <path
          d="M 60 430 Q 90 340 170 320 L 260 320 Q 340 340 370 430 Z"
          fill="url(#dress)"
        />
        <path
          d="M 60 430 Q 90 340 170 320 L 260 320 Q 340 340 370 430 Z"
          fill="none"
          stroke="#5a1828"
          strokeWidth="0.6"
          opacity="0.4"
        />

        {/* neck */}
        <path d="M 190 290 L 195 335 Q 215 345 235 335 L 240 290 Z" fill="url(#skin)" />
        <path d="M 190 290 L 195 335 Q 215 345 235 335 L 240 290 Z" fill="url(#skinShade)" />

        {/* collarbone hint */}
        <path d="M 165 332 Q 215 348 265 332" stroke="#3a1810" strokeWidth="0.8" fill="none" opacity="0.5" />

        {/* face */}
        <ellipse cx="215" cy="225" rx="78" ry="95" fill="url(#skin)" />
        <ellipse cx="215" cy="225" rx="78" ry="95" fill="url(#skinShade)" opacity="0.6" />

        {/* jaw shadow */}
        <path d="M 150 250 Q 215 330 280 250" stroke="#5a2818" strokeWidth="0.5" fill="none" opacity="0.4" />

        {/* front hair (brown roots blending to blonde) */}
        <path
          d="M 215 95 C 150 95, 120 150, 125 240 C 128 280, 140 330, 155 360 C 165 310, 155 250, 175 200 C 190 150, 200 140, 215 140 C 230 140, 240 150, 255 200 C 275 250, 265 310, 275 360 C 290 330, 302 280, 305 240 C 310 150, 280 95, 215 95 Z"
          fill="url(#hairBrown)"
        />
        <path
          d="M 215 95 C 150 95, 120 150, 125 240 C 128 280, 140 330, 155 360 C 165 310, 155 250, 175 200 C 190 150, 200 140, 215 140 C 230 140, 240 150, 255 200 C 275 250, 265 310, 275 360 C 290 330, 302 280, 305 240 C 310 150, 280 95, 215 95 Z"
          fill="url(#hairBlonde)"
          opacity="0.6"
        />
        
        {/* face-framing strands */}
        <path
          d="M 175 160 C 150 190, 150 260, 160 290 C 155 250, 160 200, 195 160 Z"
          fill="url(#hairBlonde)"
        />
        <path
          d="M 255 160 C 280 190, 280 260, 270 290 C 275 250, 270 200, 235 160 Z"
          fill="url(#hairBlonde)"
        />
        
        {/* sweeping fringe */}
        <path
          d="M 160 175 C 190 195, 230 190, 265 170 C 275 165, 290 190, 250 205 C 210 215, 170 200, 150 185 Z"
          fill="url(#hairBrown)"
        />
        <path
          d="M 160 175 C 190 195, 230 190, 265 170 C 275 165, 290 190, 250 205 C 210 215, 170 200, 150 185 Z"
          fill="url(#hairBlonde)"
          opacity="0.4"
        />

        {/* eyebrows */}
        <path d="M 170 200 Q 188 192 205 200" stroke="#1a0c06" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 225 200 Q 242 192 260 200" stroke="#1a0c06" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* eyes */}
        <g>
          {/* left */}
          <ellipse cx="187" cy="222" rx="11" ry={blink ? 0.6 : 5.5} fill="#fff" />
          {!blink && (
            <>
              <circle cx="188" cy="223" r={4.2} fill="#3a2418" />
              <circle cx="188" cy="223" r={2} fill="#0a0405" />
              <circle cx="189.5" cy="221.5" r="0.9" fill="#fff" />
            </>
          )}
          {/* right */}
          <ellipse cx="243" cy="222" rx="11" ry={blink ? 0.6 : 5.5} fill="#fff" />
          {!blink && (
            <>
              <circle cx="244" cy="223" r={4.2} fill="#3a2418" />
              <circle cx="244" cy="223" r={2} fill="#0a0405" />
              <circle cx="245.5" cy="221.5" r="0.9" fill="#fff" />
            </>
          )}
          {/* lashes */}
          <path d="M 176 218 Q 187 214 198 218" stroke="#0a0405" strokeWidth="1.4" fill="none" />
          <path d="M 232 218 Q 243 214 254 218" stroke="#0a0405" strokeWidth="1.4" fill="none" />
        </g>

        {/* nose */}
        <path d="M 215 235 Q 210 258 213 268 Q 218 272 222 268" stroke="#6a3a22" strokeWidth="1" fill="none" opacity="0.55" />
        <ellipse cx="213" cy="270" rx="2" ry="1.2" fill="#5a2818" opacity="0.5" />
        <ellipse cx="220" cy="270" rx="2" ry="1.2" fill="#5a2818" opacity="0.5" />

        {/* cheeks blush */}
        <ellipse cx="170" cy="255" rx="14" ry="8" fill="#a8324a" opacity={0.18} filter="url(#soft)" />
        <ellipse cx="260" cy="255" rx="14" ry="8" fill="#a8324a" opacity={0.18} filter="url(#soft)" />

        {/* lips */}
        <motion.path
          d={mouthPaths[mouth]}
          stroke="url(#lips)"
          strokeWidth="6"
          fill="url(#lips)"
          strokeLinecap="round"
          animate={{ d: mouthPaths[mouth] }}
          transition={{ duration: 0.3 }}
        />
        <path d="M 198 293 Q 215 287 232 293" stroke="#9a2438" strokeWidth="1" fill="none" opacity="0.7" />

        {/* earrings */}
        <motion.circle
          cx="142"
          cy="248"
          r="2.5"
          fill="#d4a060"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.circle
          cx="288"
          cy="248"
          r="2.5"
          fill="#d4a060"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
        />
      </motion.g>

      {/* vignette */}
      <radialGradient id="vig" cx="50%" cy="50%" r="70%">
        <stop offset="60%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.7" />
      </radialGradient>
      <rect width="430" height="430" fill="url(#vig)" pointerEvents="none" />
    </motion.svg>
  );
}
