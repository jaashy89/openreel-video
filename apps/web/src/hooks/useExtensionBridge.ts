import { useEffect, useRef } from "react";
import { useProjectStore } from "../stores/project-store";

/**
 * Extension bridge protocol
 *
 * This hook listens for postMessage events from a Chrome extension that
 * records video. The extension opens this app in a new tab and sends the
 * recorded video blob via postMessage.
 *
 * Extension → App messages:
 *   { type: "openreel-video", blob: Blob, name?: string }
 *
 * Only activates when `ready` is true (bridges initialized).
 */
export function useExtensionBridge(ready: boolean) {
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (!ready) return;

    const handler = async (event: MessageEvent) => {
      // Only process one video per session
      if (hasProcessed.current) return;
      if (event.data?.type !== "openreel-video") return;
      if (!event.data?.blob) return;

      hasProcessed.current = true;

      const blob: Blob = event.data.blob;
      const fileName: string = event.data.name || "recording.mp4";

      try {
        const file = new File([blob], fileName, {
          type: blob.type || "video/mp4",
        });

        const store = useProjectStore.getState();

        // Create a new project sized to the video's natural dimensions
        store.createNewProject(`From Extension — ${fileName}`);

        // Import the video into the media library
        const importResult = await store.importMedia(file);

        if (!importResult.success) {
          throw new Error(importResult.error?.message || "Failed to import media");
        }

        // Find the newly imported media item
        const project = useProjectStore.getState().project;
        const mediaItem = project.mediaLibrary.items.find(
          (item) => item.name === fileName,
        );

        if (mediaItem) {
          // Add it to a new track on the timeline
          await store.addClipToNewTrack(mediaItem.id);
        }

        console.log("[ExtensionBridge] Video imported successfully:", fileName);
      } catch (err) {
        console.error("[ExtensionBridge] Failed to import video:", err);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [ready]);
}
