import React, { useCallback, useRef, useEffect, useState, memo } from "react";
import { View, Text, StyleSheet, Image as RNImage } from "react-native";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import type { RootState } from "@react-three/fiber";
import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";
import { useVRM, textureDataStore } from "../hooks/useVRM";
import { TextureLoader } from "expo-three";

// Cache for created textures
const textureCache = new Map<string, THREE.Texture>();
const textureLoader = new TextureLoader();
const loadingPromises = new Map<string, Promise<THREE.Texture | null>>();

// Module-level tracking of processed VRM scenes (persists across component remounts)
const processedScenes = new Set<string>();

// Module-level shared state for viseme (avoids prop-based re-renders that cause remounts)
// This is exported so useLipSync can update it directly without triggering React re-renders
export const visemeState = {
  current: "X" as string,
  isSpeaking: false,
  emotion: "neutral" as string,  // Also track emotion to avoid re-renders
};

/**
 * Async texture loading using expo-three's TextureLoader
 */
async function loadTextureAsync(uri: string): Promise<THREE.Texture | null> {
  if (textureCache.has(uri)) {
    return textureCache.get(uri)!;
  }
  
  if (loadingPromises.has(uri)) {
    return loadingPromises.get(uri)!;
  }
  
  const promise = new Promise<THREE.Texture | null>((resolve) => {
    textureLoader.load(
      uri,
      (texture) => {
        console.log('[VRoidAvatar] expo-three loaded texture:', uri.substring(0, 50) + '...');
        texture.flipY = false;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        textureCache.set(uri, texture);
        resolve(texture);
      },
      undefined,
      (error) => {
        console.warn('[VRoidAvatar] expo-three texture load error:', error);
        resolve(null);
      }
    );
  });
  
  loadingPromises.set(uri, promise);
  return promise;
}

/**
 * Decode base64 to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Look up texture data from global store by texture name or try to find by pattern
 */
function findTextureData(tex: any): { uri: string; base64: string; mimeType: string } | null {
  if (!tex) return null;
  
  // First try direct lookup by our custom properties
  if (tex.__rnTextureUri) {
    return {
      uri: tex.__rnTextureUri,
      base64: tex.__rnTextureBase64 || '',
      mimeType: tex.__rnTextureMimeType || 'image/png',
    };
  }
  
  // Try lookup by our internal store name
  if (tex.__rnStoreName && textureDataStore.has(tex.__rnStoreName)) {
    return textureDataStore.get(tex.__rnStoreName)!;
  }
  
  // Try lookup by texture index
  if (tex.__rnTextureIndex !== undefined) {
    const key = `texture_index_${tex.__rnTextureIndex}`;
    if (textureDataStore.has(key)) {
      return textureDataStore.get(key)!;
    }
  }
  
  // Try lookup by source index
  if (tex.__rnSourceIndex !== undefined) {
    const key = `vrm_texture_${tex.__rnSourceIndex}`;
    if (textureDataStore.has(key)) {
      return textureDataStore.get(key)!;
    }
  }
  
  // Try lookup by texture name (exact match)
  if (tex.name && textureDataStore.has(tex.name)) {
    return textureDataStore.get(tex.name)!;
  }
  
  // Try to match by vrm_texture_X pattern
  if (tex.name) {
    const match = tex.name.match(/vrm_texture_(\d+)/);
    if (match) {
      const key = `vrm_texture_${match[1]}`;
      if (textureDataStore.has(key)) {
        return textureDataStore.get(key)!;
      }
    }
  }
  
  // Try to match VRM naming patterns like "_01", "_02", etc. -> maps to vrm_texture_0, vrm_texture_1
  if (tex.name) {
    // Pattern: "_XX" where XX is a number (1-based in VRM, 0-based in our store)
    const underscoreMatch = tex.name.match(/^_?(\d+)$/);
    if (underscoreMatch) {
      const num = parseInt(underscoreMatch[1], 10);
      // Try both 0-based and 1-based conversions
      for (const index of [num - 1, num]) {
        if (index >= 0) {
          const key = `vrm_texture_${index}`;
          if (textureDataStore.has(key)) {
            console.log(`[VRoidAvatar] Matched texture "${tex.name}" to "${key}"`);
            return textureDataStore.get(key)!;
          }
        }
      }
    }
  }
  
  // If texture has a source with a name, try that
  if (tex.source?.data?.name && textureDataStore.has(tex.source.data.name)) {
    return textureDataStore.get(tex.source.data.name)!;
  }
  
  return null;
}

interface VRoidAvatarProps {
  vrmUrl: string;
  emotion: string;
  isSpeaking: boolean;
  viseme: string;
}

const EMOTION_MAP: Record<string, Record<string, number>> = {
  happy: { happy: 1.0 },
  firm: { angry: 1.0 },
  concerned: { sad: 0.8 },
  curious: { surprised: 0.6 },
  encouraging: { happy: 0.7, surprised: 0.3 },
  proud: { happy: 0.8 },
  thinking: { blink: 0.3 },
  serious: { angry: 0.2 },
  neutral: {},
};

const VISEME_MAP: Record<string, Record<string, number>> = {
  A: { aa: 1.0 },
  E: { ee: 0.9 },
  I: { ih: 0.8 },
  O: { oh: 1.0 },
  U: { ou: 0.9 },
  B: { aa: 0.4 },
  F: { ih: 0.3, ee: 0.2 },
  K: { oh: 0.4 },
  S: { ee: 0.5, ih: 0.3 },
  T: { aa: 0.3 },
  X: {},
};

const EMOTION_PRESETS = ["happy", "angry", "sad", "relaxed", "surprised"];
const MOUTH_PRESETS = ["aa", "ih", "ou", "ee", "oh"];
const ALL_LERPED_PRESETS = [...EMOTION_PRESETS, "blink", ...MOUTH_PRESETS];

interface AvatarModelProps {
  vrm: VRM;
  // Note: emotion, isSpeaking, and viseme are all read from shared visemeState
  // to avoid prop-based re-renders that cause Canvas children recreation
}

function rebuildTexture(src: any, gl: THREE.WebGLRenderer | null): THREE.Texture | null {
  if (!src) return null;
  
  // Try to find texture data using the global store
  const textureData = findTextureData(src);
  
  if (textureData && textureData.uri) {
    // Check cache for preloaded texture from expo-three
    if (textureCache.has(textureData.uri)) {
      console.log('[VRoidAvatar] Using cached texture:', textureData.uri.substring(0, 50) + '...');
      return textureCache.get(textureData.uri)!;
    }
    
    console.log('[VRoidAvatar] Texture not in cache:', textureData.uri.substring(0, 50) + '...');
    return null;
  }
  
  // If the texture already has a valid image, use it directly
  if (src.image && (src.image.data instanceof Uint8Array || src.image.localUri || src.image.data?.localUri)) {
    src.needsUpdate = true;
    return src;
  }
  
  // Fallback: try to extract image data
  const img = src.image ?? src.source?.data;
  if (!img) {
    console.log('[VRoidAvatar] No texture data found for:', src.name || 'unnamed');
    return null;
  }
  
  const tex = new THREE.Texture();
  tex.image = img;
  tex.flipY = src.flipY ?? false;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.magFilter = src.magFilter ?? THREE.LinearFilter;
  tex.minFilter = src.minFilter ?? THREE.LinearFilter;
  tex.wrapS = src.wrapS ?? THREE.ClampToEdgeWrapping;
  tex.wrapT = src.wrapT ?? THREE.ClampToEdgeWrapping;
  return tex;
}

function forceBasicMaterials(scene: THREE.Object3D, gl: THREE.WebGLRenderer | null) {
  let meshCount = 0;
  let texturedCount = 0;
  let failedTextures: string[] = [];
  let colorExtracted: string[] = [];
  
  // Log what's in the texture cache
  console.log(`[VRoidAvatar] Texture cache has ${textureCache.size} entries`);
  
  scene.traverse((child: any) => {
    if (!child.isMesh) return;
    meshCount++;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    
    const newMaterials: THREE.MeshBasicMaterial[] = [];
    
    for (let matIndex = 0; matIndex < materials.length; matIndex++) {
      const oldMat = materials[matIndex];
      
      // Try to get the main texture from various possible sources
      let srcTex = oldMat.map ?? null;
      
      // Check for MToon-specific texture properties (three-vrm v2+)
      if (!srcTex && oldMat.uniforms) {
        srcTex = oldMat.uniforms.map?.value ?? 
                 oldMat.uniforms.mainTex?.value ??
                 oldMat.uniforms.litFactor?.value ??
                 oldMat.uniforms.diffuse?.value ??
                 oldMat.uniforms.diffuseMap?.value ??
                 null;
      }
      
      // Check for ShaderMaterial textures
      if (!srcTex && oldMat.isShaderMaterial && oldMat.uniforms) {
        for (const key of Object.keys(oldMat.uniforms)) {
          const uniform = oldMat.uniforms[key];
          if (uniform?.value?.__rnTextureUri || uniform?.value?.isTexture) {
            srcTex = uniform.value;
            break;
          }
        }
      }
      
      const map = rebuildTexture(srcTex, gl);
      
      if (map) {
        texturedCount++;
      } else if (srcTex?.name) {
        failedTextures.push(`${child.name}:${srcTex.name}`);
      }
      
      // Extract color from material - comprehensive MToon/ShaderMaterial handling
      let color: THREE.Color | null = null;
      let opacity = oldMat.opacity ?? 1.0;
      let colorSource = 'none';
      
      // Helper to convert various color formats to THREE.Color
      const toColor = (val: any): THREE.Color | null => {
        if (!val) return null;
        if (val.isColor) return val.clone();
        if (typeof val === 'number') return new THREE.Color(val);
        if (typeof val === 'object') {
          if ('r' in val && 'g' in val && 'b' in val) {
            return new THREE.Color(val.r, val.g, val.b);
          }
          if (Array.isArray(val) && val.length >= 3) {
            return new THREE.Color(val[0], val[1], val[2]);
          }
        }
        return null;
      };
      
      // 1. First check direct material properties (standard materials)
      if (oldMat.color) {
        color = toColor(oldMat.color);
        if (color) colorSource = 'material.color';
      }
      
      // 2. Check MToon-specific properties (three-vrm MToonMaterial)
      if (!color) {
        // MToonMaterial direct properties
        const mtoonProps = ['shadeColorFactor', 'litFactor', 'shadeColor', 'rimColor', 'outlineColor'];
        for (const prop of mtoonProps) {
          if (oldMat[prop]) {
            const c = toColor(oldMat[prop]);
            if (c && (c.r !== 0 || c.g !== 0 || c.b !== 0)) {
              color = c;
              colorSource = `material.${prop}`;
              break;
            }
          }
        }
      }
      
      // 3. Check shader uniforms
      if (!color && oldMat.uniforms) {
        // Priority order of uniform names for color extraction
        const uniformNames = [
          'litFactor', 'diffuse', 'color', 'diffuseColor', 'mainColor',
          'shadeColorFactor', 'shadeColor', 'rimColorFactor', 'outlineColorFactor',
          'baseColorFactor', 'albedo', 'baseColor'
        ];
        
        for (const name of uniformNames) {
          const uniform = oldMat.uniforms[name];
          if (uniform?.value) {
            const c = toColor(uniform.value);
            if (c && (c.r !== 0 || c.g !== 0 || c.b !== 0)) {
              // Skip if it's basically white (1, 1, 1) unless we have nothing else
              if (c.r < 0.99 || c.g < 0.99 || c.b < 0.99 || !color) {
                color = c;
                colorSource = `uniform.${name}`;
              }
              if (c.r < 0.99 || c.g < 0.99 || c.b < 0.99) break;
            }
          }
        }
        
        // Also check for opacity in uniforms
        if (oldMat.uniforms.opacity?.value !== undefined) {
          opacity = oldMat.uniforms.opacity.value;
        }
      }
      
      // 4. Check userData for original color data
      if (!color && oldMat.userData) {
        if (oldMat.userData.color) {
          color = toColor(oldMat.userData.color);
          if (color) colorSource = 'userData.color';
        }
      }
      
      // Log materials for debugging
      if (!map) {
        const colorHex = color ? `0x${color.getHex().toString(16).padStart(6, '0')}` : 'null';
        colorExtracted.push(`${child.name}[${matIndex}]: color=${colorHex} (${colorSource})`);
      }
      
      // 5. Apply sensible fallback colors based on mesh name if no color was found
      if (!color || (color.r === 1 && color.g === 1 && color.b === 1)) {
        const meshName = (child.name || '').toLowerCase();
        
        // Try to apply context-appropriate fallback colors
        if (meshName.includes('skin') || meshName.includes('body') || meshName.includes('face')) {
          color = new THREE.Color(0xE8BEAC); // Skin tone
          colorSource = 'fallback-skin';
        } else if (meshName.includes('hair')) {
          color = new THREE.Color(0x4A3728); // Dark brown hair
          colorSource = 'fallback-hair';
        } else if (meshName.includes('eye')) {
          color = new THREE.Color(0x3366CC); // Blue eyes
          colorSource = 'fallback-eyes';
        } else if (meshName.includes('cloth') || meshName.includes('outfit') || meshName.includes('dress')) {
          color = new THREE.Color(0x666666); // Gray clothing
          colorSource = 'fallback-clothes';
        } else if (!map) {
          // Default to a neutral gray for unknown untextured meshes
          color = new THREE.Color(0xCCCCCC);
          colorSource = 'fallback-default';
        }
        
        // If we still have no color, use white (will be modified by texture)
        if (!color) {
          color = new THREE.Color(0xFFFFFF);
          colorSource = 'white';
        }
      }
      
      newMaterials.push(new THREE.MeshBasicMaterial({
        color: color,
        map,
        side: THREE.DoubleSide,
        transparent: oldMat.transparent ?? (opacity < 1.0),
        opacity,
        alphaTest: oldMat.alphaTest ?? 0,
      }));
    }
    
    child.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials;
  });
  
  console.log(`[VRoidAvatar] Processed ${meshCount} meshes, ${texturedCount} have textures`);
  if (failedTextures.length > 0) {
    console.log('[VRoidAvatar] Failed to match textures:', failedTextures);
  }
  if (colorExtracted.length > 0) {
    console.log('[VRoidAvatar] Materials without textures:', colorExtracted);
  }
}

const AvatarModel = memo(function AvatarModel({ vrm }: AvatarModelProps) {
  const { gl } = useThree();
  const currentValues = useRef<Record<string, number>>({});
  const blinkTimer = useRef(randomBlinkDelay());
  const blinkPhase = useRef<"idle" | "closing" | "opening">("idle");
  const blinkProgress = useRef(0);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  
  // Use VRM scene UUID to track if we've already processed this scene
  const sceneId = vrm.scene.uuid;
  
  // Log when component mounts/unmounts
  useEffect(() => {
    console.log('[AvatarModel] MOUNTED for scene:', sceneId.substring(0, 8));
    return () => console.log('[AvatarModel] UNMOUNTED for scene:', sceneId.substring(0, 8));
  }, [sceneId]);

  // Preload textures asynchronously - only once per VRM scene (module-level tracking)
  useEffect(() => {
    // Skip if we've already processed this scene (survives remounts)
    if (processedScenes.has(sceneId)) {
      console.log('[VRoidAvatar] Scene already processed, skipping texture setup');
      setTexturesLoaded(true);
      return;
    }
    
    const preloadTextures = async () => {
      console.log('[VRoidAvatar] Preloading textures for scene:', sceneId.substring(0, 8));
      console.log('[VRoidAvatar] Available textures in store:', Array.from(textureDataStore.keys()));
      
      // Collect all texture URIs from the store
      const texturePromises: Promise<{ key: string; texture: THREE.Texture | null }>[] = [];
      
      for (const [key, data] of textureDataStore.entries()) {
        if (data.uri) {
          texturePromises.push(
            loadTextureAsync(data.uri).then(tex => ({ key, texture: tex }))
          );
        }
      }
      
      const results = await Promise.all(texturePromises);
      const loaded = results.filter(r => r.texture !== null);
      const failed = results.filter(r => r.texture === null);
      
      console.log(`[VRoidAvatar] Textures loaded: ${loaded.length}/${results.length}`);
      if (failed.length > 0) {
        console.log('[VRoidAvatar] Failed textures:', failed.map(f => f.key));
      }
      
      forceBasicMaterials(vrm.scene, gl);
      
      // Mark this scene as processed (module-level, survives remounts)
      processedScenes.add(sceneId);
      setTexturesLoaded(true);
      console.log('[VRoidAvatar] Scene processing complete');
    };
    
    preloadTextures();
  }, [vrm, gl, sceneId]);

  const lastLoggedVisemeRef = useRef<string>("");

  useFrame((state, delta) => {
    if (!vrm?.expressionManager || !vrm?.humanoid) return;

    const clock = state.clock.getElapsedTime();

    // --- Read all values from shared state (avoids prop-based re-renders) ---
    const currentEmotion = visemeState.emotion;
    const currentViseme = visemeState.current;
    const currentIsSpeaking = visemeState.isSpeaking;
    
    // --- Emotion targets ---
    const emotionTargets = EMOTION_MAP[currentEmotion] ?? {};

    // --- Viseme targets ---
    const visemeTargets = VISEME_MAP[currentViseme] ?? {};
    
    // Log viseme changes for debugging (only non-X visemes to reduce spam)
    if (currentViseme !== lastLoggedVisemeRef.current && currentViseme !== "X") {
      console.log(`[AvatarModel] Viseme: ${currentViseme}`);
      lastLoggedVisemeRef.current = currentViseme;
    }

    // --- Merge all targets ---
    const targets: Record<string, number> = {};
    for (const preset of ALL_LERPED_PRESETS) {
      targets[preset] = emotionTargets[preset] ?? visemeTargets[preset] ?? 0;
    }

    // --- Auto-blink (only when mouth is not active) ---
    const mouthActive = currentViseme !== "X" && currentViseme !== "";
    if (!mouthActive) {
      blinkTimer.current -= delta;

      if (blinkPhase.current === "idle" && blinkTimer.current <= 0) {
        blinkPhase.current = "closing";
        blinkProgress.current = 0;
      }

      if (blinkPhase.current === "closing") {
        blinkProgress.current += delta / 0.075;
        if (blinkProgress.current >= 1) {
          blinkProgress.current = 1;
          blinkPhase.current = "opening";
        }
        targets["blink"] = Math.max(targets["blink"] ?? 0, blinkProgress.current);
      } else if (blinkPhase.current === "opening") {
        blinkProgress.current -= delta / 0.075;
        if (blinkProgress.current <= 0) {
          blinkProgress.current = 0;
          blinkPhase.current = "idle";
          blinkTimer.current = randomBlinkDelay();
        }
        targets["blink"] = Math.max(targets["blink"] ?? 0, blinkProgress.current);
      }
    }

    // --- Smooth interpolation with responsive timing for mouth movements ---
    for (const preset of ALL_LERPED_PRESETS) {
      const target = targets[preset] ?? 0;
      const current = currentValues.current[preset] ?? 0;
      // Balanced lerp for responsive but smooth mouth movements
      let lerpFactor = 0.15; // Default for emotions
      if (MOUTH_PRESETS.includes(preset)) {
        // 0.35 opening = ~100ms to reach target, 0.45 closing = ~80ms to close
        // Fast enough for sync, smooth enough for natural look
        lerpFactor = target === 0 ? 0.45 : 0.35;
      }
      const next = THREE.MathUtils.lerp(current, target, lerpFactor);
      currentValues.current[preset] = next;

      try {
        vrm.expressionManager.setValue(preset, next);
      } catch {
        // preset may not exist on this particular VRM model
      }
    }

    vrm.expressionManager.update();

    // --- Head movement only when speaking ---
    const headBone = vrm.humanoid.getNormalizedBoneNode("head");
    if (headBone) {
      if (currentIsSpeaking) {
        // Animate head movement while speaking
        const yawAmp = 0.08; // ~4.5 degrees
        const pitchAmp = 0.05; // ~2.8 degrees
        
        // Target rotations based on clock
        const targetY = Math.sin(clock * 0.4) * yawAmp + Math.sin(clock * 1.2) * (yawAmp * 0.3);
        const targetX = Math.sin(clock * 0.3) * pitchAmp + Math.sin(clock * 0.8) * (pitchAmp * 0.2);
        const targetZ = Math.sin(clock * 0.7) * 0.03;
        
        // Smoothly interpolate to target
        headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, targetY, 0.15);
        headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, targetX, 0.15);
        headBone.rotation.z = THREE.MathUtils.lerp(headBone.rotation.z, targetZ, 0.15);
      } else {
        // Smoothly return to neutral position when idle
        headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, 0, 0.1);
        headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, 0, 0.1);
        headBone.rotation.z = THREE.MathUtils.lerp(headBone.rotation.z, 0, 0.1);
      }
    }

    vrm.update(delta);
  });

  return <primitive object={vrm.scene} />;
});

function randomBlinkDelay(): number {
  return 3 + Math.random() * 2;
}

function Placeholder({ label }: { label?: string }) {
  return (
    <View style={styles.placeholder}>
      <View style={styles.placeholderCircle}>
        <Text style={styles.placeholderEmoji}>{"\u{1F464}"}</Text>
      </View>
      <Text style={styles.placeholderText}>{label ?? "Vera"}</Text>
    </View>
  );
}

// Stable callback for Canvas creation - defined outside component to prevent recreation
const handleCanvasCreated = (state: RootState) => {
  const ctx = state.gl.getContext() as WebGLRenderingContext;
  const orig = ctx.pixelStorei.bind(ctx);
  const UNPACK_ALIGNMENT = 0x0cf5;
  const PACK_ALIGNMENT = 0x0d05;
  ctx.pixelStorei = ((pname: number, param: number) => {
    if (pname === UNPACK_ALIGNMENT || pname === PACK_ALIGNMENT) {
      orig(pname, param);
    }
  }) as typeof ctx.pixelStorei;

  state.camera.lookAt(0, 1.6, 0);
  state.camera.updateProjectionMatrix();
};

function VRoidAvatarInner({
  vrmUrl,
  emotion,
  isSpeaking,
  viseme,
}: VRoidAvatarProps) {
  // Log to verify memo is blocking re-renders
  console.log('[VRoidAvatar] Render called');
  
  const { vrm, loading, error } = useVRM(vrmUrl);
  const hasEverLoadedRef = useRef(false);
  
  // Note: All animation state (emotion, viseme, isSpeaking) is now updated directly
  // in visemeState from ChatScreen/useLipSync - not here. This allows memo to block
  // all re-renders except when vrmUrl changes.
  
  // Track if we've ever successfully loaded a VRM
  if (vrm) {
    hasEverLoadedRef.current = true;
  }

  // Only show placeholder if we've NEVER had a VRM
  // Once loaded, keep rendering the Canvas to prevent unmount flicker
  const showPlaceholder = !vrm && !hasEverLoadedRef.current;
  const showLoadingPlaceholder = !vrm && loading && !hasEverLoadedRef.current;
  
  // Log state changes for debugging
  useEffect(() => {
    console.log(`[VRoidAvatar] State: vrm=${!!vrm}, loading=${loading}, hasEverLoaded=${hasEverLoadedRef.current}`);
  }, [vrm, loading]);

  if (!vrmUrl) {
    return (
      <View style={styles.container}>
        <Placeholder label="Vera" />
      </View>
    );
  }

  if (showLoadingPlaceholder) {
    return (
      <View style={styles.container}>
        <Placeholder label="Loading avatar..." />
      </View>
    );
  }

  if (showPlaceholder) {
    if (error) {
      console.error("[VRoidAvatar] VRM load error:", error);
    }
    return (
      <View style={styles.container}>
        <Placeholder label="Vera" />
      </View>
    );
  }

  // Always render Canvas once we have (or have ever had) a VRM
  // This prevents the Canvas from unmounting during state changes
  // Note: AvatarModel reads viseme/isSpeaking from shared state, not props
  return (
    <View style={styles.container}>
      <Canvas
        key="vrm-canvas-stable"
        camera={{ position: [0, 1.6, 0.6], fov: 34, near: 0.1, far: 100 }}
        style={styles.canvas}
        gl={{ alpha: true }}
        onCreated={handleCanvasCreated}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[1, 2, 3]} intensity={1.0} />
        {vrm && (
          <AvatarModel
            vrm={vrm}
          />
        )}
      </Canvas>
    </View>
  );
}

// Wrap with memo to prevent re-renders from parent
// We only want to re-render when vrmUrl changes - all other props are read from shared state
const VRoidAvatar = memo(VRoidAvatarInner, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Only compare vrmUrl - emotion, isSpeaking, viseme are all in shared state
  return prevProps.vrmUrl === nextProps.vrmUrl;
});

export default VRoidAvatar;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  canvas: {
    flex: 1,
    backgroundColor: "transparent",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 14,
    color: "#9099B0",
  },
});
