import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 3000)
      );
      
      const getPromise = (async () => {
        const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
        if (chunksStr) {
          const count = parseInt(chunksStr, 10);
          let value = "";
          for (let i = 0; i < count; i++) {
            const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
            if (chunk) value += chunk;
          }
          return value || null;
        }
        return await SecureStore.getItemAsync(key);
      })();
      
      return await Promise.race([getPromise, timeoutPromise]);
    } catch (e) {
      console.warn("SecureStore getItem error:", e);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    try {
      const CHUNK_SIZE = 1800;
      if (value.length > CHUNK_SIZE) {
        const chunks = Math.ceil(value.length / CHUNK_SIZE);
        await SecureStore.setItemAsync(`${key}_chunks`, chunks.toString());
        for (let i = 0; i < chunks; i++) {
          await SecureStore.setItemAsync(
            `${key}_chunk_${i}`,
            value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          );
        }
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      console.error("SecureStore setItem error:", e);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    try {
      const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunksStr) {
        const count = parseInt(chunksStr, 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error("SecureStore removeItem error:", e);
    }
  },
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
