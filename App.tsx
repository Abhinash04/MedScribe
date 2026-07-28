import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
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
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={MedScribeTheme}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
