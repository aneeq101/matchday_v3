import React from 'react';

interface RadiusSliderProps {
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

declare const RadiusSlider: React.ComponentType<RadiusSliderProps>;
export default RadiusSlider;
