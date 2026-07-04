import React from 'react';
import { Redirect } from 'expo-router';

// The security screen only simulated change-password / 2FA / biometric flows —
// none of them are backed by the API. Until real endpoints exist, this route
// is inert: any stale link or deep link lands back on Settings.
// File deletion + route cleanup happens in wave 2.
export default function SecurityScreen() {
  return <Redirect href="/(tabs)/settings" />;
}
