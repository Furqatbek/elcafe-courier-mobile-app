import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal as RNModal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from './Button';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  footer?: React.ReactNode;
  primaryAction?: {
    label: string;
    onPress: () => void;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  containerStyle?: ViewStyle;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  footer,
  primaryAction,
  secondaryAction,
  size = 'medium',
  containerStyle,
}) => {
  const getModalWidth = () => {
    switch (size) {
      case 'small':
        return '80%';
      case 'medium':
        return '90%';
      case 'large':
        return '95%';
      case 'fullscreen':
        return '100%';
      default:
        return '90%';
    }
  };

  const getModalHeight = () => {
    switch (size) {
      case 'fullscreen':
        return '100%';
      default:
        return 'auto';
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={closeOnBackdrop ? onClose : undefined}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContainer,
                  {
                    width: getModalWidth(),
                    height: getModalHeight(),
                    maxHeight: size === 'fullscreen' ? '100%' : '80%',
                  },
                  size === 'fullscreen' && styles.fullscreen,
                  containerStyle,
                ]}
              >
                {(title || showCloseButton) && (
                  <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    {showCloseButton && (
                      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <ScrollView
                  style={styles.content}
                  contentContainerStyle={styles.contentContainer}
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>

                {(footer || primaryAction || secondaryAction) && (
                  <View style={styles.footer}>
                    {footer || (
                      <>
                        {secondaryAction && (
                          <Button
                            title={secondaryAction.label}
                            variant="outline"
                            onPress={secondaryAction.onPress}
                            style={styles.footerButton}
                          />
                        )}
                        {primaryAction && (
                          <Button
                            title={primaryAction.label}
                            variant={primaryAction.variant || 'primary'}
                            onPress={primaryAction.onPress}
                            isLoading={primaryAction.loading}
                            style={[
                              styles.footerButton,
                              secondaryAction && styles.footerButtonMargin,
                            ]}
                          />
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

// Confirmation Dialog Component
interface ConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
}) => {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      size="small"
      showCloseButton={false}
      primaryAction={{
        label: confirmLabel,
        onPress: onConfirm,
        variant: confirmVariant,
        loading,
      }}
      secondaryAction={{
        label: cancelLabel,
        onPress: onClose,
      }}
    >
      <Text style={styles.dialogMessage}>{message}</Text>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  fullscreen: {
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerButton: {
    flex: 1,
  },
  footerButtonMargin: {
    marginLeft: 12,
  },
  dialogMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },
});

export default Modal;
