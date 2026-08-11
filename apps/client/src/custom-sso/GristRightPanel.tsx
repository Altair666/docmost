import { useMemo } from "react";
import { Box, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconInfoCircle, IconMessage } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { getSuggestionItems } from "@/features/editor/components/slash-menu/menu-items";
import type { SlashMenuItemType } from "@/features/editor/components/slash-menu/types";
import {
  pageEditorAtom,
  currentPageEditModeAtom,
} from "@/features/editor/atoms/editor-atoms";
import { PageEditMode } from "@/features/user/types/user.types";
import { rightPanelOpenAtom } from "@/custom-sso/right-panel-atom";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import Aside from "@/components/layouts/global/aside";
import useToggleAside from "@/hooks/use-toggle-aside";
import PageDetailsBlock from "@/custom-sso/PageDetailsBlock";

// Команды меню «/» списком. Корпоративные выброшены: requiresBases —
// это Bases, без лицензии они не работают.
function useCommands(): SlashMenuItemType[] {
  return useMemo(() => {
    const groups = getSuggestionItems({ query: "" });
    return Object.values(groups)
      .flat()
      .filter((item) => !item.requiresBases);
  }, []);
}

export default function GristRightPanel() {
  const { t } = useTranslation();
  const [open] = useAtom(rightPanelOpenAtom);
  // Вкладки Docmost — подробности, комментарии, оглавление — вызываются
  // кнопками страницы. Пока вкладка вызвана, панель показывает её.
  const [{ isAsideOpen }, setAsideState] = useAtom(asideStateAtom);
  const [, setOpen] = useAtom(rightPanelOpenAtom);
  const toggleAside = useToggleAside();

  // Вкладки на полосе. «Оглавление» убрано — оно не нужно.
  const tabs = [
    { key: "comments", icon: IconMessage, label: t("Comments") },
    { key: "details", icon: IconInfoCircle, label: t("Details") },
  ];
  const editor = useAtomValue(pageEditorAtom);
  const editMode = useAtomValue(currentPageEditModeAtom);
  const commands = useCommands();

  // Команды доступны только в режиме правки: в чтении вставлять некуда
  const canInsert = editMode === PageEditMode.Edit && Boolean(editor);

  // Вставка в место курсора: пустой промежуток — это и есть каретка
  const runAt = (item: SlashMenuItemType, pos?: number) => {
    if (!canInsert || !editor) return;
    const at = pos ?? editor.state.selection.from;
    editor.chain().focus().run();
    item.command({ editor, range: { from: at, to: at } });
  };

  // Перетаскивание: позицию под курсором берём так же, как перенос
  // блоков внутри редактора (drag-handle.ts, view.posAtCoords)
  const onDragEnd = (item: SlashMenuItemType, e: React.DragEvent) => {
    if (!canInsert || !editor) return;
    const coords = editor.view.posAtCoords({
      left: e.clientX,
      top: e.clientY,
    });
    if (!coords) return;
    runAt(item, coords.pos);
  };

  return (
    <Box data-grist-right-panel="" data-open={open || undefined}>
      {/* Полоса сверху той же высоты, что шапка левой панели: строки
          начинаются под чертой шапки, а не поверх неё. */}
      <div data-right-panel-head="" />

      {/* Свёрнутая полоса: вкладки, а под ними все команды в два
          столбца — щелчок вставляет ту же команду, что и в списке. */}
      <div data-right-rail="">
        <div data-rail-tabs="">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip
                key={item.key}
                label={item.label}
                position="left"
                withArrow
              >
                <UnstyledButton
                  data-rail-item=""
                  aria-label={item.label}
                  onClick={() => toggleAside(item.key as any)}
                >
                  <Icon size={18} stroke={2} />
                </UnstyledButton>
              </Tooltip>
            );
          })}
        </div>

        <div data-rail-commands="" data-disabled={!canInsert || undefined}>
          {commands.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip
                key={item.title}
                label={t(item.title)}
                position="left"
                withArrow
              >
                <UnstyledButton
                  data-rail-item=""
                  aria-label={t(item.title)}
                  draggable={canInsert}
                  disabled={!canInsert}
                  onClick={() => runAt(item)}
                  onDragEnd={(e) => onDragEnd(item, e)}
                >
                  {Icon && <Icon size={16} stroke={2} />}
                </UnstyledButton>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {isAsideOpen && (
        <div data-right-panel-body="">
          <Aside />
        </div>
      )}

      {open && !isAsideOpen && (
        <div data-right-panel-body="">
          <Text data-right-panel-title="">{t("Commands")}</Text>

          <div data-right-panel-commands="" data-disabled={!canInsert || undefined}>
            {commands.map((item) => {
              const Icon = item.icon;
              return (
                <UnstyledButton
                  key={item.title}
                  data-command=""
                  draggable={canInsert}
                  disabled={!canInsert}
                  onClick={() => runAt(item)}
                  onDragEnd={(e) => onDragEnd(item, e)}
                  title={t(item.description)}
                >
                  {Icon && <Icon size={16} stroke={2} />}
                  <span>{t(item.title)}</span>
                </UnstyledButton>
              );
            })}
          </div>

          {/* Подробности — под командами, как просили */}
          <div data-right-panel-details="">
            <Text data-right-panel-title="">{t("Details")}</Text>
            <PageDetailsBlock />
          </div>
        </div>
      )}
    </Box>
  );
}
