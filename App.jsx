import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import {
  flushPendingNavigation,
  navigateWhenReady,
  navigationRef,
} from './src/navigation/navigationRef';
import { isAvailable } from './src/services/dictationOverlayService';
import { consumeReportHandoff } from './src/services/overlayHandoff';
import { resolveInitialRoute } from './src/services/overlayOnboarding';
import useSettingsStore, {
  ensureHydrated,
  watchOverlayGrant,
} from './src/store/useSettingsStore';
import { colors } from './src/theme';

function drainReportHandoff() {
  const route = consumeReportHandoff();
  if (route) {
    navigateWhenReady(route);
  }
  flushPendingNavigation();
}

const MedScribeTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primaryAccent,
    background: colors.primaryBackground,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.secondaryAccent,
  },
};

function App() {
  const hydrated = useSettingsStore(state => state.hydrated);
  const overlayGranted = useSettingsStore(state => state.overlayGranted);
  const micGranted = useSettingsStore(state => state.micGranted);
  const onboardingSeen = useSettingsStore(state => state.onboardingSeen);

  useEffect(() => {
    ensureHydrated();
    watchOverlayGrant();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        drainReportHandoff();
      }
    });
    return () => subscription.remove();
  }, []);

  const handleReady = () => {
    drainReportHandoff();
  };

  if (!hydrated) {
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <ActivityIndicator size="large" color={colors.primaryAccent} />
        </View>
      </SafeAreaProvider>
    );
  }

  const initialRouteName = resolveInitialRoute({
    overlayGranted,
    micGranted,
    onboardingSeen,
    overlaySupported: isAvailable(),
  });

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        theme={MedScribeTheme}
        onReady={handleReady}
      >
        <RootNavigator initialRouteName={initialRouteName} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = {
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBackground,
  },
};

export default App;
