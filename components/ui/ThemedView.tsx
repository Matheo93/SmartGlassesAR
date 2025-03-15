// components/ui/ThemedView.tsx
import { View, ViewProps } from 'react-native';
import { useColorScheme } from 'react-native';
import Colors from '../../constants/Colors';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const backgroundColor = lightColor
    ? lightColor
    : darkColor
      ? darkColor
      : Colors[colorScheme].background;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}