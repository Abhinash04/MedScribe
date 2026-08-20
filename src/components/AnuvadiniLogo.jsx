import { Image } from 'react-native';

const AnuvadiniLogo = ({ width = 160, style }) => {
  const height = Math.round(width * (317 / 786));

  return (
    <Image
      source={require('../assets/Anuvadini_Full_Logo.png')}
      style={[{ width, height }, style]}
      resizeMode="contain"
      accessibilityLabel="Anuvadini"
    />
  );
};

export default AnuvadiniLogo;
