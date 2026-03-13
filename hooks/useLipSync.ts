import { useEffect, useRef, useCallback } from "react";
import { visemeState } from "../components/VRoidAvatar";

type Viseme = "A" | "E" | "I" | "O" | "U" | "B" | "F" | "K" | "S" | "T" | "X";

const SAMPLE_RATE = 16000; // 16kHz audio
const CHUNK_SIZE = 768; // 768 samples = 48ms per chunk at 16kHz (balance of smoothness and responsiveness)

// Simple hash to identify audio data
function hashAudio(base64: string): string {
  // Use length + first/last chars as a simple identifier
  if (!base64 || base64.length < 20) return "";
  return `${base64.length}-${base64.substring(0, 10)}-${base64.substring(base64.length - 10)}`;
}

function decodeBase64PCM16(base64: string): Int16Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function computeRMS(samples: Int16Array, start: number, length: number): number {
  const end = Math.min(start + length, samples.length);
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) {
    const normalized = samples[i] / 32768;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / (end - start));
}

function energyToViseme(energy: number, frameIndex: number): Viseme {
  // Lower thresholds for better sensitivity
  // Typical speech RMS is around 0.02-0.2
  
  if (energy < 0.005) return "X"; // Silence
  
  // Add some variation based on frame index for more natural movement
  const variation = Math.sin(frameIndex * 0.3) * 0.01;
  const adjustedEnergy = energy + variation;
  
  if (adjustedEnergy > 0.12) return "A";  // Wide open (loud)
  if (adjustedEnergy > 0.08) return "O";  // Round open
  if (adjustedEnergy > 0.04) return "E";  // Mid open
  if (adjustedEnergy > 0.02) return "I";  // Slightly open
  if (adjustedEnergy > 0.01) return "U"; // Nearly closed
  return "X"; // Closed
}

export function useLipSync(
  audioBase64: string,
  isSpeaking: boolean
): { currentViseme: string } {
  // We use a ref to track current viseme for the return value
  // but the actual updates go directly to visemeState to avoid React re-renders
  const currentVisemeRef = useRef<string>("X");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIndexRef = useRef(0);
  const samplesRef = useRef<Int16Array | null>(null);
  const frameCountRef = useRef(0);
  const totalChunksRef = useRef(0);
  const isProcessingRef = useRef(false);
  const processedAudioIdRef = useRef<string>(""); // Track which audio we've processed
  const prevVisemeRef = useRef<string>("X"); // Track previous viseme for transition smoothing

  // Helper to update viseme in both places
  const updateViseme = useCallback((viseme: string) => {
    currentVisemeRef.current = viseme;
    visemeState.current = viseme; // Direct update, no React re-render!
  }, []);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  // Update isSpeaking in shared state (direct mutation, no re-render)
  useEffect(() => {
    visemeState.isSpeaking = isSpeaking;
  }, [isSpeaking]);

  // Reset when not speaking
  useEffect(() => {
    if (!isSpeaking) {
      clearTimers();
      chunkIndexRef.current = 0;
      samplesRef.current = null;
      frameCountRef.current = 0;
      totalChunksRef.current = 0;
      processedAudioIdRef.current = ""; // Reset so new audio can be processed
      prevVisemeRef.current = "X"; // Reset previous viseme
      updateViseme("X");
      console.log("[useLipSync] Reset - isSpeaking is false");
    }
  }, [isSpeaking, clearTimers, updateViseme]);

  // Start lip sync when we have audio and are speaking
  useEffect(() => {
    // Don't start if not speaking or no audio
    if (!isSpeaking || !audioBase64) {
      return;
    }

    // Check if we've already processed this exact audio
    const audioId = hashAudio(audioBase64);
    if (audioId === processedAudioIdRef.current && isProcessingRef.current) {
      console.log("[useLipSync] Skipping - already processing this audio");
      return;
    }

    // Clear any existing interval
    clearTimers();

    try {
      const samples = decodeBase64PCM16(audioBase64);
      samplesRef.current = samples;
      chunkIndexRef.current = 0;
      frameCountRef.current = 0;
      isProcessingRef.current = true;
      processedAudioIdRef.current = audioId;
      prevVisemeRef.current = "X"; // Start fresh for new audio

      const totalChunks = Math.ceil(samples.length / CHUNK_SIZE);
      totalChunksRef.current = totalChunks;
      
      // Calculate interval to match audio duration
      const totalDurationMs = (samples.length / SAMPLE_RATE) * 1000;
      const intervalMs = Math.max(25, Math.round(totalDurationMs / totalChunks));
      
      console.log(`[useLipSync] Starting: ${totalChunks} chunks, ${totalDurationMs.toFixed(0)}ms duration, ${intervalMs}ms interval`);

      let lastLogTime = Date.now();
      intervalRef.current = setInterval(() => {
        if (!samplesRef.current || !isProcessingRef.current) {
          return;
        }

        const idx = chunkIndexRef.current;
        const total = totalChunksRef.current;
        
        // Process current chunk
        if (idx < total) {
          const start = idx * CHUNK_SIZE;
          const energy = computeRMS(samplesRef.current, start, CHUNK_SIZE);
          
          // Use raw energy directly for responsive lip sync (no smoothing delay)
          // Smoothing is handled by lerping in VRoidAvatar instead
          const viseme = energyToViseme(energy, frameCountRef.current);
          
          // Log every 500ms to track progress
          const now = Date.now();
          if (now - lastLogTime > 500) {
            console.log(`[useLipSync] chunk ${idx}/${total}, energy=${energy.toFixed(3)}, viseme=${viseme}`);
            lastLogTime = now;
          }
          
          updateViseme(viseme);
          prevVisemeRef.current = viseme;
          
          chunkIndexRef.current = idx + 1;
          frameCountRef.current++;
        } else {
          // All chunks processed - stop animating immediately
          // The mouth will close via lerping in AvatarModel
          console.log("[useLipSync] All chunks processed, stopping animation");
          updateViseme("X");
          isProcessingRef.current = false;
          // Don't clear the interval here - let it be cleared when isSpeaking becomes false
          // But stop processing by setting isProcessingRef to false
        }
      }, intervalMs);
      
    } catch (e) {
      console.error("[useLipSync] Failed to decode audio:", e);
      clearTimers();
      updateViseme("X");
    }

    return () => clearTimers();
  }, [audioBase64, isSpeaking, clearTimers, updateViseme]);

  // Return ref value (doesn't trigger re-renders when it changes)
  return { currentViseme: currentVisemeRef.current };
}
