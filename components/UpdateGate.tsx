import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react-native';

import Colors from '@/constants/colors';
import { APP_CONFIG, VERSION_CHECK_CONFIG } from '@/constants/config';
import { useToast } from '@/components/Toast';
import { useBottomInset } from '@/hooks/useBottomInset';
import { fetchVersionInfo, evaluateUpdate, type UpdateDecision } from '@/services/appVersion';
import logger from '@/lib/logger';

/** Last version we prompted about, and when. */
const PROMPTED_VERSION_KEY = 'update_prompted_version';
const PROMPTED_AT_KEY = 'update_prompted_at';

/**
 * Checks for a newer release on launch and on resume, and prompts.
 *
 * Mounted once near the root. Renders nothing at all in the common case — a
 * courier on the current build should never know this exists.
 *
 * Two outcomes:
 *
 *   optional  — a toast with an "Update" action. Non-blocking, and rate
 *               limited (see shouldPrompt): a courier who has decided to
 *               update later should not be asked again every time they come
 *               back from Google Maps, which on a delivery is constantly.
 *   mandatory — a dialog with no dismiss. The build is below the minimum the
 *               backend serves, so there is nothing useful they could do in the
 *               app anyway; offering a way past it would only produce confusing
 *               failures deeper in.
 */
export function UpdateGate() {
  const { t } = useTranslation();
  const toast = useToast();
  const [blocking, setBlocking] = useState<UpdateDecision | null>(null);
  const lastCheckedAtRef = useRef(0);
  const checkInFlightRef = useRef(false);
  const dialogPaddingBottom = useBottomInset(24);

  const openStore = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      logger.error('[UpdateGate] Could not open the store:', error);
    }
  }, []);

  /**
   * Has this courier already been told about this exact version recently?
   *
   * Keyed by version, not by a plain timestamp, so a NEW release always gets
   * through immediately even if they dismissed the previous one a minute ago —
   * the cooldown is about not nagging, not about delaying real news.
   */
  const shouldPrompt = useCallback(async (version: string | null): Promise<boolean> => {
    if (!version) return false;
    try {
      const [lastVersion, lastAt] = await Promise.all([
        AsyncStorage.getItem(PROMPTED_VERSION_KEY),
        AsyncStorage.getItem(PROMPTED_AT_KEY),
      ]);
      if (lastVersion !== version) return true;
      const at = Number(lastAt);
      if (!Number.isFinite(at)) return true;
      return Date.now() - at > VERSION_CHECK_CONFIG.OPTIONAL_PROMPT_COOLDOWN_MS;
    } catch {
      // Storage unavailable: prompt. A missed update is worse than a repeat.
      return true;
    }
  }, []);

  const recordPrompt = useCallback(async (version: string | null) => {
    if (!version) return;
    try {
      await AsyncStorage.multiSet([
        [PROMPTED_VERSION_KEY, version],
        [PROMPTED_AT_KEY, String(Date.now())],
      ]);
    } catch {
      // Not worth surfacing — the cost is one extra prompt.
    }
  }, []);

  const check = useCallback(async () => {
    // In development (Expo Go, `npm start`, a dev client) the installed version
    // is not this app's version — Application.nativeApplicationVersion returns
    // the host app's, or null, which APP_CONFIG.VERSION falls back to '1.0.2'.
    // Comparing that against the backend's latestVersion produces a phantom
    // "new version available" toast on a build that is by definition the newest
    // code there is. Only a real store build has a meaningful version to check.
    if (__DEV__) return;

    // Resume fires for every return from the camera, Maps, a phone call. A
    // release does not land minute to minute, so most of those are wasted
    // requests on the courier's mobile data.
    if (checkInFlightRef.current) return;
    if (Date.now() - lastCheckedAtRef.current < VERSION_CHECK_CONFIG.MIN_CHECK_INTERVAL_MS) {
      return;
    }
    checkInFlightRef.current = true;

    try {
      const info = await fetchVersionInfo();
      if (!info) return;

      lastCheckedAtRef.current = Date.now();
      const decision = evaluateUpdate(APP_CONFIG.VERSION, info);

      if (decision.kind === 'mandatory') {
        setBlocking(decision);
        return;
      }

      if (decision.kind === 'optional' && (await shouldPrompt(decision.latestVersion))) {
        await recordPrompt(decision.latestVersion);
        toast.showToast({
          type: 'info',
          title: t('update.available_title'),
          message: t('update.available_message', { version: decision.latestVersion }),
          // Longer than the default: this one asks for a decision.
          duration: 8000,
          actionLabel: t('update.action'),
          onAction: () => openStore(decision.storeUrl),
        });
      }
    } finally {
      checkInFlightRef.current = false;
    }
  }, [t, toast, shouldPrompt, recordPrompt, openStore]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!blocking) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { paddingBottom: dialogPaddingBottom }]}>
          <View style={styles.iconCircle}>
            <Download size={28} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{t('update.required_title')}</Text>
          <Text style={styles.body}>{t('update.required_message')}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => openStore(blocking.storeUrl)}
          >
            <Text style={styles.buttonLabel}>{t('update.action_now')}</Text>
          </TouchableOpacity>
          <Text style={styles.footnote}>
            {t('update.current_version', { version: APP_CONFIG.VERSION })}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    // Side gutter so the dialog never touches the screen edge on a small phone.
    paddingHorizontal: 24,
  },
  dialog: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonLabel: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  footnote: {
    marginTop: 14,
    fontSize: 12,
    color: Colors.textLight,
  },
});

export default UpdateGate;
