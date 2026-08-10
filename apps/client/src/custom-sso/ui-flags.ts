import { useSyncExternalStore } from "react";

// Переключатели внешнего вида. Приходят с сервера (общие на всё рабочее
// пространство, меняет администратор в «Оформлении»), но читаются
// синхронно — иначе первый кадр рисовался бы не тем интерфейсом, а после
// ответа сервера дёргался.
//
// Поэтому значения дублируются в localStorage: при запуске берём оттуда,
// а когда придёт ответ сервера — обновляем и сохраняем на следующий раз.
// Расхождение живёт максимум один заход и только если настройку поменял
// кто-то другой прямо сейчас.

export interface UiFlags {
  // Наш интерфейс: оформление Grist плюс наши доработки шапки и меню.
  // Выключено — чистый Docmost, каким он приходит из апстрима.
  customUi: boolean;
  // Прятать разделы платной редакции (/ee), на которые нет лицензии.
  // Docmost рисует их серыми плашками с подписью «Available with a paid
  // license»; нам они только мешают.
  hideEeItems: boolean;
}

const STORAGE_KEY = "custom-ui-flags";

const DEFAULTS: UiFlags = {
  // По умолчанию — стоковый вид: пока сервер не ответил, безопаснее
  // показать то, что точно работает.
  customUi: false,
  // А это поведение было вшито в сборку до появления настройки,
  // менять его по умолчанию никто не просил.
  hideEeItems: true,
};

function read(): UiFlags {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      customUi: parsed?.customUi === true,
      hideEeItems: parsed?.hideEeItems !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

let flags: UiFlags = read();

const listeners = new Set<() => void>();

export function setUiFlags(next: UiFlags): void {
  const changed =
    next.customUi !== flags.customUi || next.hideEeItems !== flags.hideEeItems;

  flags = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // приватный режим или переполненное хранилище — переживём,
    // просто следующий запуск снова начнёт со значений по умолчанию
  }

  // Первый кадр рисуется по значениям из localStorage. Если сервер ответил
  // иначе (настройку поменяли с другого места), перерисовываем то, что от
  // флагов зависит, — без перезагрузки страницы.
  if (changed) listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Для разметки, которая должна перестроиться сразу после ответа сервера:
// шапка, меню, оболочка. Остальным хватает функций ниже — они прочитают
// новое значение при ближайшей перерисовке.
export function useUiFlags(): UiFlags {
  return useSyncExternalStore(subscribe, getUiFlags, getUiFlags);
}

// Нарочно функции, а не константы: значение известно только после ответа
// сервера, а константу импортёры «запекли» бы в момент загрузки модуля.
export function customUiEnabled(): boolean {
  return flags.customUi;
}

export function hideLockedEeItems(): boolean {
  return flags.hideEeItems;
}

export function getUiFlags(): UiFlags {
  return flags;
}
