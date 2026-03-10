import { addDaysToDateKey, subtractDaysFromDateKey } from "@/app/household/board/date-utils";
import type { ChoreItem } from "@/app/household/board/types";
import type { EditChoreScope } from "@/app/household/board/useHouseholdChoreActions.types";
import type { ChoreType } from "@/lib/chore-ui-state";

export type ChoreFormMode = "create" | "edit_single" | "edit_following" | "edit_all";

export type ChoreFormValues = {
  title: string;
  type: ChoreType;
  date: string;
  endDate: string;
  repeat: string;
  repeatEnd: string;
  notes: string;
};

export const getChoreFormModalCopy = (formMode: ChoreFormMode) => {
  if (formMode === "create") {
    return {
      title: "Add a chore",
      description: "Quick details now, schedule tweaks later.",
      submitLabel: "Save chore",
    };
  }

  if (formMode === "edit_single") {
    return {
      title: "Edit only this chore",
      description: "Create a one-off version for this occurrence only.",
      submitLabel: "Save changes",
    };
  }

  if (formMode === "edit_following") {
    return {
      title: "Edit this and future chores",
      description: "Split the recurring series from this occurrence onward.",
      submitLabel: "Save changes",
    };
  }

  return {
    title: "Edit all chores",
    description: "Update the entire recurring series in place.",
    submitLabel: "Save changes",
  };
};

export const getChoreFormValuesFromChore = (
  chore: ChoreItem,
  scope: EditChoreScope,
): ChoreFormValues => {
  const startDate =
    scope === "all"
      ? (chore.series_start_date ?? chore.occurrence_start_date)
      : chore.occurrence_start_date;
  const durationDays = chore.duration_days ?? 1;

  return {
    title: chore.title,
    type: chore.type,
    date: startDate,
    endDate: subtractDaysFromDateKey(addDaysToDateKey(startDate, durationDays), 1),
    repeat: scope === "single" ? "none" : (chore.repeat_rule ?? "none"),
    repeatEnd: chore.series_end_date ?? startDate,
    notes: chore.notes ?? "",
  };
};

export const getChoreFormModeFromScope = (scope: EditChoreScope): ChoreFormMode => {
  if (scope === "single") {
    return "edit_single";
  }
  if (scope === "following") {
    return "edit_following";
  }
  return "edit_all";
};
