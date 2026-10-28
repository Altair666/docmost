import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

import { customUiEnabled } from "@/custom-sso/ui-flags";
import { openImageLightbox } from "./ImageLightbox";
import classes from "./media.module.css";

// Узлы, которые на странице выглядят картинкой. Схемы drawio и
// excalidraw в чтении — тоже просто изображение, и мелкие подписи на
// них читать приходится так же.
const IMAGE_NODES = new Set(["image", "drawio", "excalidraw"]);

function imageNodeAt(view: EditorView, img: HTMLElement) {
  let pos: number;
  try {
    pos = view.posAtDOM(img, 0);
  } catch {
    return null;
  }
  // posAtDOM для узла-атома отдаёт то начало узла, то позицию внутри —
  // проверяем обе.
  for (const p of [pos, pos - 1]) {
    if (p < 0) continue;
    const node = view.state.doc.nodeAt(p);
    if (node && IMAGE_NODES.has(node.type.name)) return node;
  }
  return null;
}

function enabled(view: EditorView) {
  return !view.editable && customUiEnabled();
}

/**
 * Просмотр картинки по клику — только в чтении и только в «Нашем
 * интерфейсе». В правке клик по-прежнему выделяет картинку и открывает
 * её меню.
 *
 * Плагином, а не врезкой в ImageView: готовую картинку рисует не он, а
 * штатный узел с ручками размера (editor-ext, image.ts) на голом DOM.
 * ImageView показывается только, пока файл загружается.
 */
export const ImageLightboxExt = Extension.create({
  name: "gristImageLightbox",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("gristImageLightbox"),
        props: {
          handleDOMEvents: {
            click: (view, event) => {
              if (!enabled(view)) return false;
              const target = event.target as HTMLElement | null;
              if (!target || target.tagName !== "IMG") return false;
              if (!imageNodeAt(view, target)) return false;

              const img = target as HTMLImageElement;
              event.preventDefault();
              openImageLightbox(img.currentSrc || img.src, img.alt || undefined);
              return true;
            },
          },
        },
        // Курсор-лупа: класс на корне редактора, пока просмотр доступен.
        // Обновляется на каждом изменении вида — переключение
        // чтение/правка тоже его вызывает.
        view: (view) => {
          const sync = () =>
            view.dom.classList.toggle(classes.zoomableImages, enabled(view));
          sync();
          return {
            update: sync,
            destroy: () => view.dom.classList.remove(classes.zoomableImages),
          };
        },
      }),
    ];
  },
});
