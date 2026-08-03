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
 * App → Extension messages:
 *   { type: "openreel-ready" }  — sent once the app is listening
 *   { type: "openreel-imported", success: boolean, error?: string }
 */
export function useExtensionBridge() {
  const hasSignaledReady = useRef(false);

  useEffect(() => {
    // Signal to the opener (extension) that this tab is ready to receive video
    if (window.opener && !hasSignaledReady.current) {
      hasSignaledReady.current = true;
      window.opener.postMessage({ type: "openreel-ready" }, "*");
    }

    const handler = async (event: MessageEvent) => {
      // Accept messages from any origin so the extension can send from
      // chrome-extension://<id> without us knowing the exact ID.
      if (event.data?.type !== "openreel-video") return;
      if (!event.data?.blob) return;

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

        // Report success back to the extension
        if (event.source && "postMessage" in event.source) {
          (event.source as Window).postMessage(
            { type: "openreel-imported", success: true },
            { targetOrigin: "*" },
          );
        }
      } catch (err) {
        console.error("[ExtensionBridge] Failed to import video:", err);

        if (event.source && "postMessage" in event.source) {
          (event.source as Window).postMessage(
            {
              type: "openreel-imported",
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            },
            { targetOrigin: "*" },
          );
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
}
