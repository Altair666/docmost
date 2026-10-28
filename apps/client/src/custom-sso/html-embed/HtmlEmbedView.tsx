import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Loader, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowAutofitHeight,
  IconCode,
  IconExternalLink,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { ResizableWrapper } from "@/features/editor/components/common/resizable-wrapper";
import { useLiveEditable } from "@/custom-sso/media/use-live-editable";
import { alignToJustify } from "@/custom-sso/media/block-align";
import { GristBlockToolbar } from "@/custom-sso/media/GristBlockToolbar";
import { HTML_EMBED_HEIGHT_MSG, HTML_EMBED_MEASURE_MSG, htmlEmbedSrc } from "./html-embed";
import classes from "./html-embed.module.css";

// Пределы на случай, когда документ размеров не прислал. Когда прислал,
// нижняя граница — его содержимое (см. ниже). Было 200, как у PDF, и
// короткий документ оставлял под собой пустое поле, которое не убрать.
const MIN_HEIGHT = 40;
const MIN_WIDTH = 120;
const MAX_HEIGHT = 4000;
const MAX_WIDTH = 1200;
// Рамка у iframe — по пикселю с каждой стороны. Без поправки на неё
// появляется полоса прокрутки в пиксель.
const FRAME_BORDER = 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export default function HtmlEmbedView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, getPos, selected, updateAttributes } = props;
  const { attachmentId, name, placeholder, width, height, align } = node.attrs;
  const [failed, setFailed] = useState(false);
  const editable = useLiveEditable(editor);

  // Высота содержимого. Её присылает сам документ: сервер дописывает к
  // нему крошечный скрипт замера (см. html-embed.controller.ts). Снаружи
  // не померить — рамка в песочнице, и документ для нас чужой.
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [contentMinWidth, setContentMinWidth] = useState<number | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type !== HTML_EMBED_HEIGHT_MSG) return;
      const h = Number(e.data.height);
      if (Number.isFinite(h) && h > 0) setContentHeight(Math.ceil(h));
      const w = Number(e.data.minWidth);
      if (Number.isFinite(w) && w > 0) setContentMinWidth(Math.ceil(w));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Меньше содержимого рамку не сжать: иначе низ документа срезается,
  // а справа он уходит под край. Если содержимое выросло (скрипт
  // документа что-то дописал), блок подрастает сам — только на экране,
  // в документ это не пишется: в чтении править его нельзя.
  const minH = contentHeight
    ? clamp(contentHeight + FRAME_BORDER, MIN_HEIGHT, MAX_HEIGHT)
    : MIN_HEIGHT;
  const minW = contentMinWidth
    ? clamp(contentMinWidth + FRAME_BORDER, MIN_WIDTH, MAX_WIDTH)
    : MIN_WIDTH;
  const shownW = Math.max(width || 800, minW);
  const shownH = Math.max(height || 600, minH);

  const src = useMemo(() => htmlEmbedSrc(attachmentId), [attachmentId]);

  const select = useCallback(() => {
    const pos = getPos();
    if (pos !== undefined) editor.commands.setNodeSelection(pos);
  }, [editor, getPos]);

  const resize = useCallback(
    (w: number, h: number) => updateAttributes({ width: w, height: h }),
    [updateAttributes],
  );

  const fitHeight = useCallback(() => {
    if (!contentHeight) {
      // Документ мог не прислать высоту: открыт до обновления сервера
      // или скрипты в нём падают раньше нашего. Переспросим.
      frameRef.current?.contentWindow?.postMessage(
        { type: HTML_EMBED_MEASURE_MSG },
        "*",
      );
      return;
    }
    updateAttributes({ height: minH });
  }, [contentHeight, minH, updateAttributes]);

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
      <div
        className={classes.container}
        style={{ justifyContent: alignToJustify(align) }}
      >
        <ResizableWrapper
          initialWidth={shownW}
          initialHeight={shownH}
          minWidth={minW}
          maxWidth={MAX_WIDTH}
          minHeight={minH}
          maxHeight={MAX_HEIGHT}
          onResize={resize}
          isEditable={editable}
          selected={selected}
          className={clsx(classes.resizeWrapper, "grist-block-host", {
            "ProseMirror-selectednode": selected,
          })}
        >
          <iframe
            ref={frameRef}
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
            <GristBlockToolbar
              align={align}
              onAlign={(a) => updateAttributes({ align: a })}
              actions={[
                {
                  label: t("Fit height to content"),
                  icon: <IconArrowAutofitHeight size={18} />,
                  onClick: fitHeight,
                },
                {
                  label: t("Open in new tab"),
                  icon: <IconExternalLink size={18} />,
                  href: src,
                },
                {
                  label: t("Delete"),
                  icon: <IconTrash size={18} />,
                  onClick: remove,
                },
              ]}
            />
          )}
        </ResizableWrapper>
      </div>
    </NodeViewWrapper>
  );
}
