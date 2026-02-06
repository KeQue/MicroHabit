import React from "react";
import { View, type ViewProps } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

// Commito is dark UI → safe default background
const DEFAULT_BG_DARK = "#05010D";

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor ?? DEFAULT_BG_DARK, dark: darkColor ?? DEFAULT_BG_DARK },
    "background"
  );

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
