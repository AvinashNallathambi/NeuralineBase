/**
 * useIsTablet — detect tablet form factor.
 *
 * Uses react-native-device-info's isTablet() plus a window-dimension
 * check so that iPad Split View (narrowed window) reflows to phone layout.
 */

import { useWindowDimensions } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const TABLET_MIN_DIMENSION = 768; // points

export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  const minDim = Math.min(width, height);
  // DeviceInfo.isTablet() is a synchronous boolean on both platforms.
  // The dimension check handles iPad Split View / Slide Over.
  return DeviceInfo.isTablet() && minDim >= TABLET_MIN_DIMENSION;
}
