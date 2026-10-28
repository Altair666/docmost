export type BlockAlign = "left" | "center" | "right";

/**
 * Атрибут выравнивания для блоков-рамок (PDF, HTML). Записан так же, как
 * у штатной картинки, — data-align в разметке, по умолчанию центр. Центр
 * по умолчанию — это и есть прежний вид, так что старые страницы не
 * сдвигаются.
 */
export const alignAttribute = {
  default: "center",
  parseHTML: (el: HTMLElement) => el.getAttribute("data-align") || "center",
  renderHTML: (attrs: Record<string, any>) => ({
    "data-align": attrs.align || "center",
  }),
};

export function alignToJustify(align?: string | null): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}
