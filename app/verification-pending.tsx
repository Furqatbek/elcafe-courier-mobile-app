import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  CheckCircle,
  FileText,
  Phone,
  Mail,
  MessageCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { useCourier } from '@/context/CourierContext';
import * as Linking from 'expo-linking';

export default function VerificationPendingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { logout } = useCourier();

  const handleContactSupport = (method: 'phone' | 'email' | 'chat') => {
    switch (method) {
      case 'phone':
        Linking.openURL(`tel:${APP_CONFIG.SUPPORT_PHONE}`);
        break;
      case 'email':
        Linking.openURL(`mailto:${APP_CONFIG.SUPPORT_EMAIL}?subject=Courier Verification`);
        break;
      case 'chat':
        router.push('/chat?type=support');
        break;
    }
  };

  const steps = [
    {
      title: t('verification_pending.step1_title'),
      description: t('verification_pending.step1_desc'),
      completed: true,
    },
    {
      title: t('verification_pending.step2_title'),
      description: t('verification_pending.step2_desc'),
      completed: false,
      current: true,
    },
    {
      title: t('verification_pending.step3_title'),
      description: t('verification_pending.step3_desc'),
      completed: false,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Clock size={48} color={Colors.warning} />
        </View>
        <Text style={styles.title}>{t('verification_pending.title')}</Text>
        <Text style={styles.subtitle}>{t('verification_pending.subtitle')}</Text>
      </View>

      {/* Timeline */}
      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <View key={index} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View
                style={[
                  styles.timelineDot,
                  step.completed && styles.timelineDotCompleted,
                  step.current && styles.timelineDotCurrent,
                ]}
              >
                {step.completed && <CheckCircle size={16} color={Colors.surface} />}
              </View>
              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    step.completed && styles.timelineLineCompleted,
                  ]}
                />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text
                style={[
                  styles.stepTitle,
                  step.completed && styles.stepTitleCompleted,
                  step.current && styles.stepTitleCurrent,
                ]}
              >
                {step.title}
              </Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <FileText size={24} color={Colors.primary} />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>{t('verification_pending.info_title')}</Text>
          <Text style={styles.infoText}>{t('verification_pending.info_text')}</Text>
        </View>
      </View>

      {/* Contact Support */}
      <View style={styles.supportSection}>
        <Text style={styles.supportTitle}>{t('verification_pending.need_help')}</Text>
        <View style={styles.supportButtons}>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => handleContactSupport('phone')}
          >
            <Phone size={20} color={Colors.primary} />
            <Text style={styles.supportButtonText}>{t('verification_pending.call')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => handleContactSupport('email')}
          >
            <Mail size={20} color={Colors.primary} />
            <Text style={styles.supportButtonText}>{t('verification_pending.email')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => handleContactSupport('chat')}
          >
            <MessageCircle size={20} color={Colors.primary} />
            <Text style={styles.supportButtonText}>{t('verification_pending.chat')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>{t('verification_pending.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.warning + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  timeline: {
    marginBottom: 32,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 80,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 32,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotCompleted: {
    backgroundColor: Colors.success,
  },
  timelineDotCurrent: {
    backgroundColor: Colors.warning,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  timelineLineCompleted: {
    backgroundColor: Colors.success,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 24,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 4,
  },
  stepTitleCompleted: {
    color: Colors.success,
  },
  stepTitleCurrent: {
    color: Colors.warning,
  },
  stepDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '10',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  supportSection: {
    marginBottom: 32,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  supportButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  supportButton: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    minWidth: 90,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  supportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
  },
  logoutButton: {
    alignItems: 'center',
    padding: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    color: Colors.danger,
    fontWeight: '600',
  },
});
