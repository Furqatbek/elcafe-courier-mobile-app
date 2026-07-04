import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  HelpCircle,
  Package,
  CreditCard,
  Car,
  Shield,
  FileText,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';

// Contact details come from config; rows whose configured value is still a
// known placeholder are hidden so we never point users at dead contacts.
const SUPPORT_PHONE: string = APP_CONFIG.SUPPORT_PHONE;
const SUPPORT_EMAIL: string = APP_CONFIG.SUPPORT_EMAIL;
const hasRealSupportPhone = !!SUPPORT_PHONE && SUPPORT_PHONE !== '+1234567890';
const hasRealSupportEmail =
  !!SUPPORT_EMAIL && !SUPPORT_EMAIL.toLowerCase().includes('courierapp.com');

// Legal documents are only linked when their URLs are configured.
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  icon: typeof HelpCircle;
  items: FAQItem[];
}

export default function HelpCenterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const faqCategories: FAQCategory[] = [
    {
      id: 'orders',
      title: t('help.orders'),
      icon: Package,
      items: [
        {
          question: t('help.faq.how_accept_order'),
          answer: t('help.faq.how_accept_order_answer'),
        },
        {
          question: t('help.faq.cancel_order'),
          answer: t('help.faq.cancel_order_answer'),
        },
        {
          question: t('help.faq.order_issues'),
          answer: t('help.faq.order_issues_answer'),
        },
      ],
    },
    {
      id: 'earnings',
      title: t('help.earnings'),
      icon: CreditCard,
      items: [
        {
          question: t('help.faq.when_paid'),
          answer: t('help.faq.when_paid_answer'),
        },
        {
          question: t('help.faq.withdraw_earnings'),
          answer: t('help.faq.withdraw_earnings_answer'),
        },
        {
          question: t('help.faq.earnings_calculation'),
          answer: t('help.faq.earnings_calculation_answer'),
        },
      ],
    },
    {
      id: 'vehicle',
      title: t('help.vehicle'),
      icon: Car,
      items: [
        {
          question: t('help.faq.update_vehicle'),
          answer: t('help.faq.update_vehicle_answer'),
        },
        {
          question: t('help.faq.vehicle_requirements'),
          answer: t('help.faq.vehicle_requirements_answer'),
        },
      ],
    },
    {
      id: 'account',
      title: t('help.account'),
      icon: Shield,
      items: [
        {
          question: t('help.faq.reset_password'),
          answer: t('help.faq.reset_password_answer'),
        },
        {
          question: t('help.faq.update_profile'),
          answer: t('help.faq.update_profile_answer'),
        },
        {
          question: t('help.faq.delete_account'),
          answer: t('help.faq.delete_account_answer'),
        },
      ],
    },
  ];

  const contactOptions = [
    ...(hasRealSupportPhone
      ? [
          {
            id: 'phone',
            title: t('help.call_support'),
            subtitle: t('help.call_support_sub'),
            icon: Phone,
            color: '#10B981',
            onPress: () => {
              Linking.openURL(`tel:${SUPPORT_PHONE}`);
            },
          },
        ]
      : []),
    ...(hasRealSupportEmail
      ? [
          {
            id: 'email',
            title: t('help.email_support'),
            subtitle: t('help.email_support_sub'),
            icon: Mail,
            color: '#F59E0B',
            onPress: () => {
              Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
            },
          },
        ]
      : []),
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
    setExpandedQuestion(null);
  };

  const toggleQuestion = (questionKey: string) => {
    setExpandedQuestion(expandedQuestion === questionKey ? null : questionKey);
  };

  const filteredCategories = searchQuery
    ? faqCategories.map(category => ({
        ...category,
        items: category.items.filter(
          item =>
            item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.answer.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(category => category.items.length > 0)
    : faqCategories;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('help.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('help.search_placeholder')}
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Contact Options */}
        {contactOptions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('help.contact_us')}</Text>
          <View style={styles.contactGrid}>
            {contactOptions.map(option => {
              const Icon = option.icon;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={styles.contactCard}
                  onPress={option.onPress}
                >
                  <View style={[styles.contactIconContainer, { backgroundColor: `${option.color}15` }]}>
                    <Icon size={24} color={option.color} />
                  </View>
                  <Text style={styles.contactTitle}>{option.title}</Text>
                  <Text style={styles.contactSubtitle}>{option.subtitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        )}

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('help.faq_title')}</Text>

          {filteredCategories.length === 0 ? (
            <View style={styles.noResults}>
              <HelpCircle size={48} color={Colors.textLight} />
              <Text style={styles.noResultsText}>{t('help.no_results')}</Text>
            </View>
          ) : (
            filteredCategories.map(category => {
              const CategoryIcon = category.icon;
              const isExpanded = expandedCategory === category.id;

              return (
                <View key={category.id} style={styles.categoryContainer}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <View style={styles.categoryLeft}>
                      <CategoryIcon size={20} color={Colors.primary} />
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color={Colors.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={Colors.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.questionsContainer}>
                      {category.items.map((item, index) => {
                        const questionKey = `${category.id}-${index}`;
                        const isQuestionExpanded = expandedQuestion === questionKey;

                        return (
                          <View key={questionKey} style={styles.questionItem}>
                            <TouchableOpacity
                              style={styles.questionHeader}
                              onPress={() => toggleQuestion(questionKey)}
                            >
                              <Text style={styles.questionText}>{item.question}</Text>
                              {isQuestionExpanded ? (
                                <ChevronUp size={16} color={Colors.textSecondary} />
                              ) : (
                                <ChevronDown size={16} color={Colors.textSecondary} />
                              )}
                            </TouchableOpacity>

                            {isQuestionExpanded && (
                              <Text style={styles.answerText}>{item.answer}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Legal Links */}
        {(TERMS_URL || PRIVACY_URL) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('help.legal')}</Text>

            {TERMS_URL && (
              <TouchableOpacity
                style={styles.legalItem}
                onPress={() => Linking.openURL(TERMS_URL)}
              >
                <FileText size={20} color={Colors.textSecondary} />
                <Text style={styles.legalText}>{t('help.terms_of_service')}</Text>
                <ChevronRight size={20} color={Colors.textLight} />
              </TouchableOpacity>
            )}

            {PRIVACY_URL && (
              <TouchableOpacity
                style={styles.legalItem}
                onPress={() => Linking.openURL(PRIVACY_URL)}
              >
                <FileText size={20} color={Colors.textSecondary} />
                <Text style={styles.legalText}>{t('help.privacy_policy')}</Text>
                <ChevronRight size={20} color={Colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        )}
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: Colors.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  contactCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  categoryContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 12,
  },
  questionsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  questionItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingRight: 12,
  },
  answerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  noResults: {
    alignItems: 'center',
    padding: 48,
  },
  noResultsText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  legalText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
});
