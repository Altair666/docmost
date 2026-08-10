import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Box, Group, Loader, Popover, Text } from "@mantine/core";
import { IconSearch, IconX } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useSpotlight } from "@mantine/spotlight";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";

import {
  searchSpotlight,
  searchSpotlightStore,
} from "@/features/search/constants.ts";
import { SearchSpotlightFilters } from "@/features/search/components/search-spotlight-filters.tsx";
import { useUnifiedSearch } from "@/features/search/hooks/use-unified-search.ts";
import {
  IAttachmentSearch,
  IPageSearch,
} from "@/features/search/types/search.types";
import { buildPageUrl } from "@/features/page/page.utils";
import { getPageIcon } from "@/lib";

// Поиск строкой в шапке — как в Grist. Размеры сняты из его DOM:
//   свёрнутый  50x48, значок 32x32 с отступом 8px (глиф 16px), зелёный
//   раскрытый  453x48, рамка 1px, крестик 16x18 справа
//   раскрытие  переход ширины 0.4s ease
//
// У Grist под строкой висит галка «искать на всех страницах». На её месте
// здесь — фильтры, которые уже были в поиске Docmost: пространство и тип.
// Ниже — сами результаты, которых у Grist нет вовсе: он прыгает по ячейкам
// таблицы, а нам нужно показать найденные страницы.
//
// Открытием управляет тот же store, что и раньше: Ctrl+K и «Поиск» в меню
// пространства работают без изменений.

const COLLAPSED_WIDTH = 50;
const EXPANDED_WIDTH = 453;
const BAR_HEIGHT = 48;

function highlight(html: string) {
  return {
    __html: DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["mark", "em", "strong", "b"],
      ALLOWED_ATTR: [],
    }),
  };
}

// Своя строка результата, а не SearchResultItem: тот рисует Spotlight.Action
// и работает только внутри модалки прожектора.
function ResultRow({
  result,
  isAttachment,
  showSpace,
  selected,
  onClick,
  t,
}: {
  t: (key: string) => string;
  result: IPageSearch | IAttachmentSearch;
  isAttachment: boolean;
  showSpace: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const attachment = result as IAttachmentSearch;
  const page = result as IPageSearch;

  const to = isAttachment
    ? buildPageUrl(
        attachment.space.slug,
        attachment.page.slugId,
        attachment.page.title,
      )
    : buildPageUrl(page.space.slug, page.slugId, page.title);

  // У страницы может не быть названия — тогда Docmost везде показывает
  // «Без названия». Без этого строка начиналась прямо с подсветки.
  const title =
    (isAttachment ? attachment.fileName : page.title) || t("Untitled");
  const spaceName = isAttachment ? attachment.space?.name : page.space?.name;

  return (
    <Box
      component={Link}
      to={to}
      onClick={onClick}
      data-selected={selected || undefined}
      style={{
        display: "block",
        padding: "6px 12px",
        textDecoration: "none",
        color: "inherit",
        background: selected ? "var(--mantine-color-default-hover)" : undefined,
      }}
    >
      <Group wrap="nowrap" gap="xs">
        {isAttachment ? getPageIcon(undefined) : getPageIcon(page?.icon)}

        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" lineClamp={1}>
            {title}
          </Text>

          {isAttachment && (
            <Text size="xs" opacity={0.6} lineClamp={1}>
              {attachment.space?.name} • {attachment.page?.title}
            </Text>
          )}

          {!isAttachment && showSpace && spaceName && (
            <Badge variant="light" size="xs" color="gray">
              {spaceName}
            </Badge>
          )}

          {result?.highlight && (
            <Text
              size="xs"
              opacity={0.6}
              lineClamp={2}
              dangerouslySetInnerHTML={highlight(result.highlight)}
            />
          )}
        </div>
      </Group>
    </Box>
  );
}

export default function GristSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { opened } = useSpotlight(searchSpotlightStore);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query, 300);
  const [selected, setSelected] = useState(0);
  const [filters, setFilters] = useState<{
    spaceId?: string | null;
    contentType?: string;
  }>({ contentType: "page" });

  const params = useMemo(() => {
    const p: any = { query: debounced, contentType: filters.contentType || "page" };
    if (filters.spaceId) p.spaceId = filters.spaceId;
    return p;
  }, [debounced, filters]);

  const { data: results, isLoading } = useUnifiedSearch(params, opened);
  const items = results ?? [];
  const isAttachment = filters.contentType === "attachment";

  // Фокус в поле сразу после раскрытия — иначе пришлось бы ещё раз щёлкать
  useEffect(() => {
    if (opened) {
      inputRef.current?.focus();
    } else {
      setQuery("");
      setSelected(0);
    }
  }, [opened]);

  useEffect(() => setSelected(0), [debounced, filters]);

  const go = (index: number) => {
    const item: any = items[index];
    if (!item) return;
    const to = isAttachment
      ? buildPageUrl(item.space.slug, item.page.slugId, item.page.title)
      : buildPageUrl(item.space.slug, item.slugId, item.title);
    searchSpotlight.close();
    navigate(to);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      searchSpotlight.close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      go(selected);
    }
  };

  return (
    <Popover
      opened={opened && query.trim().length > 0}
      position="bottom-end"
      offset={0}
      shadow="md"
      radius={0}
      width={EXPANDED_WIDTH}
      withinPortal
    >
      <Popover.Target>
        <Box
          data-grist-search=""
          data-open={opened || undefined}
          style={{
            display: "flex",
            alignItems: "center",
            flex: "none",
            width: opened ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
            maxWidth: "100%",
            height: BAR_HEIGHT,
            // 16px с обеих сторон: у Grist крестик отстоит от края
            // строки ровно настолько же, насколько лупа от левого.
            paddingRight: 16,
            // Переход ширины 0.4s ease — ровно как у Grist
            transition: "width 0.4s ease",
            background: opened ? "var(--mantine-color-body)" : "transparent",
            border: opened
              ? "1px solid var(--grist-decoration, #d9d9d9)"
              : "1px solid transparent",
          }}
        >
          <Box
            component="button"
            type="button"
            aria-label={t("Search")}
            onClick={() => searchSpotlight.toggle()}
            style={{
              flex: "none",
              width: 32,
              height: 32,
              marginLeft: 16,
              padding: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--grist-primary, #16b378)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <IconSearch size={16} stroke={2} />
          </Box>

          {opened && (
            <>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={onKeyDown}
                placeholder={t("Search...")}
                aria-label={t("Search")}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  font: "inherit",
                  fontSize: 13,
                  paddingLeft: 8,
                }}
              />

              {isLoading && <Loader size={14} mr={8} />}

              <Box
                component="button"
                type="button"
                aria-label={t("Close")}
                onClick={() => searchSpotlight.close()}
                style={{
                  flex: "none",
                  width: 16,
                  height: 18,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--grist-secondary, #929299)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <IconX size={16} stroke={2} />
              </Box>
            </>
          )}
        </Box>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        {/* Здесь у Grist стоит галка «искать на всех страницах».
            У нас на её месте — фильтры поиска Docmost. */}
        <Box
          px="xs"
          py={4}
          data-search-filters=""
          style={{
            borderBottom: "1px solid var(--grist-line-soft, #f0f0f0)",
          }}
        >
          <SearchSpotlightFilters
            onFiltersChange={setFilters}
            spaceId={filters.spaceId ?? undefined}
          />
        </Box>

        <Box style={{ maxHeight: 420, overflowY: "auto" }}>
          {items.length === 0 && !isLoading && (
            <Text size="sm" c="dimmed" px="sm" py="xs">
              {t("No results found...")}
            </Text>
          )}

          {items.map((item: any, index: number) => (
            <ResultRow
              key={item.id}
              result={item}
              isAttachment={isAttachment}
              showSpace={!filters.spaceId}
              selected={index === selected}
              onClick={() => searchSpotlight.close()}
              t={t}
            />
          ))}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
