import { AppRegistry } from 'react-native';
import App from './App';
import OverlayReviewScreen from './src/screens/OverlayReviewScreen';
import { startBubbleRuntime } from './src/services/dictationBubble';
import { name as appName } from './app.json';

const DICTATION_TASK = 'MedScribeDictation';
const REVIEW_COMPONENT = 'MedScribeReview';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent(REVIEW_COMPONENT, () => OverlayReviewScreen);

AppRegistry.registerHeadlessTask(
  DICTATION_TASK,
  () => async () => {
    startBubbleRuntime();
    await new Promise(() => {});
  },
);
