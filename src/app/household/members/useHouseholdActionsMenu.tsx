"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ActionsMenuPosition = {
  left: number;
  top: number;
};

export const useHouseholdActionsMenu = () => {
  const actionsMenuButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const [openActionsMenuId, setOpenActionsMenuId] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<ActionsMenuPosition | null>(null);

  const closeActionsMenu = useCallback(() => {
    setOpenActionsMenuId(null);
    setActionsMenuPosition(null);
  }, []);

  const updateActionsMenuPosition = useCallback((menuId: string) => {
    const button = actionsMenuButtonsRef.current.get(menuId);
    if (!button) {
      setActionsMenuPosition(null);
      return;
    }

    const rect = button.getBoundingClientRect();
    setActionsMenuPosition({
      left: rect.right,
      top: rect.bottom + 8,
    });
  }, []);

  const setActionsMenuButtonRef = useCallback(
    (menuId: string) => (node: HTMLButtonElement | null) => {
      if (node) {
        actionsMenuButtonsRef.current.set(menuId, node);
        return;
      }

      actionsMenuButtonsRef.current.delete(menuId);
    },
    [],
  );

  const toggleActionsMenu = useCallback(
    (menuId: string) => {
      setOpenActionsMenuId((currentMenuId) => {
        if (currentMenuId === menuId) {
          setActionsMenuPosition(null);
          return null;
        }

        updateActionsMenuPosition(menuId);
        return menuId;
      });
    },
    [updateActionsMenuPosition],
  );

  useEffect(() => {
    if (!openActionsMenuId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest(`[data-actions-menu-root="${openActionsMenuId}"]`) ||
        target.closest(`[data-actions-menu-panel="${openActionsMenuId}"]`)
      ) {
        return;
      }

      closeActionsMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeActionsMenu();
      }
    };

    const handleViewportChange = () => {
      updateActionsMenuPosition(openActionsMenuId);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [closeActionsMenu, openActionsMenuId, updateActionsMenuPosition]);

  const renderActionsMenu = useCallback(
    (menuId: string, className: string, content: ReactNode) => {
      if (openActionsMenuId !== menuId || !actionsMenuPosition || typeof document === "undefined") {
        return null;
      }

      return createPortal(
        <div
          className={`fixed z-30 -translate-x-full ${className}`}
          data-actions-menu-panel={menuId}
          style={{ left: actionsMenuPosition.left, top: actionsMenuPosition.top }}
        >
          {content}
        </div>,
        document.body,
      );
    },
    [actionsMenuPosition, openActionsMenuId],
  );

  return {
    closeActionsMenu,
    openActionsMenuId,
    renderActionsMenu,
    setActionsMenuButtonRef,
    toggleActionsMenu,
  };
};
