/**
 * withAndroidNoUnusedAudioServices
 *
 * expo-audio's library manifest
 * (node_modules/expo-audio/android/src/main/AndroidManifest.xml) unconditionally
 * declares two foreground services:
 *
 *   <service android:name=".service.AudioControlsService"
 *            android:foregroundServiceType="mediaPlayback" />
 *   <service android:name=".service.AudioRecordingService"
 *            android:foregroundServiceType="microphone" />
 *
 * ZBR Courier uses expo-audio only to play a bundled new-order alert while the
 * offer modal is on screen (services/soundService.ts). It never records, and it
 * never calls `AudioPlayer.setActiveForLockScreen()` - the only code path in
 * expo-audio that starts AudioControlsService (see
 * expo-audio/android/src/main/java/expo/modules/audio/AudioPlayer.kt:103-110).
 *
 * The matching FOREGROUND_SERVICE_MEDIA_PLAYBACK permission is already stripped
 * by `android.blockedPermissions`, and FOREGROUND_SERVICE_MICROPHONE is never
 * declared, so both services are already inert. Removing the declarations as
 * well keeps a microphone foreground service out of the shipped manifest
 * entirely, so nothing in the uploaded AAB suggests this delivery app records
 * audio.
 *
 * If expo-audio is ever used for recording or lock-screen controls, delete this
 * plugin and declare the corresponding foreground service types in Play Console.
 */

const { withAndroidManifest } = require('expo/config-plugins');

const UNUSED_SERVICES = [
  'expo.modules.audio.service.AudioControlsService',
  'expo.modules.audio.service.AudioRecordingService',
];

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withAndroidNoUnusedAudioServices = (config) =>
  withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error(
        'withAndroidNoUnusedAudioServices: no <application> node in AndroidManifest.xml.'
      );
    }

    application.service = application.service ?? [];

    for (const name of UNUSED_SERVICES) {
      const existing = application.service.find((s) => s.$?.['android:name'] === name);
      if (existing) {
        existing.$['tools:node'] = 'remove';
      } else {
        application.service.push({
          $: { 'android:name': name, 'tools:node': 'remove' },
        });
      }
    }

    return cfg;
  });

module.exports = withAndroidNoUnusedAudioServices;
