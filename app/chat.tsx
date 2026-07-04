import React from 'react';
import { Redirect } from 'expo-router';

// The chat screen was a client-side mock (canned auto-replies, no backend).
// Until a real messaging backend exists, this route is inert: any stale link
// or deep link lands back on the Orders tab.
// File deletion + route cleanup happens in wave 2.
export default function ChatScreen() {
  return <Redirect href="/(tabs)/orders" />;
}
