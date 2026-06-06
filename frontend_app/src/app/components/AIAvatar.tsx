import { useEffect, useRef } from "react";
import * as THREE from "three";
// Import the custom face OBJ model directly as a raw text string at build time
// @ts-ignore
import objSource from "../../../canonical_face_model.obj?raw";

interface AIAvatarProps {
  mood: string;
  typing?: boolean;
  size?: number;
  interactive?: boolean;
  audioAnalyser?: AnalyserNode | null;
}

const MOOD_COLORS: Record<string, string> = {
  neutral: "#38BDF8",        // radiant cyan
  affectionate: "#F472B6",   // rose pink
  warm: "#F59E0B",           // warm amber
  happy: "#FBBF24",          // sunny gold
  excited: "#EC4899",        // hot pink
  playful: "#EF4444",        // crimson red
  aroused: "#DC2626",        // deep ruby red
  sleepy: "#A78BFA",         // lavender
  cozy: "#FDBA74",           // soft peach
  angry: "#F43F5E",          // glowing rose red
  jealous: "#10B981",        // emerald green
  annoyed: "#C084FC",        // royal violet
  sad: "#3B82F6",            // deep sapphire blue
  bored: "#6B7280",          // slate gray
  analytical: "#22D3EE",     // electric cyan
  cold: "#93C5FD",           // icy blue
};

interface ParsedOBJ {
  vertices: number[];
  indices: number[];
}

// ── SOTA Lightweight Self-Contained OBJ Parser ──
function parseOBJ(source: string): ParsedOBJ {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const lines = source.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("v ")) {
      const parts = trimmed.split(/\s+/).slice(1);
      vertices.push(
        parseFloat(parts[0]),
        parseFloat(parts[1]),
        parseFloat(parts[2])
      );
    } else if (trimmed.startsWith("f ")) {
      const parts = trimmed.split(/\s+/).slice(1);
      // OBJ faces are 1-indexed and can be structured as v/vt/vn
      const faceIndices = parts.map(part => {
        const vIndex = parseInt(part.split("/")[0]);
        return vIndex - 1; // Convert to 0-indexed
      });
      
      // Triangulate polygons (quads, etc.)
      for (let i = 1; i < faceIndices.length - 1; i++) {
        indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
      }
    }
  }
  
  return { vertices, indices };
}

// Center and normalize geometry so any OBJ file fits inside standard [-0.9, 0.9] camera view
function parseAndNormalizeOBJ(source: string): ParsedOBJ {
  const parsed = parseOBJ(source);
  const v = parsed.vertices;
  if (v.length === 0) return parsed;
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  for (let i = 0; i < v.length; i += 3) {
    const x = v[i], y = v[i + 1], z = v[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  
  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const maxSize = Math.max(sizeX, sizeY, sizeZ) || 1.0;
  
  // Center the model and scale to fit camera viewing bounds
  const scale = 1.6 / maxSize;
  for (let i = 0; i < v.length; i += 3) {
    v[i] = (v[i] - cx) * scale;
    v[i + 1] = (v[i + 1] - cy) * scale;
    // Push slightly backward along Z for best perspective centering
    v[i + 2] = (v[i + 2] - cz) * scale - 0.1;
  }
  
  return parsed;
}

export function AIAvatar({ mood, typing = false, size = 180, interactive = true, audioAnalyser = null }: AIAvatarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const moodColorStr = MOOD_COLORS[mood?.toLowerCase()] || MOOD_COLORS.neutral;

  // Track mouse coordinates
  useEffect(() => {
    if (!interactive) return;
    const handler = (ev: MouseEvent) => {
      mouseRef.current = {
        x: (ev.clientX / window.innerWidth) * 2 - 1,
        y: -(ev.clientY / window.innerHeight) * 2 + 1,
      };
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [interactive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Three.js Scene Setup ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.set(0, 0, 2.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    container.appendChild(renderer.domElement);

    // ── Load and Parse the Custom Feminine .obj model ──
    const { vertices, indices } = parseAndNormalizeOBJ(objSource);
    const basePositions = [...vertices]; // Cache static coordinates for speech morph base
    const totalVertices = vertices.length / 3;

    // Construct beautiful cybernetic vertex colors
    const colors: number[] = [];
    const colorCyan = new THREE.Color("#22D3EE"); // electric cyan
    const colorBlue = new THREE.Color("#3B82F6"); // holographic blue
    const colorIndigo = new THREE.Color("#4F46E5"); // deep indigo
    const colorTeal = new THREE.Color("#0D9488"); // glowing teal

    for (let i = 0; i < totalVertices; i++) {
      const px = vertices[i * 3];
      const py = vertices[i * 3 + 1];
      
      const densityFactor = Math.sqrt(px * px + py * py);
      const mixColor = colorCyan.clone();
      
      if (densityFactor < 0.45) {
        // High density face center
        mixColor.lerp(colorTeal, 0.35);
        if (py > 0) {
          mixColor.lerp(new THREE.Color("#38BDF8"), py * 0.4);
        }
      } else {
        // Sparser abstract outer hull bounds
        mixColor.lerp(colorBlue, 0.3);
        mixColor.lerp(colorIndigo, Math.min(1.0, (densityFactor - 0.45) * 1.4));
      }
      colors.push(mixColor.r, mixColor.g, mixColor.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    // Exquisite Points & Wireframe lines with additive holographic blending
    const pointsMaterial = new THREE.PointsMaterial({
      vertexColors: true,
      size: size < 200 ? 0.016 : 0.022,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    // Triangulated wireframe segments
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    lineGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    lineGeometry.setIndex(indices);

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
    });

    const facePoints = new THREE.Points(geometry, pointsMaterial);
    const faceLines = new THREE.LineSegments(lineGeometry, lineMaterial);

    const faceGroup = new THREE.Group();
    faceGroup.add(facePoints);
    faceGroup.add(faceLines);
    scene.add(faceGroup);

    // Dynamic point light for depth and organic holographic glow
    const pointLight = new THREE.PointLight(new THREE.Color("#22D3EE"), 1.8, 5);
    pointLight.position.set(0, 0, 1.4);
    scene.add(pointLight);

    // ── Post Processing Setup ──
    const renderTarget = new THREE.WebGLRenderTarget(size, size);
    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: renderTarget.texture },
        time: { value: 0.0 },
        glitchIntensity: { value: 0.0 },
        moodColor: { value: new THREE.Color(moodColorStr) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float glitchIntensity;
        uniform vec3 moodColor;
        varying vec2 vUv;

        float rand(vec2 co) {
          return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 uv = vUv;

          // Glitch displacement (cyberpunk distortion)
          if (glitchIntensity > 0.0) {
            float glitchLine = step(0.93 - glitchIntensity * 0.08, rand(vec2(floor(uv.y * 35.0), floor(time * 16.0))));
            uv.x += glitchLine * glitchIntensity * 0.04 * (rand(vec2(time)) - 0.5);
            
            float blockNoise = rand(vec2(floor(uv.y * 8.0), floor(time * 5.0)));
            if (blockNoise < glitchIntensity * 0.25) {
              uv.x += 0.015 * (rand(vec2(time + 1.2)) - 0.5);
            }
          }

          // Chromatic Aberration RGB shifting
          float shift = 0.0035 + glitchIntensity * 0.018;
          float r = texture2D(tDiffuse, vec2(uv.x - shift, uv.y)).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, vec2(uv.x + shift, uv.y)).b;
          
          vec4 color = vec4(r, g, b, 1.0);
          
          // Immersive moving cybernetic scanline overlay
          float scanline = sin(uv.y * 130.0 + time * 4.8) * 0.065;
          
          // Subtle high-fidelity white noise grain
          float noise = (rand(uv + time) - 0.5) * 0.022;
          
          color.rgb += scanline;
          color.rgb += noise;
          
          // Cyberpunk color-space color blending
          color.rgb = mix(color.rgb, color.rgb * moodColor, 0.08);

          float alpha = texture2D(tDiffuse, uv).a;
          gl_FragColor = vec4(color.rgb, alpha);
        }
      `,
      transparent: true
    });

    const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
    postScene.add(postQuad);

    // ── Animation Loop ──
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const time = clock.getElapsedTime();

      // Dynamic 3D Mouse Tracking (Rotates smoothly to look at user)
      const targetRotationY = mouseRef.current.x * 0.40;
      const targetRotationX = -mouseRef.current.y * 0.30;
      faceGroup.rotation.y += (targetRotationY - faceGroup.rotation.y) * 0.08;
      faceGroup.rotation.x += (targetRotationX - faceGroup.rotation.x) * 0.08;

      // Natural Breathing Motion
      const breath = 1.0 + Math.sin(time * 1.5) * 0.015;
      faceGroup.scale.set(breath, breath, breath);

      // Real-time audio amplitude analysis for phonetic speech sync
      let audioAmp = 0;
      if (audioAnalyser) {
        const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
        audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        audioAmp = sum / dataArray.length / 255;
      }

      // Smooth phonetic speech mouth morphing on custom .obj vertices
      const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
      const points = posAttr.array as Float32Array;

      const linePosAttr = lineGeometry.getAttribute("position") as THREE.BufferAttribute;
      const linePoints = linePosAttr.array as Float32Array;

      for (let i = 0; i < totalVertices; i++) {
        let px = basePositions[i * 3];
        let py = basePositions[i * 3 + 1];
        let pz = basePositions[i * 3 + 2];

        // Speech morph bounds centered dynamically on normalized mouth region
        if (py > -0.44 && py < -0.22 && Math.abs(px) < 0.16) {
          const dx = px;
          const dy = py + 0.33;
          const mouthDist = Math.sqrt(dx * dx + dy * dy);
          const lipWeight = Math.max(0, 1 - mouthDist / 0.14);

          let openState = 0;
          if (audioAnalyser) {
            // Morph mouth using actual audio amplitude (real phonetic sync)
            const jitter = Math.sin(time * 24.0) * 0.008;
            openState = Math.max(0, (audioAmp * 0.38 + jitter) * lipWeight);
          } else if (typing) {
            // Fallback typing timer sine waves
            const speechFreq1 = Math.sin(time * 16.0) * 0.032;
            const speechFreq2 = Math.sin(time * 8.5 + 1.2) * 0.020;
            const speechFreq3 = Math.cos(time * 26.0) * 0.010;
            const speechWave = (speechFreq1 + speechFreq2 + speechFreq3) * lipWeight;
            openState = Math.max(-0.01, speechWave + 0.022 * lipWeight);
          }
          
          if (py < -0.33) {
            py -= openState * 1.35;
            pz -= openState * 0.25;
          } else {
            py += openState * 0.35;
          }
          
          if (audioAnalyser || typing) {
            px *= 1.0 - (openState * 0.22);
          }
        }

        // Subtly animate overall nodes with harmonic noise waves for organic flow
        const vertexPulse = Math.sin(time * 2.2 + i * 0.08) * 0.003;
        pz += vertexPulse;

        points[i * 3] = px;
        points[i * 3 + 1] = py;
        points[i * 3 + 2] = pz;

        linePoints[i * 3] = px;
        linePoints[i * 3 + 1] = py;
        linePoints[i * 3 + 2] = pz;
      }

      posAttr.needsUpdate = true;
      linePosAttr.needsUpdate = true;

      // 1. Render primary scene to texture
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);

      // 2. Render post-processing quad with custom shaders to standard screen
      renderer.setRenderTarget(null);
      postMaterial.uniforms.time.value = time;
      
      // Determine dynamic glitch intensity based on mood volatility
      let glitchVal = 0.0;
      const lowerMood = mood?.toLowerCase();
      if (lowerMood === "angry") {
        glitchVal = 0.30 + Math.sin(time * 20.0) * 0.15;
      } else if (lowerMood === "excited") {
        glitchVal = 0.15 + Math.cos(time * 14.0) * 0.10;
      } else if (lowerMood === "jealous" || lowerMood === "annoyed") {
        glitchVal = 0.08 + Math.sin(time * 8.0) * 0.04;
      }
      
      postMaterial.uniforms.glitchIntensity.value = glitchVal;
      postMaterial.uniforms.moodColor.value.set(moodColorStr);
      renderer.render(postScene, postCamera);
    };

    animate();

    // ── Cleanup with Safety boundary ──
    return () => {
      try {
        cancelAnimationFrame(animationFrameId);
        
        if (container && renderer.domElement && renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
        
        if (geometry) geometry.dispose();
        if (lineGeometry) lineGeometry.dispose();
        if (pointsMaterial) pointsMaterial.dispose();
        if (lineMaterial) lineMaterial.dispose();
        if (renderTarget) renderTarget.dispose();
        if (postMaterial) postMaterial.dispose();
        if (postQuad) postQuad.geometry.dispose();
        if (renderer) renderer.dispose();
      } catch (e) {
        console.error("Disposal failed:", e);
      }
    };
  }, [mood, typing, size, interactive, moodColorStr, audioAnalyser]);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ["--ring-glow" as any]: moodColorStr,
      }}
      className="select-none"
    >
      {/* Primary dynamic pulsing glow ring */}
      <div
        style={{
          position: "absolute",
          inset: "-6px",
          borderRadius: "50%",
          border: `2px solid ${moodColorStr}`,
          opacity: 0.7,
          pointerEvents: "none",
          animation: "mood-ring-pulse 3s ease-in-out infinite",
          transition: "border-color 0.8s ease, box-shadow 0.8s ease",
        }}
      />

      {/* Secondary high-tech dashed rotating orbit ring */}
      <div
        style={{
          position: "absolute",
          inset: "-12px",
          borderRadius: "50%",
          border: `1.5px dashed ${moodColorStr}`,
          opacity: 0.2,
          pointerEvents: "none",
          animation: "mood-ring-spin 25s linear infinite",
          transition: "border-color 0.8s ease",
        }}
      />

      {/* Three.js 3D WebGL Canvas container */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", display: "block", borderRadius: "50%", overflow: "hidden" }}
      />
    </div>
  );
}
