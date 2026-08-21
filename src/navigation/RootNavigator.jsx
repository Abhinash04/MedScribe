import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import RecordingScreen from '../screens/RecordingScreen';
import TranscriptReviewScreen from '../screens/TranscriptReviewScreen';
import ReportScreen from '../screens/ReportScreen';
import ReportsScreen from '../screens/ReportsScreen';
import PatientsScreen from '../screens/PatientsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OverlayOnboardingScreen from '../screens/OverlayOnboardingScreen';
import MicSpikeScreen from '../screens/MicSpikeScreen';
import SttBaselineScreen from '../screens/SttBaselineScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
const RootNavigator = ({ initialRouteName = 'Dashboard' }) => {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.primaryBackground },
        animation: 'fade_from_bottom',
        animationDuration: 250,
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen
        name="OverlayOnboarding"
        component={OverlayOnboardingScreen}
      />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Patients" component={PatientsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Recording" component={RecordingScreen} />
      <Stack.Screen name="TranscriptReview" component={TranscriptReviewScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      {__DEV__ ? (
        <Stack.Screen name="MicSpike" component={MicSpikeScreen} />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen name="SttMeasure" component={SttBaselineScreen} />
      ) : null}
    </Stack.Navigator>
  );
};

export default RootNavigator;
