import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Node as PMNode } from "@tiptap/pm/model";

import ChecklistView from "./ChecklistView";

/**
 * Чек-лист по образцу Trello.
 *
 * Внутри — обычный список задач Docmost, чтобы не плодить свой формат:
 * такой документ откроется и без нашего оформления, просто без шапки.
 * Снаружи — заголовок, полоса выполнения, счётчик и кнопка скрытия
 * отмеченных.
 *
 * Отличие от Trello, о котором стоит знать: там отмеченные пункты
 * остаются на месте, а у нас опускаются вниз — так просил заказчик.
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

export const checklistPluginKey = new PluginKey("checklistBehaviour");

/** Отмечен ли пункт списка задач. */
function isChecked(node: PMNode): boolean {
  return node.attrs?.checked === true;
}

/**
 * Порядок пунктов: сперва неотмеченные, потом отмеченные. Внутри каждой
 * половины прежний порядок сохраняется — иначе список перетасовывался бы
 * на каждое нажатие.
 */
function sortedChildren(list: PMNode): PMNode[] | null {
  const items: PMNode[] = [];
  list.forEach((child) => items.push(child));

  const done = items.filter(isChecked);
  const todo = items.filter((n) => !isChecked(n));

  // Уже разложено как надо — не трогаем документ зря
  if (done.length === 0 || todo.length === 0) return null;
  const target = [...todo, ...done];
  const same = target.every((n, i) => n === items[i]);
  return same ? null : target;
}

export const Checklist = Node.create<ChecklistOptions>({
  name: "checklist",
  group: "block",
  // Содержимое — штатный список задач: свой формат хранения заводить
  // незачем, а совместимость дороже.
  content: "taskList",
  defining: true,
  isolating: true,

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
        renderHTML: (attrs) => ({ "data-hide-checked": attrs.hideChecked ? "true" : "false" }),
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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: checklistPluginKey,

        /**
         * Отмеченные пункты опускаются под неотмеченные.
         *
         * Делаем это здесь, а не в обработчике щелчка: так порядок
         * поправится и когда отметку поставили в режиме правки, и когда
         * изменение пришло от другого человека по совместному
         * редактированию.
         */
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((t) => t.docChanged)) return null;

          const rearrangements: Array<{ pos: number; list: PMNode; items: PMNode[] }> = [];

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "checklist") return;
            node.forEach((child, offset) => {
              if (child.type.name !== "taskList") return;
              const sorted = sortedChildren(child);
              if (sorted) {
                rearrangements.push({ pos: pos + 1 + offset, list: child, items: sorted });
              }
            });
          });

          if (rearrangements.length === 0) return null;

          const tr = newState.tr;
          // С конца: иначе правка сдвинет позиции последующих списков
          for (const r of rearrangements.reverse()) {
            const replacement = r.list.type.create(r.list.attrs, r.items, r.list.marks);
            tr.replaceWith(r.pos, r.pos + r.list.nodeSize, replacement);
          }

          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});

export default Checklist;
