import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import HtmlEmbedView from "./HtmlEmbedView";

export interface HtmlEmbedAttributes {
  attachmentId?: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
  placeholder?: { id: string; name: string };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    htmlEmbed: {
      setHtmlEmbed: (attributes: HtmlEmbedAttributes) => ReturnType;
    };
  }
}

/**
 * Адрес показа. Не штатная отдача файлов, а свой маршрут: .html оттуда
 * приходит с заголовком «скачать» и в рамке не показывается вовсе.
 * Заодно на том маршруте документ уходит в песочницу.
 */
export function htmlEmbedSrc(attachmentId?: string): string {
  return attachmentId ? `/api/html-embed/${attachmentId}` : "";
}

/**
 * Загруженная HTML-страница внутри страницы вики.
 *
 * Сделан по образцу штатного блока PDF: файл кладётся во вложения
 * страницы, в документе остаётся только ссылка на него. Отличий от PDF
 * два — свой маршрут показа (см. выше) и песочница у рамки.
 */
export const HtmlEmbed = Node.create({
  name: "htmlEmbed",

  group: "block",
  atom: true,
  isolating: true,
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      attachmentId: {
        default: undefined,
        parseHTML: (el) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs) => ({ "data-attachment-id": attrs.attachmentId }),
      },
      name: {
        default: undefined,
        parseHTML: (el) => el.getAttribute("data-name"),
        renderHTML: (attrs) => ({ "data-name": attrs.name }),
      },
      size: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-size"),
        renderHTML: (attrs) => ({ "data-size": attrs.size }),
      },
      width: {
        default: 800,
        parseHTML: (el) => {
          const raw = el.getAttribute("width");
          const num = raw ? parseFloat(raw) : NaN;
          return isNaN(num) ? null : num;
        },
        renderHTML: (attrs) => ({ width: attrs.width }),
      },
      height: {
        default: 600,
        parseHTML: (el) => {
          const raw = el.getAttribute("height");
          const num = raw ? parseFloat(raw) : NaN;
          return isNaN(num) ? null : num;
        },
        renderHTML: (attrs) => ({ height: attrs.height }),
      },
      // Живёт только в памяти, пока файл загружается: в документ
      // такое сохранять незачем.
      placeholder: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    const { "data-attachment-id": id, width, height } = HTMLAttributes;

    return [
      "div",
      mergeAttributes({ "data-type": this.name }, HTMLAttributes),
      [
        "iframe",
        {
          src: htmlEmbedSrc(id),
          width: width || 800,
          height: height || 600,
          // Песочница повторяется и здесь: этой разметкой пользуются
          // вывоз страницы и предпросмотр, где нашего вида нет.
          sandbox: "allow-scripts allow-popups allow-forms allow-modals",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setHtmlEmbed:
        (attrs: HtmlEmbedAttributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(HtmlEmbedView);
  },
});

export default HtmlEmbed;
