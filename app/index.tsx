import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keep in sync with app/onboarding.tsx, which sets this flag on completion
const HAS_SEEN_ONBOARDING_KEY = 'hasSeenOnboarding';

export default function Index() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HAS_SEEN_ONBOARDING_KEY)
      .then((value) => setHasSeenOnboarding(value === 'true'))
      .catch(() => setHasSeenOnboarding(false));
  }, []);

  // Wait for the flag before routing; the root layout shows the splash/loader
  if (hasSeenOnboarding === null) {
    return null;
  }

  // Authenticated users are bounced onward to the app by AuthNavigator
  return <Redirect href={hasSeenOnboarding ? '/login' : '/onboarding'} />;
}
