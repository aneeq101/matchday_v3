import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: any;
}

export default function RadiusSlider({
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  minimumTrackTintColor = '#16a34a',
  maximumTrackTintColor = '#e5e7eb',
  thumbTintColor = '#16a34a',
  style,
}: Props) {
  const pct = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;
  return (
    <View style={[styles.wrapper, style]}>
      {React.createElement('input', {
        type: 'range',
        min: String(minimumValue),
        max: String(maximumValue),
        step: String(step),
        value: String(value),
        onChange: (e: any) => onValueChange(Number(e.target.value)),
        style: {
          width: '100%',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          appearance: 'none',
          height: '4px',
          outline: 'none',
          border: 'none',
          background: `linear-gradient(to right, ${minimumTrackTintColor} 0%, ${minimumTrackTintColor} ${pct}%, ${maximumTrackTintColor} ${pct}%, ${maximumTrackTintColor} 100%)`,
          borderRadius: '2px',
          cursor: 'pointer',
          accentColor: thumbTintColor,
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingVertical: 6 },
});
