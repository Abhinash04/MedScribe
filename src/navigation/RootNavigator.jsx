import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import RecordingScreen from '../screens/RecordingScreen';
import ReportScreen from '../screens/ReportScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

/**
 * Dashboard -> Recording -> Report for a new consultation, and
 * Dashboard -> Report({ reportId }) to reopen a saved one.
 */
const RootNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.primaryBackground },
        animation: 'fade_from_bottom',
        animationDuration: 250,
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Recording" component={RecordingScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
