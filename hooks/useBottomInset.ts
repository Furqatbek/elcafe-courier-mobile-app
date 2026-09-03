import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom padding that clears the system navigation bar.
 *
 * This app is edge-to-edge: `android/gradle.properties` carries
 * `edgeToEdgeEnabled=true` (Expo SDK 54 sets it, and Android 15 enforces
 * edge-to-edge for every app at targetSdk 35+, which this app is at 36). The
 * window therefore extends BEHIND the gesture pill / 3-button navigation bar,
 * and anything anchored to `bottom: 0` is drawn underneath it.
 *
 * That is worse than it looks. The content is still *visible* through the
 * translucent system bar, so it reads as a rendering quirk - but the system bar
 * swallows the touches, so buttons in that strip simply do not respond. This is
 * what made the tab bar impossible to use.
 *
 * The wrong fix is a constant: `Platform.OS === 'ios' ? 34 : 20` was the old
 * one. 34 is the iPhone home-indicator height, so it wastes 34pt on an iPhone
 * SE that has no indicator; 20 is less than the ~48dp of an Android 3-button
 * navigation bar, so the bottom of the control stays dead. Only the OS knows
 * the real number - it differs per device, and it changes at runtime when the
 * user switches between gesture and 3-button navigation.
 *
 * ADD this to the padding a control needs for its own sake; never replace it.
 * A control that wants 20pt of breathing room asks for `useBottomInset(20)`.
 *
 * @param extra Padding the control needs regardless of the system bar.
 * @returns `extra` plus the current bottom safe-area inset.
 */
export function useBottomInset(extra: number = 0): number {
  const { bottom } = useSafeAreaInsets();
  return bottom + extra;
}

export default useBottomInset;
