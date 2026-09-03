import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  Dimensions, 
  TouchableOpacity, 
  StatusBar,
  Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Box, BellRing, Navigation as NavigationIcon, TrendingUp, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import logger from '@/lib/logger';
import { useBottomInset } from '@/hooks/useBottomInset';

const { width, height } = Dimensions.get('window');

// Keep in sync with app/index.tsx, which reads this flag to skip onboarding
const HAS_SEEN_ONBOARDING_KEY = 'hasSeenOnboarding';

// Only show the privacy policy link when a real URL is configured
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

export default function OnboardingScreen() {
  const footerPaddingBottom = useBottomInset(24);
  const { t } = useTranslation();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const slides = [
    {
      id: 'welcome',
      title: t('onboarding.welcome_title'),
      subtitle: t('onboarding.welcome_subtitle'),
      icon: <Box size={80} color={Colors.surface} strokeWidth={1.5} />,
      bg: Colors.primary,
    },
    {
      id: 'screen1',
      title: t('onboarding.screen1_title'),
      subtitle: t('onboarding.screen1_subtitle'),
      icon: <BellRing size={80} color={Colors.surface} strokeWidth={1.5} />,
      bg: '#0EA5E9', // Sky 500
    },
    {
      id: 'screen2',
      title: t('onboarding.screen2_title'),
      subtitle: t('onboarding.screen2_subtitle'),
      icon: <NavigationIcon size={80} color={Colors.surface} strokeWidth={1.5} />,
      bg: '#F59E0B', // Amber 500
    },
    {
      id: 'screen3',
      title: t('onboarding.screen3_title'),
      subtitle: t('onboarding.screen3_subtitle'),
      icon: <TrendingUp size={80} color={Colors.surface} strokeWidth={1.5} />,
      bg: '#8B5CF6', // Violet 500
    },
  ];

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(HAS_SEEN_ONBOARDING_KEY, 'true');
    } catch (error) {
      // Non-fatal: onboarding will show again next launch
      logger.error('Failed to persist onboarding flag:', error);
    }
    router.replace('/login');
  };

  const handlePrivacyPolicy = () => {
    if (PRIVACY_URL) {
      Linking.openURL(PRIVACY_URL);
    }
  };

  const renderItem = ({ item }: { item: typeof slides[0] }) => {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={[styles.illustrationContainer, { backgroundColor: item.bg }]}>
          <View style={styles.iconCircle}>
            {item.icon}
          </View>
          {/* Decorative circles */}
          <View style={[styles.decorativeCircle, { width: 300, height: 300, opacity: 0.1 }]} />
          <View style={[styles.decorativeCircle, { width: 400, height: 400, opacity: 0.1 }]} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  };

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const contentOffsetX = e.nativeEvent.contentOffset.x;
          const index = Math.round(contentOffsetX / width);
          setCurrentIndex(index);
        }}
        bounces={false}
        style={styles.flatList}
      />

      <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        <View style={styles.buttonContainer}>
          {isLastSlide ? (
            <View style={styles.finalActionContainer}>
               <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={handleFinish}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{t('onboarding.continue_login')}</Text>
                <ChevronRight size={20} color={Colors.surface} />
              </TouchableOpacity>
              
              {PRIVACY_URL && (
                <TouchableOpacity onPress={handlePrivacyPolicy} style={styles.privacyButton}>
                  <Text style={styles.privacyText}>{t('onboarding.privacy_policy')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.navigationButtons}>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.nextButton, { backgroundColor: slides[currentIndex].bg }]} 
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>{t('onboarding.next')}</Text>
                <ChevronRight size={20} color={Colors.surface} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  illustrationContainer: {
    width: width,
    height: height * 0.6, // Occupy 60% of screen height
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    marginBottom: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  textContainer: {
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    // paddingBottom is applied at the call site from useBottomInset(24).
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: Colors.textLight,
    opacity: 0.5,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
    marginRight: 4,
  },
  finalActionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.surface,
    marginRight: 8,
  },
  privacyButton: {
    padding: 8,
  },
  privacyText: {
    fontSize: 12,
    color: Colors.textLight,
    textDecorationLine: 'underline',
  },
});
