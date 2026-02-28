export type GentleNotificationKind =
  | "daily_reminder"
  | "social_nudge"
  | "light_encouragement";

const COPY: Record<GentleNotificationKind, readonly string[]> = {
  daily_reminder: [
    "Still time today.",
    "A quick check-in still counts.",
    "You can still fit something in today.",
  ],
  social_nudge: [
    "Others checked in already.",
    "The group has started moving today.",
    "A few people have already shown up today.",
  ],
  light_encouragement: [
    "Even a little counts \u{1F4AA}",
    "Something is better than nothing \u{1F4AA}",
    "Light session still counts \u{1F4AA}",
    "Quick session? \u{1F4AA}",
  ],
};

export function getGentleNotificationCopy(
  kind: GentleNotificationKind,
  index = 0
): string {
  const options = COPY[kind];
  return options[index % options.length];
}

export const gentleNotificationCopy = COPY;
