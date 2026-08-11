import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ensureHydrated } from './src/store/useSettingsStore';
import { colors } from './src/theme';

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
  useEffect(() => {
    ensureHydrated();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={MedScribeTheme}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
