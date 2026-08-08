import { Image } from 'react-native';

const IPCLogo = ({ size = 44, style }) => {
  const width = Math.round(size * (103 / 199));

  return (
    <Image
      source={require('../assets/ipc_logo.png')}
      style={[{ width, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="IPC Logo"
    />
  );
};

export default IPCLogo;
