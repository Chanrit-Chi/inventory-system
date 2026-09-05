import { Audio } from 'expo-av'
import { SCAN_BEEP_DATA_URI, SCAN_ERROR_DATA_URI } from './scannerSoundData'

let successSound: Audio.Sound | null = null
let errorSound: Audio.Sound | null = null
let isPreloaded = false
let soundEnabled = true

export const setSoundEnabled = (enabled: boolean) => {
  soundEnabled = enabled
}

export const isSoundEnabled = () => soundEnabled

/**
 * Preload scanner audio assets into memory for instant (<10ms) zero-latency playback.
 */
export async function preloadScannerSounds(): Promise<void> {
  if (isPreloaded) return
  try {
    if (Audio?.setAudioModeAsync) {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      })
    }

    if (!successSound && Audio?.Sound) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: SCAN_BEEP_DATA_URI },
        { volume: 1.0 }
      )
      successSound = sound
    }

    if (!errorSound && Audio?.Sound) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: SCAN_ERROR_DATA_URI },
        { volume: 0.8 }
      )
      errorSound = sound
    }

    isPreloaded = true
  } catch {
    // Graceful fallback in simulator, test, or headless environments
  }
}

/**
 * Play high-pitch confirmation beep on successful barcode scan (2400Hz retail chime).
 */
export async function playScanBeep(): Promise<void> {
  if (!soundEnabled) return
  try {
    if (successSound) {
      await successSound.replayAsync()
      return
    }

    if (Audio?.Sound) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: SCAN_BEEP_DATA_URI },
        { shouldPlay: true, volume: 1.0 }
      )
      successSound = sound
    }
  } catch {
    // Safe silent fallback if audio hardware is busy, muted, or in test environment
  }
}

/**
 * Play low-pitch error tone when barcode scan encounters an issue (out of stock, deactivated, not found).
 */
export async function playScanErrorSound(): Promise<void> {
  if (!soundEnabled) return
  try {
    if (errorSound) {
      await errorSound.replayAsync()
      return
    }

    if (Audio?.Sound) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: SCAN_ERROR_DATA_URI },
        { shouldPlay: true, volume: 0.8 }
      )
      errorSound = sound
    }
  } catch {
    // Safe silent fallback
  }
}

/**
 * Release audio memory upon app shutdown or unmount.
 */
export async function unloadScannerSounds(): Promise<void> {
  try {
    if (successSound) {
      await successSound.unloadAsync()
      successSound = null
    }
    if (errorSound) {
      await errorSound.unloadAsync()
      errorSound = null
    }
    isPreloaded = false
  } catch {
    // Ignore unload errors
  }
}
