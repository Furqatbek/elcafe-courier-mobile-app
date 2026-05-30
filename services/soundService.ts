import { Audio, AVPlaybackSource } from 'expo-av';
import { Platform } from 'react-native';

// Try to load bundled sound, fall back to null if not available
let NEW_ORDER_SOUND: AVPlaybackSource | null = null;
try {
  NEW_ORDER_SOUND = require('@/assets/sounds/new-order.mp3');
} catch {
  console.log('[SoundService] No bundled sound file found, will use fallback');
}

// Fallback sound URL (free notification sound)
const FALLBACK_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

class SoundService {
  private newOrderSound: Audio.Sound | null = null;
  private isLoaded: boolean = false;
  private isPlaying: boolean = false;
  private soundSource: AVPlaybackSource;
  private webAudioContext: AudioContext | null = null;

  constructor() {
    // Use bundled sound if available, otherwise use fallback URL
    this.soundSource = NEW_ORDER_SOUND || { uri: FALLBACK_SOUND_URL };
  }

  /**
   * Initialize audio settings for the app
   */
  async initialize(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true, // Play even in silent mode
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('[SoundService] Audio mode configured');

      // Pre-load the sound
      await this.loadNewOrderSound();
    } catch (error) {
      console.error('[SoundService] Failed to configure audio mode:', error);
    }
  }

  /**
   * Load the new order notification sound
   */
  async loadNewOrderSound(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const { sound } = await Audio.Sound.createAsync(this.soundSource, {
        shouldPlay: false,
        isLooping: true, // Loop until stopped
        volume: 1.0,
      });
      this.newOrderSound = sound;
      this.isLoaded = true;
      console.log('[SoundService] New order sound loaded');
    } catch (error) {
      console.error('[SoundService] Failed to load new order sound:', error);
    }
  }

  /**
   * Play a notification tone on web using the Web Audio API.
   * Generates two ascending sine-wave beeps for an attention-getting effect.
   */
  private playWebSound(): void {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.log('[SoundService] Web Audio API not available');
        return;
      }

      if (!this.webAudioContext) {
        this.webAudioContext = new AudioCtx() as AudioContext;
      }

      const ctx = this.webAudioContext;

      // Resume context if it was suspended (browsers require user gesture)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // First beep – 880 Hz for 150ms
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 880;
      gain1.gain.setValueAtTime(0.5, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Second beep – 1174 Hz (higher) for 200ms, starts after a short gap
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1174;
      gain2.gain.setValueAtTime(0.5, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.4);

      console.log('[SoundService] Playing web notification tone');
    } catch (error) {
      console.error('[SoundService] Failed to play web sound:', error);
    }
  }

  /**
   * Play the new order notification sound (loops until stopped)
   */
  async playNewOrderSound(): Promise<void> {
    if (Platform.OS === 'web') {
      this.playWebSound();
      return;
    }

    try {
      if (!this.isLoaded) {
        await this.loadNewOrderSound();
      }

      if (this.newOrderSound && !this.isPlaying) {
        await this.newOrderSound.setPositionAsync(0);
        await this.newOrderSound.playAsync();
        this.isPlaying = true;
        console.log('[SoundService] Playing new order sound');
      }
    } catch (error) {
      console.error('[SoundService] Failed to play new order sound:', error);
    }
  }

  /**
   * Stop the new order notification sound
   */
  async stopNewOrderSound(): Promise<void> {
    try {
      if (this.newOrderSound && this.isPlaying) {
        await this.newOrderSound.stopAsync();
        this.isPlaying = false;
        console.log('[SoundService] Stopped new order sound');
      }
    } catch (error) {
      console.error('[SoundService] Failed to stop new order sound:', error);
    }
  }

  /**
   * Play a short notification beep (non-looping)
   */
  async playNotificationBeep(): Promise<void> {
    if (Platform.OS === 'web') {
      this.playWebSound();
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(this.soundSource, {
        shouldPlay: true,
        isLooping: false,
        volume: 1.0,
      });

      // Unload after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('[SoundService] Failed to play notification beep:', error);
    }
  }

  /**
   * Cleanup - unload all sounds
   */
  async cleanup(): Promise<void> {
    try {
      if (this.newOrderSound) {
        await this.newOrderSound.unloadAsync();
        this.newOrderSound = null;
        this.isLoaded = false;
        this.isPlaying = false;
      }
    } catch (error) {
      console.error('[SoundService] Failed to cleanup sounds:', error);
    }
  }
}

export const soundService = new SoundService();
export default soundService;
