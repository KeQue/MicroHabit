import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  days: boolean[];              // length = number of days in month
  colorLight: string;           // pastel inactive color
  colorDark: string;            // completed color
  onToggle: (dayIndex: number) => void;
  todayIndex?: number;          // 0-based (e.g. day 14 => 13)
};

const NUM_COLS = 13;
const SQUARE = 28;
const GAP = 6;
const RADIUS = 6;

// Today highlight band thickness
const TODAY_BAND = 3;

// Constant outer box size for ALL tiles (prevents alignment shift)
const OUTER = SQUARE + TODAY_BAND * 2;

// Visual hierarchy: dim future days
const FUTURE_OPACITY = 0.72;

// Halo strength (tweak here)
const IOS_HALO_OPACITY = 0.6;
const IOS_HALO_RADIUS = 7;
const ANDROID_ELEVATION = 4;

export function UserDayGrid({
  days,
  colorLight,
  colorDark,
  onToggle,
  todayIndex,
}: Props) {
  // Minimal "streak" signal: today done AND yesterday done
  const isTodayStreak = useMemo(() => {
    if (todayIndex === undefined) return false;
    if (todayIndex <= 0) return false;
    return Boolean(days[todayIndex]) && Boolean(days[todayIndex - 1]);
  }, [days, todayIndex]);

  return (
    <View style={styles.grid}>
      {days.map((isDone, dayIndex) => {
        const isToday = todayIndex === dayIndex;
        const isFuture =
          todayIndex !== undefined && dayIndex > todayIndex;

        return (
          <Pressable
            key={dayIndex}
            onPress={() => onToggle(dayIndex)}
            hitSlop={6}
            style={styles.pressable}
          >
            {/* constant-size outer wrapper (alignment-safe) */}
            <View
              style={[
                styles.outerWrapper,
                isToday && styles.todayOuterWrapper,
              ]}
            >
              {/* white band layer (space) */}
              <View
                style={[
                  styles.bandLayer,
                  isToday && styles.bandLayerToday,
                ]}
              >
                {/* colored tile */}
                <View
                  style={[
                    styles.tile,
                    {
                      backgroundColor: isDone ? colorDark : colorLight,
                      opacity: isFuture ? FUTURE_OPACITY : 1,
                    },
                  ]}
                >
                  {/* Subtle "pressed" depth for completed days (no color change needed) */}
                  {isDone && <View style={styles.doneOverlay} />}

                  {/* tiny streak dot (only for today when streak is active) */}
                  {isToday && isTodayStreak && (
                    <View style={styles.streakDot} />
                  )}

                  <Text style={styles.dayNumber}>
                    {dayIndex + 1}
                  </Text>
                </View>
              </View>
            </View>
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
    gap: GAP,
    maxWidth: NUM_COLS * (OUTER + GAP),
  },

  pressable: {},

  outerWrapper: {
    width: OUTER,
    height: OUTER,
    alignItems: "center",
    justifyContent: "center",
  },

  // halo only around today
  todayOuterWrapper: {
    ...Platform.select({
      ios: {
        shadowColor: "#FFFFFF",
        shadowOpacity: IOS_HALO_OPACITY,
        shadowRadius: IOS_HALO_RADIUS,
        shadowOffset: { width: 0, height: 0 },
      },
      android: {
        elevation: ANDROID_ELEVATION,
      },
      default: {},
    }),
  },

  bandLayer: {
    width: OUTER,
    height: OUTER,
    borderRadius: RADIUS + TODAY_BAND,
    alignItems: "center",
    justifyContent: "center",
    padding: TODAY_BAND,          // reserve band space for all tiles
    backgroundColor: "transparent",
  },

  bandLayerToday: {
    backgroundColor: "#FFFFFF",
  },

  tile: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",           // makes overlays clean with rounded corners
  },

  dayNumber: {
    fontSize: 11,
    fontWeight: "600",
    color: "#111",
    zIndex: 2,
  },

  // Very subtle overlay to make done tiles read slightly deeper/richer
  doneOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.08)",
    zIndex: 1,
  },

  // Minimal streak signal (tiny dot)
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
