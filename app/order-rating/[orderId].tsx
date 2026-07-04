import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  CheckCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { useCourier } from '@/context/CourierContext';

export default function OrderRatingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { authenticatedFetch } = useCourier();

  const [overallRating, setOverallRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const positiveTags = [
    t('rating.tags.fast_delivery'),
    t('rating.tags.friendly'),
    t('rating.tags.accurate_navigation'),
    t('rating.tags.well_packaged'),
    t('rating.tags.on_time'),
    t('rating.tags.professional'),
  ];

  const negativeTags = [
    t('rating.tags.slow_delivery'),
    t('rating.tags.got_lost'),
    t('rating.tags.damaged_items'),
    t('rating.tags.late'),
    t('rating.tags.unprofessional'),
  ];

  const tags = overallRating >= 4 ? positiveTags : overallRating > 0 ? negativeTags : [];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (overallRating === 0) {
      Alert.alert(t('common.error_title'), t('rating.please_rate'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await authenticatedFetch(
        `/api/v1/couriers/me/orders/${orderId}/rating`,
        {
          method: 'POST',
          body: JSON.stringify({
            rating: overallRating,
            tags: selectedTags,
            comment: comment.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        let message = '';
        try {
          const data = await response.json();
          message = data?.message || '';
        } catch {
          // Non-JSON error body — fall through to generic message
        }
        throw new Error(message || `HTTP ${response.status}`);
      }

      setIsSubmitted(true);
    } catch (err: any) {
      // The rating was NOT saved — say so, and never trap the courier here.
      Alert.alert(
        t('common.error_title'),
        err?.message
          ? `${t('rating.submit_failed')}\n\n${err.message}`
          : t('rating.submit_failed'),
        [
          { text: t('common.retry', 'Retry'), style: 'default' },
          { text: t('rating.skip'), style: 'cancel', onPress: handleClose },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    router.replace('/(tabs)/orders');
  };

  if (isSubmitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <CheckCircle size={64} color={Colors.primary} />
          </View>
          <Text style={styles.successTitle}>{t('rating.thank_you')}</Text>
          <Text style={styles.successMessage}>{t('rating.feedback_received')}</Text>
          <Button
            title={t('rating.back_to_orders')}
            onPress={handleClose}
            style={styles.successButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rating.title')}</Text>
        <TouchableOpacity onPress={handleClose}>
          <Text style={styles.skipText}>{t('rating.skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order Info */}
        <View style={styles.orderInfo}>
          <Text style={styles.orderLabel}>{t('rating.order_number')}</Text>
          <Text style={styles.orderNumber}>#{orderId}</Text>
        </View>

        {/* Star Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>{t('rating.how_was_experience')}</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => setOverallRating(star)}
                style={styles.starButton}
              >
                <Star
                  size={40}
                  color={star <= overallRating ? '#F59E0B' : Colors.border}
                  fill={star <= overallRating ? '#F59E0B' : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>
          {overallRating > 0 && (
            <Text style={styles.ratingText}>
              {overallRating === 5
                ? t('rating.excellent')
                : overallRating === 4
                ? t('rating.good')
                : overallRating === 3
                ? t('rating.okay')
                : overallRating === 2
                ? t('rating.poor')
                : t('rating.terrible')}
            </Text>
          )}
        </View>

        {/* Tags */}
        {tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.sectionTitle}>
              {overallRating >= 4 ? t('rating.what_went_well') : t('rating.what_went_wrong')}
            </Text>
            <View style={styles.tagsContainer}>
              {tags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tag, isSelected && styles.tagSelected]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Comment */}
        <View style={styles.commentSection}>
          <Text style={styles.sectionTitle}>{t('rating.additional_comments')}</Text>
          <TextInput
            style={styles.commentInput}
            placeholder={t('rating.comment_placeholder')}
            placeholderTextColor={Colors.textLight}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Button
          title={t('rating.submit_rating')}
          onPress={handleSubmit}
          isLoading={isLoading}
          style={styles.submitButton}
        />

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleClose}
          disabled={isLoading}
        >
          <Text style={styles.skipButtonText}>{t('rating.skip')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  skipText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  orderInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  orderLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  tagsSection: {
    marginBottom: 32,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: Colors.surface,
  },
  commentSection: {
    marginBottom: 24,
  },
  commentInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 120,
  },
  submitButton: {
    marginTop: 8,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  successButton: {
    width: '100%',
  },
});
