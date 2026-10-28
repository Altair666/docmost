import { useEffect, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { IconDownload, IconX } from "@tabler/icons-react";
import clsx from "clsx";

import i18n from "@/i18n.ts";
import classes from "./media.module.css";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

/**
 * Картинка на весь экран — по клику в режиме чтения.
 *
 * Закрывается крестиком, Esc и кликом мимо картинки. Клик по самой
 * картинке переключает «вписать в экран» / «в натуральную величину»:
 * схемы и скриншоты в вики часто крупнее окна, и без этого мелкий текст
 * на них не прочитать.
 *
 * Рисуется отдельным корнем React, без Mantine: штатная картинка с
 * ручками размера — это узел на голом DOM, React-дерева страницы рядом
 * с ней нет, и провайдер тем взять неоткуда.
 */
function ImageLightbox({ src, alt, onClose }: Props) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Прокрутку страницы под просмотром держим, иначе колесо уводит
    // страницу, пока смотришь картинку.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const t = (s: string) => i18n.t(s);

  return (
    <div
      className={classes.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={alt || t("Image")}
      onClick={onClose}
    >
      <div className={classes.lightboxActions} onClick={(e) => e.stopPropagation()}>
        <a
          className={classes.lightboxButton}
          href={src}
          download=""
          title={t("Download")}
          aria-label={t("Download")}
        >
          <IconDownload size={20} />
        </a>
        <button
          type="button"
          className={classes.lightboxButton}
          onClick={onClose}
          title={t("Close")}
          aria-label={t("Close")}
        >
          <IconX size={22} />
        </button>
      </div>

      <div className={clsx(classes.lightboxStage, zoomed && classes.lightboxStageZoomed)}>
        <img
          src={src}
          alt={alt || ""}
          className={clsx(classes.lightboxImage, zoomed && classes.lightboxImageZoomed)}
          onClick={(e) => {
            e.stopPropagation();
            setZoomed((z) => !z);
          }}
        />
      </div>

      {alt && <div className={classes.lightboxCaption}>{alt}</div>}
    </div>
  );
}

let current: { root: Root; host: HTMLElement } | null = null;

export function closeImageLightbox() {
  if (!current) return;
  const { root, host } = current;
  current = null;
  root.unmount();
  host.remove();
}

export function openImageLightbox(src: string, alt?: string) {
  closeImageLightbox();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  current = { root, host };
  root.render(<ImageLightbox src={src} alt={alt} onClose={closeImageLightbox} />);
}
