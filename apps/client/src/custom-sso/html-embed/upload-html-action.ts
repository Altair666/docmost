import { Command, Editor } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { notifications } from "@mantine/notifications";

import { uploadFile } from "@/features/page/services/page-service.ts";
import { getFileUploadSizeLimit } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import i18n from "@/i18n.ts";

// Метка заглушки. Живёт несколько секунд в памяти одной вкладки, так
// что случайной строки достаточно — совпадение здесь ничем не грозит.
function placeholderMark(): string {
  return `html-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Пока файл летит на сервер, в документе стоит заглушка. Находим её по
// метке, а не по расположению: за время загрузки текст выше могли
// поправить, и позиция уехала бы.
function findByPlaceholder(doc: Node, placeholderId: string) {
  let found: { node: Node; pos: number } | null = null;

  doc.descendants((node, pos) => {
    if (found) return false;
    if (
      node.type.name === "htmlEmbed" &&
      node.attrs.placeholder?.id === placeholderId
    ) {
      found = { node, pos };
      return false;
    }
    return true;
  });

  return found;
}

function validate(file: File): boolean {
  const name = (file.name || "").toLowerCase();
  const byName = name.endsWith(".html") || name.endsWith(".htm");
  // Тип, который присылает браузер, зависит от системы: у .htm он
  // бывает пустым. Поэтому имени достаточно, а тип — как подсказка.
  const byType = file.type === "text/html" || file.type === "";

  if (!byName || !byType) {
    notifications.show({
      color: "red",
      message: i18n.t("Only .html files can be embedded"),
    });
    return false;
  }

  if (file.size > getFileUploadSizeLimit()) {
    notifications.show({
      color: "red",
      message: i18n.t("File exceeds the {{limit}} attachment limit", {
        limit: formatBytes(getFileUploadSizeLimit()),
      }),
    });
    return false;
  }

  return true;
}

/**
 * Загрузка HTML-файла и вставка блока — тот же порядок, что у штатного
 * PDF: заглушка, отправка, замена заглушки на готовый блок.
 */
export async function uploadHtmlAction(
  file: File,
  editor: Editor,
  pos: number,
  pageId: string,
) {
  if (!validate(file)) return;

  const placeholderId = placeholderMark();
  let placeholderInserted = false;

  const insertPlaceholder = (): Command => {
    return ({ tr, state }) => {
      const node = state.schema.nodes.htmlEmbed?.create({
        placeholder: { id: placeholderId, name: file.name },
      });
      if (!node) return false;

      const { parent } = tr.doc.resolve(pos);
      const isEmptyTextBlock = parent.isTextblock && !parent.childCount;

      if (isEmptyTextBlock) {
        tr.replaceRangeWith(pos - 1, pos + 1, node);
      } else {
        tr.insert(pos, node);
      }
      return true;
    };
  };

  const replacePlaceholder = (attachment: any): Command => {
    return ({ tr }) => {
      const found = findByPlaceholder(tr.doc, placeholderId);
      if (!found || !attachment) return false;

      tr.setNodeMarkup(found.pos, undefined, {
        attachmentId: attachment.id,
        name: attachment.fileName,
        size: attachment.fileSize,
        width: 800,
        height: 600,
      });
      return true;
    };
  };

  const removePlaceholder = (): Command => {
    return ({ tr }) => {
      const found = findByPlaceholder(tr.doc, placeholderId);
      if (!found) return false;
      tr.delete(found.pos, found.pos + 2);
      return true;
    };
  };

  // Заглушку показываем не сразу: мелкий файл успевает загрузиться
  // раньше, и мигание заглушкой выглядит нелепо.
  const timer = setTimeout(() => {
    editor.commands.command(insertPlaceholder());
    placeholderInserted = true;
  }, 250);

  try {
    const attachment = await uploadFile(file, pageId);
    clearTimeout(timer);

    if (placeholderInserted) {
      setTimeout(() => {
        editor.commands.command(replacePlaceholder(attachment));
      }, 100);
    } else {
      editor
        .chain()
        .command(insertPlaceholder())
        .command(replacePlaceholder(attachment))
        .run();
    }
  } catch (err: any) {
    clearTimeout(timer);
    editor.commands.command(removePlaceholder());
    notifications.show({
      color: "red",
      message: err?.response?.data?.message ?? i18n.t("Upload failed"),
    });
  }
}

/**
 * Просит файл у человека и вставляет блок. Вызывается из меню «/» и из
 * панели интеграций.
 */
export function pickAndUploadHtml(editor: Editor, pos: number, pageId: string) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".html,.htm,text/html";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void uploadHtmlAction(file, editor, pos, pageId);
  };
  input.click();
}
