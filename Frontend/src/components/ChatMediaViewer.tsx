import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Download from "yet-another-react-lightbox/plugins/download";

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

export const ChatMediaViewer = ({
  open,
  index,
  slides,
  onClose,
  onIndexChange,
}: ChatMediaViewerProps) => {
  const lightboxSlides = slides.map((s) => {
    if (s.type === "video") {
      return {
        type: "video" as const,
        sources: [
          { src: s.src, type: s.mimeType || "video/mp4" },
        ],
        controls: true,
        autoPlay: true,
      };
    }
    return {
      src: s.src,
      alt: s.fileName || "Image",
    };
  });

  return (
    <Lightbox
      open={open}
      index={index}
      slides={lightboxSlides}
      close={onClose}
      on={{ view: ({ index: i }: { index: number }) => onIndexChange(i) }}
      plugins={[Video, Zoom, Download]}
      video={{ controls: true, autoPlay: true, playsInline: true }}
      zoom={{ scrollToZoom: true, maxZoomPixelRatio: 4 }}
      download={{}}
    />
  );
};
