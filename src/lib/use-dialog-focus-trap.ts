"use client";

import { type RefObject, useEffect, useRef } from "react";

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

const DIALOG_FOCUS_TRAP_STACK_KEY = "__sweep_heap_dialog_focus_trap_stack__";

type FocusTrapStackEntry = {
  id: symbol;
  dialog: HTMLElement;
};

const globalForDialogFocusTrap = globalThis as typeof globalThis & {
  [DIALOG_FOCUS_TRAP_STACK_KEY]?: FocusTrapStackEntry[];
};

const getFocusTrapStack = () => {
  if (!globalForDialogFocusTrap[DIALOG_FOCUS_TRAP_STACK_KEY]) {
    globalForDialogFocusTrap[DIALOG_FOCUS_TRAP_STACK_KEY] = [];
  }

  return globalForDialogFocusTrap[DIALOG_FOCUS_TRAP_STACK_KEY];
};

const isElementVisible = (element: HTMLElement) => {
  const styles = window.getComputedStyle(element);
  if (styles.display === "none" || styles.visibility === "hidden") {
    return false;
  }

  return element.getClientRects().length > 0;
};

const isElementFocusable = (element: HTMLElement) => {
  if (element.hasAttribute("inert")) {
    return false;
  }

  return isElementVisible(element);
};

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(isElementFocusable);

const focusInitialDialogElement = (dialog: HTMLElement) => {
  const preferredFocusTarget = dialog.querySelector<HTMLElement>(
    "[data-dialog-initial-focus='true']",
  );
  if (preferredFocusTarget && isElementFocusable(preferredFocusTarget)) {
    preferredFocusTarget.focus();
    return;
  }

  const focusableElements = getFocusableElements(dialog);
  (focusableElements[0] ?? dialog).focus();
};

export const useDialogFocusTrap = ({
  active,
  dialogRef,
  onEscape,
}: {
  active: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
}) => {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const trapId = Symbol("dialog-focus-trap");
    const focusTrapStack = getFocusTrapStack();
    focusTrapStack.push({
      id: trapId,
      dialog,
    });

    const previousFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    focusInitialDialogElement(dialog);

    const handleKeyDown = (event: KeyboardEvent) => {
      const stack = getFocusTrapStack();
      const activeTrap = stack[stack.length - 1];
      if (!activeTrap || activeTrap.id !== trapId) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }

      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const nextFocusableElements = getFocusableElements(dialog);
      if (!nextFocusableElements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = nextFocusableElements[0];
      const last = nextFocusableElements[nextFocusableElements.length - 1];
      const activeElement = document.activeElement;
      const isFocusOutsideDialog = !activeElement || !dialog.contains(activeElement);

      if (event.shiftKey) {
        if (isFocusOutsideDialog || activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (isFocusOutsideDialog || activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);

      const stack = getFocusTrapStack();
      const trapIndex = stack.findIndex((entry) => entry.id === trapId);
      if (trapIndex >= 0) {
        stack.splice(trapIndex, 1);
      }

      if (previousFocused && document.contains(previousFocused)) {
        previousFocused.focus();
        return;
      }

      const parentTrap = stack[stack.length - 1];
      if (parentTrap?.dialog && document.contains(parentTrap.dialog)) {
        focusInitialDialogElement(parentTrap.dialog);
      }
    };
  }, [active, dialogRef]);
};
