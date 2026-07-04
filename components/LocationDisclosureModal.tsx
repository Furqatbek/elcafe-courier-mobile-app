import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';

/**
 * AsyncStorage key persisted once the user accepts the disclosure.
 * Location permission must never be requested before this is 'true'
 * (Google Play prominent-disclosure policy).
 */
export const LOCATION_DISCLOSURE_ACCEPTED_KEY = 'locationDisclosureAccepted';

interface LocationDisclosureModalProps {
  visible: boolean;
  onAgree: () => void;
  onNotNow: () => void;
}

/**
 * Prominent disclosure shown before the app ever asks for location
 * permission. Explains that location is collected while the courier is
 * online — including in the background — to dispatch orders and share
 * their position. The OS permission prompt may only follow "Agree".
 */
export const LocationDisclosureModal = React.memo(function LocationDisclosureModal({
  visible,
  onAgree,
  onNotNow,
}: LocationDisclosureModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onNotNow}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <MapPin size={32} color={Colors.primary} />
          </View>

          <Text style={styles.title}>
            {t('location_disclosure.title', 'Location Sharing')}
          </Text>

          <Text style={styles.description}>
            {t(
              'location_disclosure.description',
              'To dispatch nearby orders and share your live position with restaurants and customers, this app collects location data while you are online — including when the app is in the background or closed.'
            )}
          </Text>

          <Text style={styles.note}>
            {t(
              'location_disclosure.offline_note',
              'Your location is not collected while you are offline.'
            )}
          </Text>

          <TouchableOpacity
            style={styles.agreeButton}
            onPress={onAgree}
            activeOpacity={0.8}
          >
            <Text style={styles.agreeButtonText}>
              {t('location_disclosure.agree', 'Agree')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.notNowButton} onPress={onNotNow}>
            <Text style={styles.notNowButtonText}>
              {t('location_disclosure.not_now', 'Not now')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
    }),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  agreeButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  agreeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
  notNowButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  notNowButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});

export default LocationDisclosureModal;
