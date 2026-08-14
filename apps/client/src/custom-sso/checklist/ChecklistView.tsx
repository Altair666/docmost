import { useEffect, useMemo, useState } from "react";
import { NodeViewContent, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { ActionIcon, Group, Progress, Text, TextInput, Tooltip } from "@mantine/core";
import { IconEye, IconEyeOff, IconTrash, IconChecklist } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

/**
 * Чек-лист по образцу Trello: значок, название, полоса выполнения со
 * счётчиком, кнопка скрытия отмеченных и удаление.
 *
 * Заголовок правится только в режиме правки — в чтении это просто текст.
 * Кнопка скрытия работает всегда: она нужна как раз читателю.
 */
export default function ChecklistView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}: NodeViewProps) {
  const { t } = useTranslation();
  const [editingTitle, setEditingTitle] = useState(false);

  const hideChecked: boolean = node.attrs.hideChecked === true;
  const title: string = node.attrs.title || t("Checklist");

  // Считаем по содержимому узла: отдельного счётчика в документе нет,
  // иначе он расходился бы с пунктами при совместной правке.
  const { done, total } = useMemo(() => {
    let d = 0;
    let n = 0;
    node.descendants((child) => {
      if (child.type.name === "taskItem") {
        n += 1;
        if (child.attrs?.checked) d += 1;
      }
    });
    return { done: d, total: n };
  }, [node]);

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  // Признак должен быть живым: страницу переключают между правкой и
  // чтением, а вид узла сам по себе не перерисовывается — из-за этого
  // в чтении оставалась кнопка удаления, а отметка не срабатывала.
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

  /**
   * Отметка в режиме чтения.
   *
   * В правке с этим справляется сам редактор. В чтении он нажатие
   * отклоняет, а для чек-листа это бессмысленно: список для того и
   * нужен, чтобы отмечать по ходу дела, не переключая страницу.
   *
   * Делаем это здесь, а не плагином редактора: узел со своим видом
   * перехватывает события раньше, и до плагина они не доходят —
   * проверено следом, обработчик молчал.
   */
  const handleClickCapture = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      !target ||
      target.tagName !== "INPUT" ||
      target.getAttribute("type") !== "checkbox"
    ) {
      return;
    }
    // Спрашиваем редактор сейчас, а не полагаемся на значение с
    // прошлой отрисовки: оно устаревает при смене режима.
    if (editor?.isEditable) return;

    event.preventDefault();
    event.stopPropagation();

    // Ищем от самого нажатого элемента: ссылка на обёртку у TipTap не
    // пробрасывается, и поиск по ней молча давал пустоту.
    const root = target.closest('[data-type="checklist"]');
    if (!root) return;

    const boxes = Array.from(root.querySelectorAll('input[type="checkbox"]'));
    const index = boxes.indexOf(target as HTMLInputElement);
    if (index < 0) return;

    const base = typeof getPos === "function" ? getPos() : null;
    if (base === null || base === undefined) return;

    let seen = -1;
    let itemPos: number | null = null;
    let item: any = null;

    node.descendants((child, pos) => {
      if (child.type.name !== "taskItem") return;
      seen += 1;
      if (seen === index) {
        // Позиция внутри узла считается от начала его содержимого
        itemPos = base + 1 + pos;
        item = child;
      }
    });

    if (!item || itemPos === null) return;

    const tr = editor.state.tr.setNodeMarkup(itemPos, undefined, {
      ...item.attrs,
      checked: !item.attrs?.checked,
    });
    editor.view.dispatch(tr);
  };

  return (
    <NodeViewWrapper
      data-type="checklist"
      data-hide-checked={hideChecked ? "true" : "false"}
      onClickCapture={handleClickCapture}
      style={{
        border: "1px solid var(--grist-decoration, #d9d9d9)",
        borderRadius: 4,
        padding: "10px 12px",
        margin: "12px 0",
        background: "var(--grist-bg, #fff)",
      }}
    >
      <div contentEditable={false}>
        <Group gap={8} wrap="nowrap" align="center" mb={6}>
          <IconChecklist size={18} stroke={2} style={{ flex: "none", opacity: 0.7 }} />

          {editingTitle && editable ? (
            <TextInput
              size="xs"
              value={node.attrs.title}
              autoFocus
              onChange={(e) => updateAttributes({ title: e.currentTarget.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
              }}
              style={{ flex: 1 }}
            />
          ) : (
            <Text
              fw={600}
              size="sm"
              style={{ flex: 1, cursor: editable ? "text" : "default" }}
              onClick={() => editable && setEditingTitle(true)}
            >
              {title}
            </Text>
          )}

          <Text size="xs" c="dimmed" style={{ flex: "none", whiteSpace: "nowrap" }}>
            {done} / {total}
          </Text>

          {/* Скрытие отмеченных — у каждого списка своё, как в Trello: в
              одном прячем, в другом видно. */}
          <Tooltip
            label={hideChecked ? t("Show checked items") : t("Hide checked items")}
            openDelay={300}
            withArrow
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={hideChecked ? t("Show checked items") : t("Hide checked items")}
              onClick={() => updateAttributes({ hideChecked: !hideChecked })}
            >
              {hideChecked ? <IconEye size={16} /> : <IconEyeOff size={16} />}
            </ActionIcon>
          </Tooltip>

          {editable && (
            <Tooltip label={t("Delete")} openDelay={300} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={t("Delete")}
                onClick={() => deleteNode()}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        <Progress
          value={percent}
          size="sm"
          radius="xl"
          color="var(--grist-primary, #16b378)"
          mb={8}
          aria-label={`${percent}%`}
        />

        {hideChecked && done > 0 && (
          <Text size="xs" c="dimmed" mb={4}>
            {t("Checked items hidden")}: {done}
          </Text>
        )}
      </div>

      {/* Сами пункты — обычный список задач Docmost */}
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
