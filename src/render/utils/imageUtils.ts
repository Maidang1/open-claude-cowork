import type { ImageAttachment } from "../types";

export function filesToImageAttachments(
  files: File[],
  onImagesLoaded: (images: ImageAttachment[]) => void,
): void {
  const newImages: ImageAttachment[] = [];

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      newImages.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        filename: file.name,
        mimeType: file.type,
        dataUrl: event.target?.result as string,
        size: file.size,
      });

      if (newImages.length === files.length) {
        onImagesLoaded(newImages);
      }
    };
    reader.readAsDataURL(file);
  });
}
