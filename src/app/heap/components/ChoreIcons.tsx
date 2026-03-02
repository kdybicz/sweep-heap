import type { ChoreStateInput, ChoreType } from "@/lib/chore-ui-state";
import { getChoreVisualState } from "@/lib/chore-ui-state";

export const TypeIcon = ({ type, className }: { type: ChoreType; className?: string }) => {
  if (type === "stay_open") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 7h9m0 0-2.5-2.5M13 7l-2.5 2.5M16 13H7m0 0 2.5-2.5M7 13l2.5 2.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m6.5 10 2.2 2.2 4.8-4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
};

export const StateIcon = ({ chore, className }: { chore: ChoreStateInput; className?: string }) => {
  const state = getChoreVisualState(chore);
  if (state === "completed") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m6.5 10 2.2 2.2 4.8-4.8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (state === "logged") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="10" cy="10" fill="currentColor" r="2.2" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
      {state === "closed" ? (
        <path
          d="m7.3 7.3 5.4 5.4m0-5.4-5.4 5.4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ) : null}
    </svg>
  );
};
