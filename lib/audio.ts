import { Audio } from "expo-av";

const HIGH_QUALITY_PRESET = Audio.RecordingOptionsPresets.HIGH_QUALITY;

export const LOW_LATENCY_RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...HIGH_QUALITY_PRESET,
  isMeteringEnabled: true,
  android: {
    ...HIGH_QUALITY_PRESET.android,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  ios: {
    ...HIGH_QUALITY_PRESET.ios,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  ...(HIGH_QUALITY_PRESET.web
    ? {
        web: {
          ...HIGH_QUALITY_PRESET.web,
          bitsPerSecond: 32000,
        },
      }
    : {}),
};
