import React from 'react';
import { Redirect } from 'expo-router';

// This screen is orphaned — no navigation path leads here and the order
// detail screen has its own issue-reporting modal. Any stale deep link lands
// back on the Orders tab.
// File deletion + route cleanup happens in wave 2.
export default function ReportIssueScreen() {
  return <Redirect href="/(tabs)/orders" />;
}
