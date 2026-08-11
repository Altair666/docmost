import { useMemo, useState } from "react";
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
import PageDetailsBlock from "@/custom-sso/PageDetailsBlock";
import CommentListWithTabs from "@/features/comment/components/comment-list-with-tabs";

// Интеграции — пункты, вставляющие внешнее встраивание. Список тот же,
// что в меню «/» зовёт setEmbed.
const EMBEDS = new Set([
  "Iframe embed",
  "Airtable",
  "Loom",
  "Figma",
  "Typeform",
  "Miro",
  "YouTube",
  "Vimeo",
  "Framer",
  "Google Drive",
  "Google Sheets",
]);

// Команды меню «/». Корпоративные выброшены: requiresBases — это Bases,
// без лицензии они не работают.
function useCommands() {
  return useMemo(() => {
    const all = Object.values(getSuggestionItems({ query: "" }))
      .flat()
      .filter((item: SlashMenuItemType) => !item.requiresBases);
    return {
      basic: all.filter((i: SlashMenuItemType) => !EMBEDS.has(i.title)),
      embeds: all.filter((i: SlashMenuItemType) => EMBEDS.has(i.title)),
      all,
    };
  }, []);
}

export default function GristRightPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(rightPanelOpenAtom);
  const editor = useAtomValue(pageEditorAtom);
  const editMode = useAtomValue(currentPageEditModeAtom);
  const commands = useCommands();

  const [tab, setTab] = useState<"commands" | "details" | "comments">(
    "commands",
  );
  const [group, setGroup] = useState<"basic" | "embeds">("basic");

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

  const openOn = (which: "details" | "comments") => {
    setTab(which);
    setOpen(true);
  };

  const shown = group === "basic" ? commands.basic : commands.embeds;

  return (
    <Box data-grist-right-panel="" data-open={open || undefined}>
      {/* Полоса сверху вровень с шапкой левой панели */}
      <div data-right-panel-head="" />

      {/* Свёрнутая полоса: сверху команды в два столбца, вкладки внизу */}
      <div data-right-rail="">
        <div data-rail-commands="" data-disabled={!canInsert || undefined}>
          {commands.all.map((item: SlashMenuItemType) => {
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

        {/* Вкладки — в самом низу полосы */}
        <div data-rail-tabs="">
          <Tooltip label={t("Comments")} position="left" withArrow>
            <UnstyledButton
              data-rail-item=""
              aria-label={t("Comments")}
              onClick={() => openOn("comments")}
            >
              <IconMessage size={18} stroke={2} />
            </UnstyledButton>
          </Tooltip>
          <Tooltip label={t("Details")} position="left" withArrow>
            <UnstyledButton
              data-rail-item=""
              aria-label={t("Details")}
              onClick={() => openOn("details")}
            >
              <IconInfoCircle size={18} stroke={2} />
            </UnstyledButton>
          </Tooltip>
        </div>
      </div>

      {open && (
        <div data-right-panel-body="">
          {/* Ярлычки вкладок */}
          <div data-panel-tabs="">
            {[
              { key: "commands", label: t("Commands") },
              { key: "details", label: t("Details") },
              { key: "comments", label: t("Comments") },
            ].map((item) => (
              <UnstyledButton
                key={item.key}
                data-panel-tab=""
                data-active={tab === item.key || undefined}
                onClick={() => setTab(item.key as any)}
              >
                {item.label}
              </UnstyledButton>
            ))}
          </div>

          {tab === "commands" && (
            <>
              {/* Подвкладки: основные и интеграции */}
              <div data-panel-subtabs="">
                {[
                  { key: "basic", label: t("Basic") },
                  { key: "embeds", label: t("Integrations") },
                ].map((item) => (
                  <UnstyledButton
                    key={item.key}
                    data-panel-subtab=""
                    data-active={group === item.key || undefined}
                    onClick={() => setGroup(item.key as any)}
                  >
                    {item.label}
                  </UnstyledButton>
                ))}
              </div>

              <div
                data-right-panel-commands=""
                data-disabled={!canInsert || undefined}
              >
                {shown.map((item: SlashMenuItemType) => {
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
            </>
          )}

          {tab === "details" && (
            <div data-panel-section="">
              <PageDetailsBlock />
            </div>
          )}

          {tab === "comments" && (
            <div data-panel-section="">
              <CommentListWithTabs />
            </div>
          )}
        </div>
      )}
    </Box>
  );
}
