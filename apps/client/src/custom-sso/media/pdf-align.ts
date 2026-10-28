import { TiptapPdf } from "@docmost/editor-ext";
import { alignAttribute } from "./block-align";

/**
 * Штатный PDF плюс выравнивание. Расширяем, а не правим editor-ext:
 * так обновление форка не задевает. Атрибут в схеме стоит безусловно,
 * как и у блока HTML: иначе до прихода настроек с сервера он выпадал
 * бы из документа. Ту же схему держит сервер
 * (custom-sso/src/editor/nodes.ts) — менять в обоих местах.
 */
export const PdfWithAlign = TiptapPdf.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: alignAttribute,
    };
  },
});
