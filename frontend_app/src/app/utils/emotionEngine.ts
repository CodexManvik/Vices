/**
 * emotionEngine.ts
 *
 * Client-side emotion classification using Transformers.js (WASM).
 * Mirrors the Python emotion_engine.py logic exactly, offloading
 * ONNX inference from the server CPU onto the user's local hardware.
 */

import { pipeline, type TextClassificationOutput, type Pipeline } from "@huggingface/transformers";

// ---------------------------------------------------------------------------
// Constants — must match config.py defaults
// ---------------------------------------------------------------------------

const EMOTION_DELTA_MULTIPLIER = 0.15;

interface EmotionCoords {
  valence: number;
  arousal: number;
}

const EMOTION_MAPPING: Record<string, EmotionCoords> = {
  joy:     { valence: 0.8,  arousal: 0.4  },
  surprise:{ valence: 0.6,  arousal: 0.6  },
  anger:   { valence: -0.8, arousal: 0.8  },
  sadness: { valence: -0.7, arousal: -0.4 },
  fear:    { valence: -0.5, arousal: 0.6  },
  disgust: { valence: -0.6, arousal: 0.2  },
  neutral: { valence: 0.0,  arousal: 0.0  },
};

// ---------------------------------------------------------------------------
// Singleton pipeline — lazy initialised on first call to avoid blocking mount
// ---------------------------------------------------------------------------

let classifierInstance: Pipeline | null = null;
let initPromise: Promise<Pipeline> | null = null;

async function getClassifier(): Promise<Pipeline> {
  if (classifierInstance) return classifierInstance;
  if (initPromise) return initPromise;

  initPromise = pipeline(
    "text-classification",
    // Xenova's ONNX-quantised port of j-hartmann/emotion-english-distilroberta-base
    "Xenova/distilroberta-base-emotion-6",
    { device: "wasm" }
  ).then((clf) => {
    classifierInstance = clf as unknown as Pipeline;
    console.info("[EmotionEngine] Classifier loaded successfully.");
    return classifierInstance;
  });

  return initPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EmotionShift {
  valence_shift: number;
  arousal_shift: number;
}

/**
 * Runs local WASM emotion inference over the supplied text.
 * Returns valence/arousal deltas scaled by EMOTION_DELTA_MULTIPLIER.
 * Falls back to zero-shifts on any error or empty input.
 */
export async function calculateLocalEmotionShift(text: string): Promise<EmotionShift> {
  const zero: EmotionShift = { valence_shift: 0, arousal_shift: 0 };

  if (!text.trim()) return zero;

  try {
    const clf = await getClassifier();

    const result = await clf(text.slice(0, 512), { top_k: 1 });

    // TextClassificationOutput is either an array of single results or nested
    const items = Array.isArray(result) ? result : [result];
    const top = Array.isArray(items[0]) ? (items[0] as TextClassificationOutput)[0] : items[0] as TextClassificationOutput[0];

    if (!top || typeof top !== "object" || !("label" in top)) return zero;

    const label = (top.label as string).toLowerCase();
    const coords = EMOTION_MAPPING[label] ?? { valence: 0.0, arousal: 0.0 };

    const valence_shift = coords.valence * EMOTION_DELTA_MULTIPLIER;
    const arousal_shift = coords.arousal * EMOTION_DELTA_MULTIPLIER;

    console.debug(
      `[EmotionEngine] label="${label}" score=${(top.score as number).toFixed(3)} → v_shift=${valence_shift.toFixed(4)} a_shift=${arousal_shift.toFixed(4)}`
    );

    return { valence_shift, arousal_shift };
  } catch (err) {
    console.warn("[EmotionEngine] Inference failed, falling back to zero shifts:", err);
    return zero;
  }
}
