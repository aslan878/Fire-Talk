import { useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import "./ChatMediaViewer.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faXmark,
  faDownload,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faCircleExclamation,
  faSpinner,
  faExpand,
  faCompress,
} from "@fortawesome/free-solid-svg-icons";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";

export interface MediaSlide {
  src: string;
  type: "image" | "video";
  mimeType?: string | null;
  fileName?: string | null;
}

interface ChatMediaViewerProps {
  open: boolean;
  index: number;
  slides: MediaSlide[];
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/**
 * Resolve the downloadable URL for any slide kind.
 * Video slides carry their URL under `sources[0].src`, images under `src`.
 */
const resolveDownloadUrl = (slide: {
  type?: string;
  src?: string;
  sources?: readonly { src?: string }[];
}): string | undefined => {
  if (slide.type === "video" && Array.isArray(slide.sources)) {
    return slide.sources[0]?.src;
  }
  return slide.src;
};

const navIconStyle = { width: 22, height: 22 } as const;
const toolIconStyle = { width: 18, height: 18 } as const;

export const ChatMediaViewer = ({
  open,
  index,
  slides,
  onClose,
  onIndexChange,
}: ChatMediaViewerProps) => {
  const lightboxSlides = useMemo(
    () =>
      slides.map((s) => {
        if (s.type === "video") {
          return {
            type: "video" as const,
            sources: [{ src: s.src, type: s.mimeType || "video/mp4" }],
          };
        }
        return {
          src: s.src,
          alt: s.fileName || "Image",
        };
      }),
    [slides],
  );

  // Keep the active index within bounds if the slides array changes underneath.
  const safeIndex = useMemo(
    () =>
      lightboxSlides.length === 0
        ? 0
        : Math.max(0, Math.min(index, lightboxSlides.length - 1)),
    [index, lightboxSlides.length],
  );

  if (!open || lightboxSlides.length === 0) return null;

  return (
    <Lightbox
      open={open}
      index={safeIndex}
      slides={lightboxSlides}
      close={onClose}
      on={{
        view: ({ index: i }: { index: number }) => onIndexChange(i),
      }}
      carousel={{
        finite: lightboxSlides.length <= 1,
        // Preload only the immediate neighbours (3 slides total) instead of
        // the default 5. Combined with `preload: "metadata"` on video, this
        // avoids eagerly pulling heavy video files for slides the user may
        // never navigate to.
        preload: 1,
      }}
      controller={{
        // Close on swipe-down / swipe-up gestures (mobile-friendly).
        closeOnPullDown: true,
        closeOnPullUp: true,
        // Close when tapping the dimmed backdrop.
        closeOnBackdropClick: true,
        closeOnEscape: true,
      }}
      animation={{ fade: 250, swipe: 250, navigation: 250 }}
      labels={{
        Previous: "Предыдущий",
        Next: "Следующий",
        Close: "Закрыть",
        Download: "Скачать",
        "Enter Fullscreen": "На весь экран",
        "Exit Fullscreen": "Выйти из полноэкранного режима",
      }}
      plugins={[Video, Zoom, Download, Fullscreen]}
      video={{
        controls: true,
        controlsList: "nodownload noplaybackrate noremoteplayback",
        disablePictureInPicture: true,
        disableRemotePlayback: true,
        playsInline: true,
        preload: "metadata",
        // NOTE: autoPlay intentionally omitted — autoplay with sound is blocked
        // on iOS/Safari/Capacitor, which causes the video to silently fail.
        // The user can tap play via the native controls.
      }}
      zoom={{
        scrollToZoom: true,
        maxZoomPixelRatio: 4,
        zoomInMultiplier: 1.5,
      }}
      download={{
        download: ({ slide, saveAs }) => {
          const url = resolveDownloadUrl(slide);
          if (!url) return;
          // Prefer the original file name from our media list, if known.
          const matched = slides.find((s) => s.src === url);
          saveAs(url, matched?.fileName || undefined);
        },
      }}
      render={{
        iconPrev: () => <FontAwesomeIcon icon={faChevronLeft} style={navIconStyle} />,
        iconNext: () => <FontAwesomeIcon icon={faChevronRight} style={navIconStyle} />,
        iconClose: () => <FontAwesomeIcon icon={faXmark} style={{ width: 20, height: 20 }} />,
        iconDownload: () => <FontAwesomeIcon icon={faDownload} style={toolIconStyle} />,
        iconZoomIn: () => <FontAwesomeIcon icon={faMagnifyingGlassPlus} style={toolIconStyle} />,
        iconZoomOut: () => <FontAwesomeIcon icon={faMagnifyingGlassMinus} style={toolIconStyle} />,
        iconEnterFullscreen: () => <FontAwesomeIcon icon={faExpand} style={toolIconStyle} />,
        iconExitFullscreen: () => <FontAwesomeIcon icon={faCompress} style={toolIconStyle} />,
        iconLoading: () => (
          <FontAwesomeIcon icon={faSpinner} spin style={{ width: 22, height: 22 }} />
        ),
        iconError: () => <FontAwesomeIcon icon={faCircleExclamation} style={toolIconStyle} />,
      }}
    />
  );
};
