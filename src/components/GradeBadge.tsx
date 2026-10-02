import { Badge } from "@toss/tds-mobile";
import type { ComponentProps } from "react";

import type { Grade } from "../types";

type BadgeColor = ComponentProps<typeof Badge>["color"];

function gradeBadgeColor(grade: Grade): BadgeColor {
  if (grade === "SSS") return "yellow";
  if (grade === "S") return "blue";
  if (grade === "A") return "teal";
  if (grade === "B") return "yellow";
  return "elephant";
}

export function GradeBadge({ grade, size = "small" }: { grade: Grade; size?: "small" | "large" }) {
  const variant = grade === "SSS" || grade === "S" ? "fill" : "weak";
  return (
    <Badge size={size} color={gradeBadgeColor(grade)} variant={variant}>
      {grade}
    </Badge>
  );
}
