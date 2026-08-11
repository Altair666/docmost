import { atomWithWebStorage } from "@/lib/jotai-helper";

// Правая панель страницы: открыта или свёрнута в полосу.
// По умолчанию свёрнута.
export const rightPanelOpenAtom = atomWithWebStorage<boolean>(
  "grist-right-panel-open",
  false,
);

// Ширина развёрнутой панели — как у левой, её тоже можно тянуть.
export const rightPanelWidthAtom = atomWithWebStorage<number>(
  "grist-right-panel-width",
  300,
);
