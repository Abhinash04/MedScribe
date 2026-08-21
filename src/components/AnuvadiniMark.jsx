import { Image } from 'react-native';

const AnuvadiniMark = ({ size = 32, style }) => (
  <Image
    source={require('../assets/anuvadini-mark.png')}
    style={[{ width: size, height: size }, style]}
    resizeMode="contain"
    accessibilityLabel="Anuvadini"
  />
);

export default AnuvadiniMark;
