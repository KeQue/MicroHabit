import React from "react";
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

// Thickness of the white band around today
const TODAY_BAND = 3;

// IMPORTANT: outer box size is constant for ALL tiles to keep alignment perfect
const OUTER = SQUARE + TODAY_BAND * 2;

export function UserDayGrid({
  days,
  colorLight,
  colorDark,
  onToggle,
  todayIndex,
}: Props) {
  return (
    <View style={styles.grid}>
      {days.map((isDone, dayIndex) => {
        const isToday = todayIndex === dayIndex;

        return (
          <Pressable
            key={dayIndex}
            onPress={() => onToggle(dayIndex)}
            hitSlop={6}
            style={styles.pressable}
          >
            {/* constant-size outer wrapper (alignment fix) */}
            <View style={[styles.outerWrapper, isToday && styles.todayOuterWrapper]}>
              {/* white band only for today */}
              <View style={[styles.bandLayer, isToday && styles.bandLayerToday]}>
                {/* colored tile stays the same size always */}
                <View
                  style={[
                    styles.tile,
                    { backgroundColor: isDone ? colorDark : colorLight },
                  ]}
                >
                  <Text style={styles.dayNumber}>{dayIndex + 1}</Text>
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
    // use OUTER for width math because every tile now occupies OUTER
    maxWidth: NUM_COLS * (OUTER + GAP),
  },

  pressable: {
    // no sizing here
  },

  // Constant-size box for every tile (prevents "today" shifting the layout)
  outerWrapper: {
    width: OUTER,
    height: OUTER,
    alignItems: "center",
    justifyContent: "center",
  },

  // Stronger halo (still clean, no overlays)
  todayOuterWrapper: {
    ...Platform.select({
      ios: {
        shadowColor: "#FFFFFF",
        shadowOpacity: 0.6,     // stronger than before
        shadowRadius: 7,        // stronger blur
        shadowOffset: { width: 0, height: 0 },
      },
      android: {
        elevation: 4,           // stronger lift
      },
      default: {},
    }),
  },

  // Layer that creates the white band via padding
  bandLayer: {
    width: OUTER,
    height: OUTER,
    borderRadius: RADIUS + TODAY_BAND,
    alignItems: "center",
    justifyContent: "center",
    padding: TODAY_BAND,        // reserve band space even when transparent
    backgroundColor: "transparent",
  },

  bandLayerToday: {
    backgroundColor: "#FFFFFF",
  },

  // Inner colored tile (constant size)
  tile: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },

  dayNumber: {
    fontSize: 11,
    fontWeight: "600",
    color: "#111",
  },
});
