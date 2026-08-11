import { atomWithWebStorage } from "@/lib/jotai-helper";

// Правая панель страницы: открыта или свёрнута в полосу.
// По умолчанию свёрнута.
export const rightPanelOpenAtom = atomWithWebStorage<boolean>(
  "grist-right-panel-open",
  false,
);

// Ширина развёрнутой панели — как у левой, её тоже можно тянуть.
export const RIGHT_PANEL_DEFAULT = 300;

export const rightPanelWidthAtom = atomWithWebStorage<number>(
  "grist-right-panel-width",
  RIGHT_PANEL_DEFAULT,
);

// Пределы растягивания. Уже 240 команды не читаются, шире 480 панель
// отъедает у текста больше, чем даёт.
export const RIGHT_PANEL_MIN = 240;
export const RIGHT_PANEL_MAX = 480;
