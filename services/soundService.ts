/**
 * Sound Service
 *
 * Plays the bundled "new order" alert. Playback only — the app never records.
 *
 * Migrated from expo-av (deprecated in SDK 54, removed in SDK 55) to expo-audio.
 * expo-av's config plugin unconditionally injected `android.permission.RECORD_AUDIO`
 * into the manifest, which is an unjustifiable permission for a delivery app and a
 * Play data-safety red flag. expo-audio is configured in app.config.ts with
 * `recordAudioAndroid: false` / `microphonePermission: false`, and its library
 * manifest's RECORD_AUDIO + media-playback service are stripped by
 * `android.blockedPermissions` and plugins/withAndroidNoUnusedAudioServices.js.
 *
 * The public API is unchanged for callers in components/OrderOfferModal.tsx and
 * app/(tabs)/orders.tsx.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import { Platform } from 'react-native';
import logger from '@/lib/logger';

// Bundled alert sound (44.1kHz 16-bit mono WAV, two-tone urgent alert).
// Shipped with the app — no network audio in production. Metro resolves
// require() statically, so this asset must exist in the repo.
const NEW_ORDER_SOUND: AudioSource = require('@/assets/sounds/new-order.wav');

class SoundService {
  private newOrderSound: AudioPlayer | null = null;
  private isLoaded: boolean = false;
  private isPlaying: boolean = false;
  private soundSource: AudioSource = NEW_ORDER_SOUND;
  private webAudioContext: AudioContext | null = null;

  /**
   * Initialize audio settings for the app
   */
  async initialize(): Promise<void> {
    // Web uses the Web Audio API (playWebSound) and never loads the native
    // player, so there is no native audio session to configure.
    if (Platform.OS === 'web') return;

    try {
      await setAudioModeAsync({
        // The app never records. Keeps RECORD_AUDIO out of the runtime path as
        // well as out of the manifest.
        allowsRecording: false,
        // On Android this only decides whether players pause when the activity
        // backgrounds (AudioModule.kt `OnActivityEntersBackground`) — it does
        // NOT start a media-playback foreground service. Keeping it true
        // preserves the pre-migration expo-av behaviour: a pending offer keeps
        // ringing if the courier switches apps.
        shouldPlayInBackground: true,
        // iOS ONLY. Android ignores this: AudioModule.kt reads just
        // shouldPlayInBackground / interruptionMode / shouldRouteThroughEarpiece,
        // and AudioMode has no silent-mode field at all. So on Android a courier
        // whose phone is on silent will NOT hear this alert — the modal's
        // vibration and the push notification channel are what reach them.
        // Making the alert survive Android silent mode needs the alarm audio
        // usage / a dedicated notification channel, which expo-audio does not
        // expose. Tracked as a known limitation, not a migration regression:
        // expo-av behaved identically here.
        playsInSilentMode: true,
        // Duck navigation/music rather than stopping it outright.
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });
      logger.log('[SoundService] Audio mode configured');

      // Pre-load the sound
      await this.loadNewOrderSound();
    } catch (error) {
      logger.error('[SoundService] Failed to configure audio mode:', error);
    }
  }

  /**
   * Load the new order notification sound
   */
  async loadNewOrderSound(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (this.isLoaded) return;

    try {
      const player = createAudioPlayer(this.soundSource);
      player.loop = true; // Loop until stopped
      player.volume = 1.0;
      this.newOrderSound = player;
      this.isLoaded = true;
      logger.log('[SoundService] New order sound loaded');
    } catch (error) {
      logger.error('[SoundService] Failed to load new order sound:', error);
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
        logger.log('[SoundService] Web Audio API not available');
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

      logger.log('[SoundService] Playing web notification tone');
    } catch (error) {
      logger.error('[SoundService] Failed to play web sound:', error);
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
        await this.newOrderSound.seekTo(0);
        this.newOrderSound.play();
        this.isPlaying = true;
        logger.log('[SoundService] Playing new order sound');
      }
    } catch (error) {
      logger.error('[SoundService] Failed to play new order sound:', error);
    }
  }

  /**
   * Stop the new order notification sound
   */
  async stopNewOrderSound(): Promise<void> {
    try {
      if (this.newOrderSound && this.isPlaying) {
        // expo-audio has no stop(): pause and rewind so the next offer starts
        // the alert from the beginning.
        this.newOrderSound.pause();
        await this.newOrderSound.seekTo(0);
        this.isPlaying = false;
        logger.log('[SoundService] Stopped new order sound');
      }
    } catch (error) {
      logger.error('[SoundService] Failed to stop new order sound:', error);
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
      const player = createAudioPlayer(this.soundSource);
      player.loop = false;
      player.volume = 1.0;
      player.play();

      // Release the one-shot player once the clip has finished. createAudioPlayer
      // (unlike the useAudioPlayer hook) does not auto-release.
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          player.remove();
        }
      });
    } catch (error) {
      logger.error('[SoundService] Failed to play notification beep:', error);
    }
  }

  /**
   * Cleanup - unload all sounds
   */
  async cleanup(): Promise<void> {
    try {
      if (this.newOrderSound) {
        this.newOrderSound.remove();
        this.newOrderSound = null;
        this.isLoaded = false;
        this.isPlaying = false;
      }
    } catch (error) {
      logger.error('[SoundService] Failed to cleanup sounds:', error);
    }
  }
}

export const soundService = new SoundService();
export default soundService;
