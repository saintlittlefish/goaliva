import React from 'react';
import { StyleSheet, View } from 'react-native';

// Native Views keep gradients working in the existing Android/iOS builds without
// adding a native dependency that would require users to reinstall a dev client.
export const ThemeGradient = React.memo(function ThemeGradient({ colors }: { colors: readonly [string, string] }) {
  const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const first = rgb(colors[0]), last = rgb(colors[1]);
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
    {Array.from({ length: 64 }, (_, index) => <View key={index} style={{ flex: 1, backgroundColor: `rgb(${first.map((value, channel) => Math.round(value + (last[channel] - value) * index / 63)).join(',')})` }} />)}
  </View>;
});
