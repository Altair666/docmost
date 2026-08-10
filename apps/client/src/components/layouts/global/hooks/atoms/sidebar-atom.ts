import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { atom, useAtom } from "jotai";
import { useUiFlags } from "@/custom-sso/ui-flags";

export const mobileSidebarAtom = atom<boolean>(false);

export const desktopSidebarAtom = atomWithWebStorage<boolean>(
  "showSidebar",
  true,
);

export const desktopAsideAtom = atom<boolean>(false);

// Valid `tab` values: "" | "comments" | "toc" | "chat" | "details"
type AsideStateType = {
  tab: string;
  isAsideOpen: boolean;
};

export const asideStateAtom = atom<AsideStateType>({
  tab: "",
  isAsideOpen: false,
});

// Сырое значение из хранилища. Напрямую его читают только те, кто ширину
// задаёт; всем остальным нужен useSidebarWidth ниже — он учитывает вид.
export const sidebarWidthAtom = atomWithWebStorage<number>('sidebarWidth', 0);

// Пользователь тянул край сам? Тогда его ширина главнее любых умолчаний.
export const sidebarWidthTouchedAtom = atomWithWebStorage<boolean>(
  'sidebarWidthTouched',
  false,
);

// 240px — ширина сайдбара в Grist, снята из его DOM. У Docmost — 300.
export const GRIST_SIDEBAR_WIDTH = 240;
export const STOCK_SIDEBAR_WIDTH = 300;

export function useSidebarWidth(): number {
  const [width] = useAtom(sidebarWidthAtom);
  const [touched] = useAtom(sidebarWidthTouchedAtom);
  const { customUi } = useUiFlags();

  if (touched && width > 0) return width;
  return customUi ? GRIST_SIDEBAR_WIDTH : STOCK_SIDEBAR_WIDTH;
}