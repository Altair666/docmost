import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import ChecklistView from "./ChecklistView";

/**
 * Чек-лист по образцу Trello.
 *
 * Внутри — обычный список задач Docmost, чтобы не плодить свой формат:
 * такой документ откроется и без нашего оформления, просто без шапки.
 * Снаружи — название, полоса выполнения, счётчик и кнопка скрытия
 * отмеченных.
 *
 * Отмеченные пункты остаются на своих местах, как в Trello. Перенос их
 * вниз пробовали — получилось хрупко: список прыгал под курсором и
 * ссорился с совместной правкой. Простое поведение оказалось лучше.
 *
 * Отметку в режиме чтения обеспечивает не этот узел, а CheckableTaskItem:
 * так она работает у любого списка задач, а не только внутри чек-листа,
 * и галку в клетке рисует сам редактор.
 */

export interface ChecklistOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    checklist: {
      insertChecklist: () => ReturnType;
    };
  }
}

export const Checklist = Node.create<ChecklistOptions>({
  name: "checklist",
  group: "block",
  // Содержимое — штатный список задач: свой формат хранения заводить
  // незачем, а совместимость дороже.
  content: "taskList",
  defining: true,
  isolating: true,
  // Чтобы блок можно было таскать общей ручкой, как остальные
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      title: {
        default: "Чек-лист",
        parseHTML: (el) => el.getAttribute("data-title") || "Чек-лист",
        renderHTML: (attrs) => ({ "data-title": attrs.title }),
      },
      // Скрывать ли отмеченные. В Trello это кнопка у каждого списка, а
      // не общая настройка — так удобнее: в одном списке прячем, в
      // другом видно.
      hideChecked: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-hide-checked") === "true",
        renderHTML: (attrs) => ({
          "data-hide-checked": attrs.hideChecked ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="checklist"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "checklist",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChecklistView);
  },

  addCommands() {
    return {
      insertChecklist:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { title: "Чек-лист", hideChecked: false },
              content: [
                {
                  type: "taskList",
                  content: [
                    {
                      type: "taskItem",
                      attrs: { checked: false },
                      content: [{ type: "paragraph" }],
                    },
                  ],
                },
              ],
            })
            .run(),
    };
  },
});

export default Checklist;
