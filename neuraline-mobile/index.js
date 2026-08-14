/**
 * Neuraline Mobile — entry point.
 *
 * This file registers the root React component. The actual app logic
 * lives in src/app/AppRoot.tsx.
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
