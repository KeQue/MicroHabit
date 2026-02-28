import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  days: boolean[];
  onToggle: (dayIndex: number) => void;
  todayIndex?: number;

  accentActive: string;
  minActiveIndex?: number;

  colorLight?: string;
  colorDark?: string;
  compact?: boolean;
};

const NUM_COLS = 13;
const SQUARE = 26;
const COMPACT_SQUARE = 24;
const COLUMN_GAP = 7;
const ROW_GAP = 9;
const RADIUS = 10;
const TODAY_BORDER = 2;

const INACTIVE_BG = "#272634";
const INACTIVE_TEXT = "rgba(237,231,255,0.52)";

const LOCKED_BG = "#171420";
const LOCKED_TEXT = "rgba(237,231,255,0.22)";

const FUTURE_BG = "#100D17";
const FUTURE_TEXT = "rgba(237,231,255,0.22)";

const CONFETTI_PIECES = [
  { dx: -26, dy: -24, rotate: "-24deg", size: 5, color: "#FFD666" },
  { dx: -18, dy: -30, rotate: "18deg", size: 4, color: "#FFFFFF" },
  { dx: -10, dy: -34, rotate: "-12deg", size: 4, color: "#7CFFB2" },
  { dx: 0, dy: -36, rotate: "0deg", size: 5, color: "#8B5CFF" },
  { dx: 10, dy: -34, rotate: "14deg", size: 4, color: "#FF8AC6" },
  { dx: 18, dy: -30, rotate: "-16deg", size: 4, color: "#6FB4FF" },
  { dx: 26, dy: -24, rotate: "22deg", size: 5, color: "#FFD666" },
  { dx: -22, dy: -14, rotate: "34deg", size: 3, color: "#FFFFFF" },
  { dx: 22, dy: -14, rotate: "-34deg", size: 3, color: "#FFFFFF" },
];

type DayVisual = {
  bg: string;
  text: string;
  fontWeight: "600" | "700";
  doneDepth: boolean;
  isFuture: boolean;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function safeHexToRgb01(hex?: string) {
  if (!hex || typeof hex !== "string") return null;
  const h = hex.trim().replace("#", "");
  if (h.length !== 6) return null;

  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function rgb01ToHex(r: number, g: number, b: number) {
  const rr = Math.round(clamp01(r) * 255).toString(16).padStart(2, "0");
  const gg = Math.round(clamp01(g) * 255).toString(16).padStart(2, "0");
  const bb = Math.round(clamp01(b) * 255).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (0 <= h && h < 60) [r1, g1, b1] = [c, x, 0];
  else if (60 <= h && h < 120) [r1, g1, b1] = [x, c, 0];
  else if (120 <= h && h < 180) [r1, g1, b1] = [0, c, x];
  else if (180 <= h && h < 240) [r1, g1, b1] = [0, x, c];
  else if (240 <= h && h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return { r: r1 + m, g: g1 + m, b: b1 + m };
}

function boostActiveColor(hex?: string) {
  const rgb = safeHexToRgb01(hex);
  if (!rgb) return hex ?? "#00C853";

  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const s2 = clamp01(s * 1.5);
  const l2 = clamp01(l + 0.06);

  const out = hslToRgb(h, s2, l2);
  return rgb01ToHex(out.r, out.g, out.b);
}

function liftColor(hex?: string, amount = 0.18) {
  const rgb = safeHexToRgb01(hex);
  if (!rgb) return hex ?? "#FFFFFF";

  const r = rgb.r + (1 - rgb.r) * amount;
  const g = rgb.g + (1 - rgb.g) * amount;
  const b = rgb.b + (1 - rgb.b) * amount;
  return rgb01ToHex(r, g, b);
}

export function UserDayGrid({
  days,
  onToggle,
  todayIndex,
  accentActive,
  minActiveIndex,
  compact = false,
}: Props) {
  const [burstState, setBurstState] = useState<{ seed: number; dayIndex: number | null }>({
    seed: 0,
    dayIndex: null,
  });
  const tileScale = useRef(days.map(() => new Animated.Value(1))).current;
  const burstAnim = useRef(new Animated.Value(0)).current;

  const isTodayStreak = useMemo(() => {
    if (todayIndex === undefined) return false;
    if (todayIndex <= 0) return false;
    return Boolean(days[todayIndex]) && Boolean(days[todayIndex - 1]);
  }, [days, todayIndex]);

  const activeBg = boostActiveColor(accentActive);
  const activeBgSoft = liftColor(activeBg, 0.2);
  const tileSize = compact ? COMPACT_SQUARE : SQUARE;
  const tileRadius = compact ? 9 : RADIUS;
  const gridWidth = NUM_COLS * tileSize + (NUM_COLS - 1) * COLUMN_GAP;
  const streakDotSize = compact ? 3 : 4;

  const triggerTilePop = (dayIndex: number) => {
    const scale = tileScale[dayIndex];
    if (!scale) return;
    scale.stopAnimation();
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const triggerBurst = (dayIndex: number) => {
    burstAnim.stopAnimation();
    burstAnim.setValue(0);
    setBurstState((prev) => ({ seed: prev.seed + 1, dayIndex }));
    Animated.timing(burstAnim, {
      toValue: 1,
      duration: 820,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const resolveVisual = (dayIndex: number, isDone: boolean): DayVisual => {
    const locked = minActiveIndex !== undefined && dayIndex < minActiveIndex;

    if (todayIndex === undefined) {
      return {
        bg: isDone ? activeBg : locked ? LOCKED_BG : INACTIVE_BG,
        text: isDone ? "#FFFFFF" : locked ? LOCKED_TEXT : INACTIVE_TEXT,
        fontWeight: isDone ? "700" : "600",
        doneDepth: isDone,
        isFuture: false,
      };
    }

    if (dayIndex > todayIndex) {
      return {
        bg: FUTURE_BG,
        text: FUTURE_TEXT,
        fontWeight: "600",
        doneDepth: false,
        isFuture: true,
      };
    }

    if (locked) {
      return {
        bg: LOCKED_BG,
        text: LOCKED_TEXT,
        fontWeight: "600",
        doneDepth: false,
        isFuture: false,
      };
    }

    if (isDone) {
      return {
        bg: activeBg,
        text: "#FFFFFF",
        fontWeight: "700",
        doneDepth: true,
        isFuture: false,
      };
    }

    return {
      bg: INACTIVE_BG,
      text: INACTIVE_TEXT,
      fontWeight: "600",
      doneDepth: false,
      isFuture: false,
    };
  };

  const burstOpacity = burstAnim.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <View style={[styles.grid, { maxWidth: gridWidth }]}>
      {days.map((isDone, dayIndex) => {
        const isToday = todayIndex === dayIndex;
        const visual = resolveVisual(dayIndex, isDone);
        const isFuture = todayIndex !== undefined && dayIndex > todayIndex;
        const isLocked = minActiveIndex !== undefined && dayIndex < minActiveIndex;

        const handlePress =
          isFuture || isLocked
            ? undefined
            : async () => {
                triggerTilePop(dayIndex);
                const allowBurst =
                  typeof todayIndex === "number" &&
                  (dayIndex === todayIndex || dayIndex === todayIndex - 1);
                if (!isDone && allowBurst) {
                  triggerBurst(dayIndex);
                }
                if (isToday && !isDone) {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                onToggle(dayIndex);
              };

        return (
          <Pressable
            key={dayIndex}
            onPress={handlePress}
            hitSlop={0}
            style={({ pressed }) => [
              styles.pressable,
              { width: tileSize, height: tileSize },
              pressed && !isToday && !isFuture && !isLocked && { opacity: 0.92 },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: tileScale[dayIndex] ?? 1 }] }}>
              {visual.doneDepth ? (
                <LinearGradient
                  colors={[activeBgSoft, activeBg]}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.tile,
                    styles.doneDepth,
                    {
                      width: tileSize,
                      height: tileSize,
                      borderRadius: isToday ? tileSize / 2 : tileRadius,
                    },
                    isToday && styles.todayTile,
                  ]}
                >
                  <View style={styles.doneHighlight} />
                  {isToday && isTodayStreak ? (
                    <View
                      style={[
                        styles.streakDot,
                        { width: streakDotSize, height: streakDotSize, borderRadius: streakDotSize / 2 },
                      ]}
                    />
                  ) : null}

                  <Text style={[styles.dayNumber, { color: visual.text, fontWeight: visual.fontWeight }]}>
                    {dayIndex + 1}
                  </Text>
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.tile,
                    {
                      width: tileSize,
                      height: tileSize,
                      borderRadius: isToday ? tileSize / 2 : tileRadius,
                      backgroundColor: visual.bg,
                    },
                    isToday && styles.todayTile,
                  ]}
                >
                  {isToday && isTodayStreak ? (
                    <View
                      style={[
                        styles.streakDot,
                        { width: streakDotSize, height: streakDotSize, borderRadius: streakDotSize / 2 },
                      ]}
                    />
                  ) : null}

                  <Text style={[styles.dayNumber, { color: visual.text, fontWeight: visual.fontWeight }]}>
                    {dayIndex + 1}
                  </Text>
                </View>
              )}
            </Animated.View>

            {burstState.dayIndex === dayIndex && burstState.seed > 0 ? (
              <View pointerEvents="none" style={[styles.burstLayer, { width: tileSize, height: tileSize }]}>
                {CONFETTI_PIECES.map((piece, index) => {
                  const progress = burstAnim;
                  const driftX = progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, piece.dx],
                  });
                  const driftY = progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, piece.dy],
                  });
                  const scale = progress.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0.35, 1, 0.7],
                  });
                  const spin = progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", piece.rotate],
                  });

                  return (
                    <Animated.View
                      key={`${burstState.seed}-${index}`}
                      style={[
                        styles.confettiPiece,
                        {
                          width: piece.size,
                          height: piece.size * 2.2,
                          backgroundColor: piece.color,
                          opacity: burstOpacity,
                          transform: [
                            { translateX: driftX },
                            { translateY: driftY },
                            { scale },
                            { rotate: spin },
                          ],
                        },
                      ]}
                    />
                  );
                })}
                <Animated.View
                  style={[
                    styles.burstGlow,
                    {
                      opacity: burstAnim.interpolate({
                        inputRange: [0, 0.2, 1],
                        outputRange: [0, 0.28, 0],
                      }),
                      transform: [
                        {
                          scale: burstAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 2.1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: COLUMN_GAP,
    rowGap: ROW_GAP,
  },

  pressable: {
    position: "relative",
  },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: INACTIVE_BG,
  },
  doneDepth: {
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0,0,0,0.9)",
        shadowOpacity: 0.35,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },

  todayTile: {
    borderWidth: TODAY_BORDER,
    borderColor: "rgba(255,255,255,0.85)",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(255,255,255,0.22)",
        shadowOpacity: 1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },

  burstLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  confettiPiece: {
    position: "absolute",
    borderRadius: 2,
  },
  burstGlow: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  dayNumber: {
    fontSize: 10,
    zIndex: 2,
  },

  doneHighlight: {
    position: "absolute",
    top: 2,
    left: 2,
    right: "42%",
    bottom: "48%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    zIndex: 1,
  },

  streakDot: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.75)",
    zIndex: 2,
  },
});
