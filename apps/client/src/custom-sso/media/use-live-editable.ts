import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";

/**
 * Признак «можно править», который не устаревает.
 *
 * Смена режима чтение/правка перерисовку узла не вызывает, и значение
 * editor.isEditable, взятое при отрисовке, остаётся прежним: в чтении
 * висели кнопки правки. Ловили это на чек-листе и на блоке HTML —
 * здесь тот же приём, вынесенный в одно место.
 */
export function useLiveEditable(editor: Editor | null | undefined): boolean {
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

  return editable;
}
