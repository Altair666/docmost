import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Group, Loader, Text, Tooltip } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCode, IconExternalLink, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { ResizableWrapper } from "@/features/editor/components/common/resizable-wrapper";
import { htmlEmbedSrc } from "./html-embed";
import classes from "./html-embed.module.css";

export default function HtmlEmbedView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, getPos, selected, updateAttributes } = props;
  const { attachmentId, name, placeholder, width, height } = node.attrs;
  const [failed, setFailed] = useState(false);

  // Признак правки держим живым: при переключении режима узел заново
  // не отрисовывается, и значение, взятое один раз, устаревает — в
  // чтении оставались кнопки правки.
  const [editable, setEditable] = useState(editor?.isEditable === true);
  useEffect(() => {
    if (!editor) return;
    const sync = () => setEditable(editor.isEditable);
    sync();
    editor.on("update", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("update", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  const src = useMemo(() => htmlEmbedSrc(attachmentId), [attachmentId]);

  const select = useCallback(() => {
    const pos = getPos();
    if (pos !== undefined) editor.commands.setNodeSelection(pos);
  }, [editor, getPos]);

  const resize = useCallback(
    (w: number, h: number) => updateAttributes({ width: w, height: h }),
    [updateAttributes],
  );

  const remove = useCallback(() => {
    const pos = getPos();
    if (pos === undefined) return;
    editor.commands.setNodeSelection(pos);
    editor.commands.deleteSelection();
  }, [editor, getPos]);

  // Пока файл летит на сервер
  if (!attachmentId) {
    return (
      <NodeViewWrapper data-drag-handle>
        <div
          className={clsx(classes.wrapper, placeholder && classes.skeleton)}
          style={{ height: placeholder ? 600 : undefined }}
        >
          {placeholder && (
            <Group justify="center" wrap="nowrap" gap="xs" maw="100%" px="md">
              <Loader size={20} style={{ flexShrink: 0 }} />
              <Text component="span" size="sm" truncate="end">
                {t("Uploading {{name}}", { name: placeholder.name })}
              </Text>
            </Group>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  if (failed) {
    return (
      <NodeViewWrapper data-drag-handle>
        <div
          className={clsx(classes.failed, {
            "ProseMirror-selectednode": selected,
          })}
          onClick={select}
          role="button"
          tabIndex={0}
        >
          <IconCode size={32} stroke={1.5} />
          <Text size="sm" c="dimmed">
            {t("Failed to load HTML")}
          </Text>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-drag-handle data-type="htmlEmbed">
      <div className={classes.container}>
        <ResizableWrapper
          initialWidth={width || 800}
          initialHeight={height || 600}
          minWidth={200}
          maxWidth={1200}
          minHeight={200}
          maxHeight={1200}
          onResize={resize}
          isEditable={editable}
          selected={selected}
          className={clsx(classes.resizeWrapper, {
            "ProseMirror-selectednode": selected,
          })}
        >
          <iframe
            className={classes.frame}
            src={src}
            title={name || "HTML"}
            loading="lazy"
            frameBorder="0"
            onError={() => setFailed(true)}
            /*
             * Песочница. Главное здесь — отсутствие allow-same-origin:
             * без него документ получает собственное происхождение и не
             * может ни читать куки вики, ни дёргать её API от имени
             * открывшего. Скрипты разрешены намеренно — сюда кладут
             * готовые отчёты, а они почти всегда со скриптами.
             *
             * Тот же набор ставит и сервер заголовком, на случай если
             * файл открыли прямой ссылкой, мимо этой рамки.
             */
            sandbox="allow-scripts allow-popups allow-forms allow-modals"
          />

          {editable && (
            <div className={classes.hoverMenu}>
              <Tooltip position="top" label={t("Open in new tab")} withinPortal>
                <ActionIcon
                  size="sm"
                  variant="filled"
                  color="dark"
                  component="a"
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("Open in new tab")}
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Delete")} withinPortal>
                <ActionIcon
                  size="sm"
                  variant="filled"
                  color="dark"
                  onClick={remove}
                  aria-label={t("Delete")}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </ResizableWrapper>
      </div>
    </NodeViewWrapper>
  );
}
