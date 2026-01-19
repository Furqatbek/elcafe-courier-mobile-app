import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  UserX,
  MapPinOff,
  Clock,
  Car,
  AlertCircle,
  Camera,
  X,
  CheckCircle,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { ISSUE_TYPES, IssueType } from '@/constants/config';
import { useToast } from '@/components/Toast';
import { api } from '@/services/api';

const issueIcons: Record<IssueType, any> = {
  CUSTOMER_UNAVAILABLE: UserX,
  WRONG_ADDRESS: MapPinOff,
  RESTAURANT_DELAY: Clock,
  ACCIDENT: AlertTriangle,
  VEHICLE_ISSUE: Car,
  OTHER: AlertCircle,
};

export default function ReportIssueScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const toast = useToast();

  const [selectedIssue, setSelectedIssue] = useState<IssueType | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const issueOptions = [
    { type: ISSUE_TYPES.CUSTOMER_UNAVAILABLE, label: t('report_issue.customer_unavailable') },
    { type: ISSUE_TYPES.WRONG_ADDRESS, label: t('report_issue.wrong_address') },
    { type: ISSUE_TYPES.RESTAURANT_DELAY, label: t('report_issue.restaurant_delay') },
    { type: ISSUE_TYPES.ACCIDENT, label: t('report_issue.accident') },
    { type: ISSUE_TYPES.VEHICLE_ISSUE, label: t('report_issue.vehicle_issue') },
    { type: ISSUE_TYPES.OTHER, label: t('report_issue.other') },
  ];

  const handlePickImage = async () => {
    if (photos.length >= 3) {
      toast.warning(t('report_issue.max_photos'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, result.assets[0].base64]);
    }
  };

  const handleTakePhoto = async () => {
    if (photos.length >= 3) {
      toast.warning(t('report_issue.max_photos'));
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toast.error(t('report_issue.camera_permission'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, result.assets[0].base64]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedIssue) {
      toast.error(t('report_issue.select_issue'));
      return;
    }

    if (!description.trim()) {
      toast.error(t('report_issue.enter_description'));
      return;
    }

    setIsLoading(true);
    try {
      await api.orders.reportIssue(orderId!, {
        issueType: selectedIssue,
        description: description.trim(),
        photos: photos.length > 0 ? photos : undefined,
      });

      toast.success(t('report_issue.success'));
      router.back();
    } catch (error: any) {
      toast.error(error.message || t('report_issue.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('report_issue.title') }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AlertTriangle size={32} color={Colors.warning} />
          <Text style={styles.title}>{t('report_issue.header')}</Text>
          <Text style={styles.subtitle}>{t('report_issue.subtitle')}</Text>
        </View>

        {/* Issue Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('report_issue.issue_type')}</Text>
          <View style={styles.issueGrid}>
            {issueOptions.map(({ type, label }) => {
              const Icon = issueIcons[type];
              const isSelected = selectedIssue === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.issueOption, isSelected && styles.issueOptionSelected]}
                  onPress={() => setSelectedIssue(type)}
                >
                  <Icon
                    size={24}
                    color={isSelected ? Colors.warning : Colors.textSecondary}
                  />
                  <Text
                    style={[styles.issueLabel, isSelected && styles.issueLabelSelected]}
                  >
                    {label}
                  </Text>
                  {isSelected && (
                    <CheckCircle size={18} color={Colors.warning} style={styles.checkIcon} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('report_issue.description')}</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder={t('report_issue.description_placeholder')}
            placeholderTextColor={Colors.textLight}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('report_issue.photos_optional')}</Text>
          <View style={styles.photoSection}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${photo}` }}
                  style={styles.photo}
                />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <X size={16} color={Colors.surface} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 3 && (
              <View style={styles.addPhotoButtons}>
                <TouchableOpacity style={styles.addPhotoButton} onPress={handleTakePhoto}>
                  <Camera size={24} color={Colors.primary} />
                  <Text style={styles.addPhotoText}>{t('report_issue.take_photo')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickImage}>
                  <Camera size={24} color={Colors.primary} />
                  <Text style={styles.addPhotoText}>{t('report_issue.choose_photo')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.submitButtonText}>{t('report_issue.submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  issueGrid: {
    gap: 12,
  },
  issueOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 12,
  },
  issueOptionSelected: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '10',
  },
  issueLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  issueLabelSelected: {
    color: Colors.text,
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  descriptionInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: 16,
    fontSize: 15,
    color: Colors.text,
    minHeight: 120,
  },
  photoSection: {
    gap: 12,
  },
  photoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
    gap: 8,
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  submitButton: {
    height: 56,
    backgroundColor: Colors.warning,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.surface,
  },
});
