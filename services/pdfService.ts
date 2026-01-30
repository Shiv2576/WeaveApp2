import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { EditedImage } from "../types";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

/**
 * Generate PDF from images
 */
export const generatePdf = async (
  images: EditedImage[],
  pdfName?: string,
): Promise<string> => {
  if (images.length === 0) {
    throw new Error("No images to generate PDF");
  }

  console.log("Generating PDF with", images.length, "images");

  // Convert images to base64
  const base64Images = await Promise.all(
    images.map(async (img) => {
      if (img.uri.startsWith("data:image/")) {
        return img.uri;
      }

      const base64 = await FileSystem.readAsStringAsync(img.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      let mimeType = "image/jpeg";
      if (img.uri.toLowerCase().endsWith(".png")) mimeType = "image/png";
      if (img.uri.toLowerCase().endsWith(".gif")) mimeType = "image/gif";
      if (img.uri.toLowerCase().endsWith(".webp")) mimeType = "image/webp";

      return `data:${mimeType};base64,${base64}`;
    }),
  );

  // Create HTML
  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { margin: 0; padding: 20px; }
          img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto 20px auto;
            page-break-after: always;
          }
          img:last-child { page-break-after: auto; }
        </style>
      </head>
      <body>
        ${base64Images.map((src) => `<img src="${src}" />`).join("")}
      </body>
    </html>
  `;

  // Generate PDF
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // If a name is provided, rename it immediately
  if (pdfName) {
    return await renamePdf(uri, pdfName);
  }

  return uri;
};

/**
 * Rename/Move a PDF file to documents directory with new name
 */
export const renamePdf = async (
  sourceUri: string,
  newFileName: string,
): Promise<string> => {
  try {
    const cleanName = sanitizeFileName(newFileName);
    console.log("Renaming PDF to:", cleanName);

    // Get documents directory
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      throw new Error("Cannot access document directory");
    }

    // Check source file
    const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
    if (!sourceInfo.exists) {
      throw new Error("Source PDF file not found");
    }

    // Create target path
    const targetUri = `${docDir}${cleanName}`;

    // Check if target already exists
    const targetInfo = await FileSystem.getInfoAsync(targetUri);
    if (targetInfo.exists) {
      // Add timestamp to avoid conflict
      const timestamp = Date.now();
      const nameWithoutExt = cleanName.replace(/\.pdf$/i, "");
      const uniqueName = `${nameWithoutExt}_${timestamp}.pdf`;
      console.log("File exists, using unique name:", uniqueName);
      return await renamePdf(sourceUri, uniqueName);
    }

    // Copy file to new location
    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetUri,
    });

    console.log("PDF renamed/moved to:", targetUri);

    // Try to delete source file
    try {
      await FileSystem.deleteAsync(sourceUri, { idempotent: true });
      console.log("Source file deleted");
    } catch (deleteError) {
      console.log("Could not delete source file:", deleteError);
    }

    return targetUri;
  } catch (error: unknown) {
    console.error("Error in renamePdf:", error);
    throw new Error(`Failed to rename PDF: ${error.message}`);
  }
};

/**
 * Get PDF file information
 */
export const getPdfFileInfo = async (pdfUri: string) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(pdfUri);

    if (!fileInfo.exists) {
      throw new Error("PDF file not found");
    }

    // Extract filename from URI
    const filename = pdfUri.split("/").pop() || "unknown.pdf";
    const extension = filename.split(".").pop() || "";

    // Format file size
    let sizeFormatted = "0 KB";
    if (fileInfo.size) {
      const sizeInKB = fileInfo.size / 1024;
      if (sizeInKB < 1024) {
        sizeFormatted = `${sizeInKB.toFixed(1)} KB`;
      } else {
        sizeFormatted = `${(sizeInKB / 1024).toFixed(1)} MB`;
      }
    }

    return {
      uri: pdfUri,
      size: fileInfo.size || 0,
      modificationTime: fileInfo.modificationTime,
      filename,
      extension: `.${extension}`,
      sizeFormatted,
      exists: true,
    };
  } catch (error) {
    console.error("Error getting PDF info:", error);
    throw error;
  }
};

/**
 * Share PDF file
 */
export const sharePdf = async (
  pdfUri: string,
  fileName: string = "document.pdf",
): Promise<void> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(pdfUri);

    if (!fileInfo.exists) {
      throw new Error("PDF file not found");
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Sharing is not available on this device");
    }

    await Sharing.shareAsync(pdfUri, {
      mimeType: "application/pdf",
      dialogTitle: `Share ${fileName}`,
      UTI: "com.adobe.pdf",
    });
  } catch (error) {
    console.error("Error sharing PDF:", error);
    throw error;
  }
};

/**
 * List all PDFs in documents directory
 */
export const listAllPdfs = async () => {
  try {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      console.error("No document directory available");
      return [];
    }

    // List all files
    const files = await FileSystem.readDirectoryAsync(docDir);

    // Filter PDF files
    const pdfFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".pdf"),
    );

    // Get info for each PDF
    const pdfsWithInfo = await Promise.all(
      pdfFiles.map(async (file) => {
        try {
          const fileUri = `${docDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);

          if (!fileInfo.exists) {
            console.log("File no longer exists:", file);
            return null;
          }

          // Format file size
          let sizeFormatted = "0 KB";
          if (fileInfo.size) {
            const sizeInKB = fileInfo.size / 1024;
            if (sizeInKB < 1024) {
              sizeFormatted = `${sizeInKB.toFixed(1)} KB`;
            } else {
              sizeFormatted = `${(sizeInKB / 1024).toFixed(1)} MB`;
            }
          }

          // Format date
          const date = fileInfo.modificationTime
            ? new Date(fileInfo.modificationTime).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Unknown";

          return {
            id: `${file}_${fileInfo.modificationTime || Date.now()}`,
            name: file,
            uri: fileUri,
            size: sizeFormatted,
            rawSize: fileInfo.size || 0,
            date,
            modificationTime: fileInfo.modificationTime || 0,
          };
        } catch (error) {
          console.error("Error processing file:", file, error);
          return null;
        }
      }),
    );

    // Filter and sort
    const validPdfs = pdfsWithInfo.filter(Boolean) as any[];

    const sortedPdfs = validPdfs.sort((a, b) => {
      return (b.modificationTime || 0) - (a.modificationTime || 0);
    });

    return sortedPdfs;
  } catch (error) {
    console.error("Error listing PDFs:", error);
    return [];
  }
};

/**
 * Delete a PDF file
 */
export const deletePdfFile = async (pdfUri: string): Promise<boolean> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(pdfUri);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(pdfUri, { idempotent: true });
      console.log("PDF deleted successfully:", pdfUri);
      return true;
    }

    console.log("PDF not found, nothing to delete:", pdfUri);
    return false;
  } catch (error) {
    console.error("Error deleting PDF:", error);
    throw error;
  }
};

const sanitizeFileName = (name: string): string => {
  const sanitized = name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .trim();

  const hasPdfExt = /\.pdf$/i.test(sanitized);
  return hasPdfExt ? sanitized : `${sanitized}.pdf`;
};

export const openPdf = async (
  pdfUri: string,
  fileName: string = "document.pdf",
): Promise<void> => {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(pdfUri);
    if (!fileInfo.exists) {
      throw new Error("PDF file not found");
    }

    // For iOS, use Sharing API with "open with" option
    // For Android, use IntentLauncher
    if (Platform.OS === "ios") {
      // On iOS, sharing will show "Open in..." options
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device");
      }

      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: `Open ${fileName}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      // For Android, use IntentLauncher to open with PDF viewer
      const contentUri = await FileSystem.getContentUriAsync(pdfUri);

      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1,
        type: "application/pdf",
      });
    }
  } catch (error) {
    console.error("Error opening PDF:", error);
    throw error;
  }
};
