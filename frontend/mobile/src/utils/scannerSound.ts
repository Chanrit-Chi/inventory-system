import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio'

let BEEP_ASSET: any = null
let ERROR_ASSET: any = null
try {
  BEEP_ASSET = require('../../assets/sounds/beep.wav')
  ERROR_ASSET = require('../../assets/sounds/error.wav')
} catch {
  // Graceful fallback for environments where static assets are stubbed
}

let successPlayer: AudioPlayer | null = null
let errorPlayer: AudioPlayer | null = null
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
    if (typeof setAudioModeAsync === 'function') {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
      })
    }

    if (!successPlayer && typeof createAudioPlayer === 'function') {
      const player = createAudioPlayer(BEEP_ASSET)
      if (player) {
        player.volume = 1.0
        successPlayer = player
      }
    }

    if (!errorPlayer && typeof createAudioPlayer === 'function') {
      const player = createAudioPlayer(ERROR_ASSET)
      if (player) {
        player.volume = 0.8
        errorPlayer = player
      }
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
    if (successPlayer) {
      if (typeof successPlayer.seekTo === 'function') {
        await successPlayer.seekTo(0)
      }
      successPlayer.play()
      return
    }

    if (typeof createAudioPlayer === 'function') {
      const player = createAudioPlayer(BEEP_ASSET)
      if (player) {
        player.volume = 1.0
        player.play()
        successPlayer = player
      }
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
    if (errorPlayer) {
      if (typeof errorPlayer.seekTo === 'function') {
        await errorPlayer.seekTo(0)
      }
      errorPlayer.play()
      return
    }

    if (typeof createAudioPlayer === 'function') {
      const player = createAudioPlayer(ERROR_ASSET)
      if (player) {
        player.volume = 0.8
        player.play()
        errorPlayer = player
      }
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
    if (successPlayer) {
      if (typeof successPlayer.remove === 'function') {
        successPlayer.remove()
      }
      successPlayer = null
    }
    if (errorPlayer) {
      if (typeof errorPlayer.remove === 'function') {
        errorPlayer.remove()
      }
      errorPlayer = null
    }
    isPreloaded = false
  } catch {
    // Silent catch
  }
}
