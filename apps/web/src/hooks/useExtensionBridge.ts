import { useEffect, useRef } from "react";
import { useProjectStore } from "../stores/project-store";

/**
 * Extension bridge protocol
 *
 * Listens for postMessage events from a Chrome extension that records video.
 * Processes the video immediately on receipt — the engine is already
 * initialized by the time the extension's timeout fires.
 *
 * Extension → App messages:
 *   { type: "openreel-video", blob: Blob, name?: string }
 */
export function useExtensionBridge() {
  const hasProcessed = useRef(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (hasProcessed.current) return;
      if (event.data?.type !== "openreel-video") return;
      if (!event.data?.blob) return;

      hasProcessed.current = true;

      const blob: Blob = event.data.blob;
      const fileName: string = event.data.name || "recording.mp4";

      (async () => {
        try {
          const file = new File([blob], fileName, {
            type: blob.type || "video/mp4",
          });

          const store = useProjectStore.getState();
          store.createNewProject(`From Extension — ${fileName}`);

          const importResult = await store.importMedia(file);

          if (!importResult.success) {
            throw new Error(importResult.error?.message || "Failed to import media");
          }

          const project = useProjectStore.getState().project;
          const mediaItem = project.mediaLibrary.items.find(
            (item) => item.name === fileName,
          );

          if (mediaItem) {
            await store.addClipToNewTrack(mediaItem.id);
          }
        } catch (err) {
          console.error("[ExtensionBridge] Failed to import video:", err);
        }
      })();
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
}
