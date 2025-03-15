// components/ui/ThemedText.tsx
import { Text, TextProps, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';
import Colors from '../../constants/Colors';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'subtitle' | 'body' | 'caption' | 'link';
};

export function ThemedText({ 
  style, 
  lightColor, 
  darkColor, 
  type = 'default', 
  ...otherProps 
}: ThemedTextProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const color = lightColor 
    ? lightColor
    : darkColor 
      ? darkColor
      : Colors[colorScheme].text;

  return (
    <Text
      style={[
        { color },
        styles[type],
        style,
      ]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
});