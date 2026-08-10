import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import RecordingScreen from '../screens/RecordingScreen';
import TranscriptReviewScreen from '../screens/TranscriptReviewScreen';
import ReportScreen from '../screens/ReportScreen';
import MicSpikeScreen from '../screens/MicSpikeScreen';
import SttBaselineScreen from '../screens/SttBaselineScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
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
