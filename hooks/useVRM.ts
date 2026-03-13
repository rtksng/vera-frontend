import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import { File, Paths } from "expo-file-system";

// Global texture data store - keyed by texture name
export const textureDataStore = new Map<string, {
  uri: string;
  base64: string;
  mimeType: string;
}>();

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * GLTFLoader plugin that replaces the default texture loading with a
 * React Native–compatible path.
 *
 * The stock GLTFLoader relies on browser APIs (ImageBitmapLoader, Blob,
 * URL.createObjectURL, DOM Image) that don't work in Hermes. This plugin
 * intercepts every `loadTexture` call, extracts the embedded image bytes
 * from the GLB binary chunk, and stores the base64 data directly in the
 * texture for later use by the material system.
 */
class RNTexturePlugin {
  parser: any;
  name = "RN_TEXTURE_PLUGIN";
  private textureCache: Map<number, Promise<THREE.Texture>>;

  constructor(parser: any) {
    this.parser = parser;
    this.textureCache = new Map();
  }

  loadTexture(textureIndex: number): Promise<THREE.Texture> {
    // Return cached texture if already loading/loaded
    if (this.textureCache.has(textureIndex)) {
      return this.textureCache.get(textureIndex)!;
    }

    const promise = this._loadTextureInternal(textureIndex);
    this.textureCache.set(textureIndex, promise);
    return promise;
  }

  private async _loadTextureInternal(textureIndex: number): Promise<THREE.Texture> {
    const parser = this.parser;
    const json = parser.json;
    const textureDef = json.textures[textureIndex];
    const sourceIndex = textureDef.source;
    const sourceDef = json.images[sourceIndex];
    const samplers = json.samplers || {};
    const sampler = samplers[textureDef.sampler] || {};

    const WEBGL_FILTERS: Record<number, number> = {
      9728: THREE.NearestFilter,
      9729: THREE.LinearFilter,
      9984: THREE.NearestMipmapNearestFilter,
      9985: THREE.LinearMipmapNearestFilter,
      9986: THREE.NearestMipmapLinearFilter,
      9987: THREE.LinearMipmapLinearFilter,
    };
    const WEBGL_WRAPPINGS: Record<number, number> = {
      33071: THREE.ClampToEdgeWrapping,
      33648: THREE.MirroredRepeatWrapping,
      10497: THREE.RepeatWrapping,
    };

    let base64: string;
    let mimeType: string;

    if (sourceDef.bufferView !== undefined) {
      const bufferView: ArrayBuffer = await parser.getDependency(
        "bufferView",
        sourceDef.bufferView,
      );
      mimeType = sourceDef.mimeType || "image/png";
      base64 = uint8ToBase64(new Uint8Array(bufferView));
    } else if (sourceDef.uri?.startsWith("data:")) {
      const parts = sourceDef.uri.split(";base64,");
      mimeType = parts[0].replace("data:", "");
      base64 = parts[1];
    } else {
      throw new Error(`Unsupported image source for index ${sourceIndex}`);
    }

    // Write texture to cache file for later loading
    const ext =
      mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
    const fileName = `vrm_tex_${sourceIndex}_${Date.now()}.${ext}`;
    const file = new File(Paths.cache, fileName);
    await file.write(base64, { encoding: "base64" });

    console.log(`[useVRM] Saved texture ${sourceIndex} to:`, file.uri);

    // Store in global texture data store with a unique name
    const textureName = `vrm_texture_${sourceIndex}`;
    const vrmTextureName = textureDef.name || sourceDef.name || "";
    
    // Store texture data under both our internal name and the VRM's name
    const textureDataEntry = {
      uri: file.uri,
      base64: base64,
      mimeType: mimeType,
    };
    textureDataStore.set(textureName, textureDataEntry);
    // Also store by VRM texture name if it exists and is different
    if (vrmTextureName && vrmTextureName !== textureName) {
      textureDataStore.set(vrmTextureName, textureDataEntry);
    }
    // Store by texture index as well for direct lookup
    textureDataStore.set(`texture_index_${textureIndex}`, textureDataEntry);

    // Create texture with metadata for expo-gl rendering
    const texture = new THREE.Texture();
    
    // Store our internal name for consistent lookup
    (texture as any).__rnStoreName = textureName;
    
    // Store texture data for later access by the rendering system
    (texture as any).__rnTextureUri = file.uri;
    (texture as any).__rnTextureBase64 = base64;
    (texture as any).__rnTextureMimeType = mimeType;
    (texture as any).__rnTextureIndex = textureIndex;
    (texture as any).__rnSourceIndex = sourceIndex;
    
    // Mark as a valid texture
    (texture as any).isTexture = true;
    texture.image = { width: 1, height: 1, data: null }; // Placeholder
    texture.flipY = false;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    console.log(`[useVRM] Created texture ${textureName} (VRM name: "${vrmTextureName}") with URI stored`);

    // Apply sampler settings
    texture.magFilter = (WEBGL_FILTERS[sampler.magFilter] ?? THREE.LinearFilter) as THREE.MagnificationTextureFilter;
    texture.minFilter = (WEBGL_FILTERS[sampler.minFilter] ?? THREE.LinearFilter) as THREE.MinificationTextureFilter;
    texture.wrapS = (WEBGL_WRAPPINGS[sampler.wrapS] ?? THREE.ClampToEdgeWrapping) as THREE.Wrapping;
    texture.wrapT = (WEBGL_WRAPPINGS[sampler.wrapT] ?? THREE.ClampToEdgeWrapping) as THREE.Wrapping;
    // Keep the VRM texture name for compatibility, but we use __rnStoreName for lookups
    texture.name = vrmTextureName;

    parser.associations.set(texture, { textures: textureIndex });

    return texture;
  }
}

async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const file = new File(uri);
  const buffer = await file.arrayBuffer();
  return buffer;
}

// Module-level VRM cache to persist across component remounts
const vrmCache = new Map<string, VRM>();

export function useVRM(vrmUri: string): {
  vrm: VRM | null;
  loading: boolean;
  error: Error | null;
} {
  const [vrm, setVrm] = useState<VRM | null>(() => {
    // Initialize from cache if available
    return vrmUri ? vrmCache.get(vrmUri) ?? null : null;
  });
  const [loading, setLoading] = useState(() => {
    // Not loading if we have a cached VRM
    return vrmUri ? !vrmCache.has(vrmUri) : false;
  });
  const [error, setError] = useState<Error | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const loadingUriRef = useRef<string | null>(null); // Track what we're currently loading

  useEffect(() => {
    if (!vrmUri) {
      setLoading(false);
      return;
    }

    // Check cache first
    const cachedVrm = vrmCache.get(vrmUri);
    if (cachedVrm) {
      console.log('[useVRM] Using cached VRM for:', vrmUri.substring(0, 50) + '...');
      setVrm(cachedVrm);
      setLoading(false);
      return;
    }

    // Skip if we're already loading this URI
    if (loadingUriRef.current === vrmUri) {
      return;
    }

    loadingUriRef.current = vrmUri;
    let cancelled = false;
    
    // Only show loading if we don't have a VRM yet
    if (!vrm) {
      setLoading(true);
    }
    setError(null);

    if (!loaderRef.current) {
      const loader = new GLTFLoader();
      loader.register((parser: any) => new RNTexturePlugin(parser) as any);
      loader.register((parser: any) => new VRMLoaderPlugin(parser) as any);
      loaderRef.current = loader;
    }

    console.log('[useVRM] Loading VRM from:', vrmUri.substring(0, 50) + '...');

    (async () => {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(vrmUri);
        if (cancelled) {
          loadingUriRef.current = null;
          return;
        }

        loaderRef.current!.parse(
          arrayBuffer,
          "",
          (gltf) => {
            if (cancelled) {
              loadingUriRef.current = null;
              return;
            }
            const vrmData = gltf.userData?.vrm as VRM | undefined;
            if (vrmData) {
              vrmData.scene.traverse((obj: any) => {
                obj.frustumCulled = false;
              });
              // Cache the VRM
              vrmCache.set(vrmUri, vrmData);
              console.log('[useVRM] VRM loaded and cached');
              setVrm(vrmData);
            } else {
              setError(new Error("No VRM data found in loaded GLTF"));
            }
            setLoading(false);
            loadingUriRef.current = null;
          },
          (e: any) => {
            if (cancelled) {
              loadingUriRef.current = null;
              return;
            }
            setError(e instanceof Error ? e : new Error(String(e)));
            setLoading(false);
            loadingUriRef.current = null;
          },
        );
      } catch (e) {
        if (cancelled) {
          loadingUriRef.current = null;
          return;
        }
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
        loadingUriRef.current = null;
      }
    })();

    return () => { 
      cancelled = true; 
    };
  }, [vrmUri]); // vrm intentionally not in deps

  return { vrm, loading, error };
}
