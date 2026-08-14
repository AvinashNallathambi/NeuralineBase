/**
 * Neuraline Mobile — entry point.
 *
 * `react-native-gesture-handler` must be the first import so its native
 * handlers are registered before any navigator mounts.
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
