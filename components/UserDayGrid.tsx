import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  days: boolean[];
  onToggle: (dayIndex: number) => void;
  todayIndex?: number;

  // per-user active accent (square fill when done)
  accentActive: string;

  // still accepted if you want to keep API compatibility elsewhere
  colorLight?: string;
  colorDark?: string;
};

const NUM_COLS = 13;

// keep size as-is (do not change number font visuals)
const SQUARE = 28;

// spacing increase (requested)
const GAP = 8;

// slightly rounder (subtle)
const RADIUS = 7;

// Today highlight: white border only + glow
const TODAY_BORDER = 2;

// Past inactive
const INACTIVE_BG = "#2B2B33";
const INACTIVE_TEXT = "rgba(255,255,255,0.55)";

// Future
const FUTURE_BG = "#0B0B10";
const FUTURE_TEXT = "rgba(255,255,255,0.22)";

type DayVisual = {
  bg: string;
  text: string;
  fontWeight: "600" | "700";
  doneDepth: boolean;
  isFuture: boolean;
};

// --- safe helpers (never crash) ---
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

  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (0 <= h && h < 60) [r1, g1, b1] = [c, x, 0];
  else if (60 <= h && h < 120) [r1, g1, b1] = [x, c, 0];
  else if (120 <= h && h < 180) [r1, g1, b1] = [0, c, x];
  else if (180 <= h && h < 240) [r1, g1, b1] = [0, x, c];
  else if (240 <= h && h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return { r: r1 + m, g: g1 + m, b: b1 + m };
}

// Strong boost so accents "pop" on small tiles
function boostActiveColor(hex?: string) {
  const rgb = safeHexToRgb01(hex);
  if (!rgb) return hex ?? "#00C853";

  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const SAT_MULT = 1.5;
  const LIGHT_ADD = 0.06;

  const s2 = clamp01(s * SAT_MULT);
  const l2 = clamp01(l + LIGHT_ADD);

  const out = hslToRgb(h, s2, l2);
  return rgb01ToHex(out.r, out.g, out.b);
}

export function UserDayGrid({ days, onToggle, todayIndex, accentActive }: Props) {
  const isTodayStreak = useMemo(() => {
    if (todayIndex === undefined) return false;
    if (todayIndex <= 0) return false;
    return Boolean(days[todayIndex]) && Boolean(days[todayIndex - 1]);
  }, [days, todayIndex]);

  const activeBg = boostActiveColor(accentActive);

  const resolveVisual = (dayIndex: number, isDone: boolean): DayVisual => {
    if (todayIndex === undefined) {
      return {
        bg: isDone ? activeBg : INACTIVE_BG,
        text: isDone ? "#FFFFFF" : INACTIVE_TEXT,
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

  return (
    <View style={styles.grid}>
      {days.map((isDone, dayIndex) => {
        const isToday = todayIndex === dayIndex;
        const visual = resolveVisual(dayIndex, isDone);

        // ✅ UI reinforcement: future tiles are not tappable
        const isFuture = todayIndex !== undefined && dayIndex > todayIndex;

        return (
          <Pressable
            key={dayIndex}
            onPress={isFuture ? undefined : () => onToggle(dayIndex)}
            hitSlop={0}
            // polish: don't dim future days on press (they already look disabled-ish)
            style={({ pressed }) => [
              styles.pressable,
              pressed && !isToday && !isFuture && { opacity: 0.92 },
            ]}
          >
            <View
              style={[
                styles.tile,
                { backgroundColor: visual.bg },
                visual.doneDepth && styles.doneDepth,
                isToday && styles.todayTile,
              ]}
            >
              {isToday && isTodayStreak && <View style={styles.streakDot} />}

              <Text style={[styles.dayNumber, { color: visual.text, fontWeight: visual.fontWeight }]}>
                {dayIndex + 1}
              </Text>
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
    maxWidth: NUM_COLS * (SQUARE + GAP),
  },

  pressable: {
    width: SQUARE,
    height: SQUARE,
  },

  tile: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: INACTIVE_BG,
  },

  // subtle depth only for DONE tiles
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

  // Today: ONLY white border + soft glow (no fog / no extra layers)
  // polish: keep border crisp + consistent rounding
  todayTile: {
    borderWidth: TODAY_BORDER,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: RADIUS, // keep consistent rounding with border
    ...Platform.select({
      ios: {
        shadowColor: "rgba(255,255,255,0.25)",
        shadowOpacity: 1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },

  dayNumber: {
    fontSize: 11, // keep same
    zIndex: 2,
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
