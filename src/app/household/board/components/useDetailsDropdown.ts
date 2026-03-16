"use client";

import { useEffect, useRef } from "react";

export const DETAILS_DROPDOWN_GROUP_ATTRIBUTE = "data-details-dropdown-group";

type FocusableLike = {
  focus: () => void;
};

type DetailsDropdownLike = {
  open: boolean;
  contains: (target: Node | null) => boolean;
  getAttribute: (name: string) => string | null;
  querySelector: (selector: string) => FocusableLike | null;
};

export const closeDetailsDropdown = (
  detailsElement: DetailsDropdownLike | null,
  { restoreFocus = false }: { restoreFocus?: boolean } = {},
) => {
  if (!detailsElement?.open) {
    return false;
  }

  detailsElement.open = false;

  if (restoreFocus) {
    detailsElement.querySelector("summary")?.focus();
  }

  return true;
};

export const closePeerDetailsDropdowns = (
  detailsElement: DetailsDropdownLike,
  groupedDetails: DetailsDropdownLike[],
) => {
  if (!detailsElement.open) {
    return;
  }

  const groupName = detailsElement.getAttribute(DETAILS_DROPDOWN_GROUP_ATTRIBUTE);
  if (!groupName) {
    return;
  }

  for (const candidate of groupedDetails) {
    if (candidate === detailsElement) {
      continue;
    }

    if (candidate.getAttribute(DETAILS_DROPDOWN_GROUP_ATTRIBUTE) !== groupName) {
      continue;
    }

    closeDetailsDropdown(candidate);
  }
};

const isTargetWithinDetails = (detailsElement: HTMLDetailsElement, target: EventTarget | null) =>
  target instanceof Node && detailsElement.contains(target);

export const useDetailsDropdown = () => {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const detailsElement = detailsRef.current;
    if (!detailsElement) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!detailsElement?.open) {
        return;
      }

      if (isTargetWithinDetails(detailsElement, event.target)) {
        return;
      }

      closeDetailsDropdown(detailsElement);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !detailsElement.open) {
        return;
      }

      closeDetailsDropdown(detailsElement, { restoreFocus: true });
    };

    const handleToggle = () => {
      if (!detailsElement.open) {
        return;
      }

      closePeerDetailsDropdowns(
        detailsElement,
        Array.from(
          document.querySelectorAll<HTMLDetailsElement>(
            `details[${DETAILS_DROPDOWN_GROUP_ATTRIBUTE}]`,
          ),
        ),
      );
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (!detailsElement.open) {
        return;
      }

      if (isTargetWithinDetails(detailsElement, event.relatedTarget)) {
        return;
      }

      closeDetailsDropdown(detailsElement);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    detailsElement.addEventListener("toggle", handleToggle);
    detailsElement.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      detailsElement.removeEventListener("toggle", handleToggle);
      detailsElement.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return detailsRef;
};
