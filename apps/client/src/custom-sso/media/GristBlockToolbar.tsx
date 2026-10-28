import { ReactNode } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignRight,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import menu from "@/features/editor/components/common/toolbar-menu.module.css";
import { BlockAlign } from "./block-align";
import classes from "./media.module.css";

export interface BlockToolbarAction {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}

interface Props {
  align?: string | null;
  onAlign: (align: BlockAlign) => void;
  actions: BlockToolbarAction[];
}

const ALIGNS: { value: BlockAlign; label: string; icon: ReactNode }[] = [
  { value: "left", label: "Align left", icon: <IconLayoutAlignLeft size={18} /> },
  { value: "center", label: "Align center", icon: <IconLayoutAlignCenter size={18} /> },
  { value: "right", label: "Align right", icon: <IconLayoutAlignRight size={18} /> },
];

/**
 * Плашка над блоком-рамкой (PDF, HTML) — та же, что у картинки:
 * выравнивание, разделитель, действия. У картинки это всплывающее меню
 * по выделению, но рамку кликом не выделить — клик уходит внутрь
 * документа. Поэтому плашка появляется по наведению, над блоком.
 *
 * Показывается только в правке; родитель должен нести класс
 * grist-block-host (см. media.module.css).
 */
export function GristBlockToolbar({ align, onAlign, actions }: Props) {
  const { t } = useTranslation();
  const current = align || "center";

  return (
    <div className={clsx(menu.toolbar, classes.blockToolbar)} contentEditable={false}>
      {ALIGNS.map((a) => (
        <Tooltip key={a.value} position="top" label={t(a.label)} withinPortal={false}>
          <ActionIcon
            onClick={() => onAlign(a.value)}
            size="lg"
            variant="subtle"
            aria-label={t(a.label)}
            className={clsx({ [menu.active]: current === a.value })}
          >
            {a.icon}
          </ActionIcon>
        </Tooltip>
      ))}

      {actions.length > 0 && <div className={menu.divider} />}

      {actions.map((a) => (
        <Tooltip key={a.label} position="top" label={a.label} withinPortal={false}>
          {a.href ? (
            <ActionIcon
              component="a"
              href={a.href}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              variant="subtle"
              aria-label={a.label}
            >
              {a.icon}
            </ActionIcon>
          ) : (
            <ActionIcon
              onClick={a.onClick}
              size="lg"
              variant="subtle"
              aria-label={a.label}
              disabled={a.disabled}
            >
              {a.icon}
            </ActionIcon>
          )}
        </Tooltip>
      ))}
    </div>
  );
}
