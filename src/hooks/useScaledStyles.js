import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { scaleFor } from '../theme/scale';

export default function useScaledStyles(factory) {
  const { width } = useWindowDimensions();
  return useMemo(() => factory(scaleFor(width)), [factory, width]);
}
