// =====================================================
// SAVED PDFS COMPONENT - Display previously generated PDFs
// =====================================================
// This component shows a list of all saved PDFs with
// options to share, delete, and view PDF details
// =====================================================

import React, { useState, useEffect } from "react";
import {
  View, // Container for layout
  Text, // Text display
  StyleSheet, // Styling
  TouchableOpacity, // Pressable buttons
  FlatList, // List rendering
  Alert, // Native alerts
  ActivityIndicator, // Loading spinner
  Platform, // For platform-specific code
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Icons
import * as FileSystem from "expo-file-system"; // For file operations
import EncodingType from "expo-file-system";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

/**
 * PDF Object Type
 * Defines the structure of PDF data
 */
interface PDFItem {
  id: string; // Unique identifier
  name: string; // PDF filename
  date: string; // Creation date
  size: string; // File size
  uri?: string; // Optional: PDF file URI/path
}

/**
 * Component Props Type
 * Defines all props accepted by SavedPdfsComponent
 */
interface SavedPdfsProps {
  pdfs: PDFItem[]; // Array of saved PDFs
  onShare: (pdfId: string, pdfUri: string | undefined) => Promise<void>; // Callback to share PDF
  onDelete: (pdfId: string) => void; // Callback to delete PDF
  loading?: boolean; // Whether currently loading
  onSaveToDevice?: (pdfUri: string, pdfName: string) => Promise<void>; // Optional: Save to device callback
}

// =====================================================
// SAVED PDFS COMPONENT
// =====================================================
/**
 * SavedPdfsComponent
 *
 * Displays a list of previously generated and saved PDFs
 * with the following features:
 * - View all saved PDFs with metadata (name, date, size)
 * - Share PDFs to other apps
 * - Save PDFs to device storage with proper filenames
 * - Delete PDFs with confirmation
 * - Empty state when no PDFs exist
 * - Loading indicator during async operations
 *
 * @param {SavedPdfsProps} props - Component props with proper typing
 * @returns {JSX.Element} - List of saved PDFs
 */
const SavedPdfsComponent: React.FC<SavedPdfsProps> = ({
  pdfs = [], // Default: empty array
  onShare = async () => {}, // Default: no-op function
  onDelete = () => {}, // Default: no-op function
  loading = false, // Default: not loading
  onSaveToDevice, // Optional: parent's save function
}): JSX.Element => {
  // ===================================================
  // STATE MANAGEMENT
  // ===================================================

  // Track which PDF is currently being shared (for loading state)
  const [sharingPdfId, setSharingPdfId] = useState<string | null>(null);
  // Track which PDF is currently being saved (for loading state)
  const [savingPdfId, setSavingPdfId] = useState<string | null>(null);

  // ===================================================
  // HANDLER FUNCTIONS
  // ===================================================

  /**
   * Handle sharing a PDF
   * Shows loading state and calls parent's share callback
   *
   * @param {PDFItem} pdf - PDF object to share
   * @returns {Promise<void>}
   */
  const handleSharePdf = async (pdf: PDFItem): Promise<void> => {
    // Set loading state for this specific PDF
    setSharingPdfId(pdf.id);

    try {
      // Call parent's share callback with PDF data
      await onShare(pdf.id, pdf.uri);
    } catch (error) {
      // Error handling is done in parent component
      console.error("Share PDF error:", error);
    } finally {
      // Clear loading state
      setSharingPdfId(null);
    }
  };

  /**
   * Handle saving a PDF to device storage
   * Saves the PDF with the actual filename shown in the list
   *
   * @param {PDFItem} pdf - PDF object to save
   * @returns {Promise<void>}
   */
  const handleSavePdfToDevice = async (pdf: PDFItem): Promise<void> => {
    if (!pdf.uri) {
      Alert.alert("Error", "PDF file not found");
      return;
    }

    // Set loading state for this specific PDF
    setSavingPdfId(pdf.id);

    try {
      if (onSaveToDevice) {
        // Use parent's save function if provided
        await onSaveToDevice(pdf.uri, pdf.name);
      } else {
        // Fallback: Use our own save implementation
        await savePdfToDevice(pdf.uri, pdf.name);
      }

      Alert.alert("Success", `PDF saved as "${pdf.name}"`);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save PDF");
      console.error("Save PDF error:", error);
    } finally {
      // Clear loading state
      setSavingPdfId(null);
    }
  };

  /**
   * Save PDF to device storage using expo-file-system
   *
   * @param {string} pdfUri - URI of the PDF file
   * @param {string} pdfName - Name to save the file as
   * @returns {Promise<string>} - Path where file was saved
   */
  const savePdfToDevice = async (
    pdfUri: string,
    pdfName: string,
  ): Promise<string> => {
    try {
      // Get the PDF content from the URI
      const pdfContent = await FileSystem.readAsStringAsync(pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create directory if it doesn't exist
      const directory = `${FileSystem.Directory}PDFs/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

      // Create the full file path
      const fileUri = `${directory}${pdfName}`;

      // Save the PDF file
      await FileSystem.writeAsStringAsync(fileUri, pdfContent, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Check if file was saved successfully
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        console.log("PDF saved to:", fileUri);
        return fileUri;
      } else {
        throw new Error("Failed to save PDF file");
      }
    } catch (error) {
      console.error("Save PDF error:", error);
      throw error;
    }
  };

  /**
   * Handle deleting a PDF
   * Shows confirmation alert before deletion
   *
   * @param {PDFItem} pdf - PDF object to delete
   * @returns {void}
   */
  const handleDeletePdf = (pdf: PDFItem): void => {
    // Show confirmation dialog
    Alert.alert(
      "Delete PDF", // Alert title
      `Are you sure you want to delete "${pdf.name}"?`, // Alert message with filename
      [
        {
          text: "Cancel", // Cancel button
          style: "cancel",
        },
        {
          text: "Delete", // Confirm delete button
          style: "destructive", // Red text on iOS
          onPress: (): void => {
            // Call parent's delete callback
            onDelete(pdf.id);
          },
        },
      ],
    );
  };

  /**
   * Get file icon based on file name or type
   *
   * @param {string} fileName - The name of the file
   * @returns {JSX.Element} - Icon component
   */
  const getFileIcon = (fileName: string): JSX.Element => {
    if (
      fileName.toLowerCase().includes("invoice") ||
      fileName.toLowerCase().includes("bill")
    ) {
      return <Ionicons name="receipt" size={32} color="#FF5722" />;
    } else if (fileName.toLowerCase().includes("report")) {
      return <Ionicons name="bar-chart" size={32} color="#2196F3" />;
    } else if (
      fileName.toLowerCase().includes("contract") ||
      fileName.toLowerCase().includes("agreement")
    ) {
      return <Ionicons name="document-lock" size={32} color="#4CAF50" />;
    } else if (fileName.toLowerCase().includes("receipt")) {
      return <Ionicons name="card" size={32} color="#FF9800" />;
    } else {
      return <Ionicons name="document-text" size={32} color="#FF5722" />;
    }
  };

  // ===================================================
  // RENDER FUNCTIONS
  // ===================================================

  /**
   * Render a single PDF list item
   * Shows PDF icon, name, date, size, and action buttons
   *
   * @param {PDFItem} item - PDF object to render
   * @returns {JSX.Element} - PDF list item
   */
  const renderPdfItem = (item: PDFItem): JSX.Element => (
    <View style={styles.pdfItem}>
      {/* ===== PDF ICON CONTAINER ===== */}
      {/* Dynamic background with appropriate document icon */}
      <View
        style={[
          styles.pdfIconContainer,
          {
            backgroundColor: item.name.toLowerCase().includes("invoice")
              ? "#ffe0d0"
              : item.name.toLowerCase().includes("report")
                ? "#e3f2fd"
                : item.name.toLowerCase().includes("contract")
                  ? "#e8f5e9"
                  : item.name.toLowerCase().includes("receipt")
                    ? "#fff3e0"
                    : "#ffe0d0",
          },
        ]}
      >
        {getFileIcon(item.name)}
      </View>

      {/* ===== PDF INFORMATION SECTION ===== */}
      {/* PDF name, date, and size in text format */}
      <View style={styles.pdfInfoContainer}>
        {/* PDF filename - truncated if too long */}
        <Text style={styles.pdfName} numberOfLines={1}>
          {item.name}
        </Text>

        {/* PDF creation date */}
        <Text style={styles.pdfDate}>{item.date}</Text>

        {/* PDF file size */}
        <Text style={styles.pdfSize}>{item.size}</Text>
      </View>

      {/* ===== ACTION BUTTONS SECTION ===== */}
      {/* Share, save, and delete buttons for this PDF */}
      <View style={styles.pdfActionsContainer}>
        {/* SAVE BUTTON - Save to device storage */}
        <TouchableOpacity
          style={styles.pdfActionButton}
          onPress={(): Promise<void> => handleSavePdfToDevice(item)}
          disabled={loading || savingPdfId === item.id}
        >
          {savingPdfId === item.id ? (
            <ActivityIndicator color="#4CAF50" size="small" />
          ) : (
            <Ionicons name="download-outline" size={20} color="#4CAF50" />
          )}
        </TouchableOpacity>

        {/* SHARE BUTTON */}
        {/* Opens native share sheet */}
        <TouchableOpacity
          style={styles.pdfActionButton}
          onPress={(): Promise<void> => handleSharePdf(item)}
          disabled={loading || sharingPdfId === item.id} // Disable while sharing
        >
          {/* Show loading spinner or share icon */}
          {sharingPdfId === item.id ? (
            <ActivityIndicator color="#2196F3" size="small" />
          ) : (
            <Ionicons name="share-outline" size={20} color="#2196F3" />
          )}
        </TouchableOpacity>

        {/* DELETE BUTTON */}
        {/* Shows confirmation before deleting */}
        <TouchableOpacity
          style={styles.pdfActionButton}
          onPress={(): void => handleDeletePdf(item)}
          disabled={loading}
        >
          <Ionicons name="trash-outline" size={20} color="#FF5722" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===================================================
  // MAIN RENDER
  // ===================================================

  return (
    <View style={styles.container}>
      {/* ===== SECTION HEADER ===== */}
      {/* Title and PDF count badge */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Saved PDFs</Text>
          <Text style={styles.sectionSubtitle}>
            Tap to manage your documents
          </Text>
        </View>

        {/* Badge showing number of PDFs */}
        <View style={styles.pdfCountBadge}>
          <Text style={styles.pdfCountText}>{pdfs.length}</Text>
        </View>
      </View>

      {/* ===== CONTENT AREA ===== */}
      {/* Show empty state or PDF list */}
      {pdfs.length === 0 ? (
        // EMPTY STATE - No PDFs saved yet
        <View style={styles.emptyStateContainer}>
          <Ionicons name="document-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>No PDFs yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Create your first PDF using the editor
          </Text>
        </View>
      ) : (
        // PDF LIST - Show all saved PDFs
        <FlatList
          data={pdfs} // Array of PDF objects
          keyExtractor={(item: PDFItem): string => item.id} // Unique key for each item
          renderItem={({ item }): JSX.Element => renderPdfItem(item)} // Render function for each item
          scrollEnabled={true} // Enable scrolling for long lists
          contentContainerStyle={styles.pdfListContent}
          showsVerticalScrollIndicator={true} // Show scroll indicator
        />
      )}
    </View>
  );
};

// =====================================================
// STYLES - All styling for the component
// =====================================================
const styles = StyleSheet.create({
  // ===== MAIN CONTAINER =====
  container: {
    backgroundColor: "#fff", // White background
    paddingTop: 16, // Top padding
    flex: 1, // Take available space
  },

  // ===== SECTION HEADER =====
  sectionHeader: {
    flexDirection: "row", // Horizontal layout
    justifyContent: "space-between", // Space items apart
    alignItems: "center", // Center vertically
    paddingHorizontal: 16, // Horizontal padding
    marginBottom: 12, // Space below header
  },

  sectionTitleContainer: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 18, // Large text size
    fontWeight: "700", // Bold
    color: "#333", // Dark text
  },

  sectionSubtitle: {
    fontSize: 12, // Small text size
    color: "#666", // Gray text
    marginTop: 2,
  },

  pdfCountBadge: {
    backgroundColor: "#2196F3", // Blue background
    paddingHorizontal: 10, // Horizontal padding
    paddingVertical: 6, // Vertical padding
    borderRadius: 12, // Pill-shaped
    minWidth: 32,
    alignItems: "center",
  },

  pdfCountText: {
    fontSize: 14, // Standard text size
    fontWeight: "700", // Bold
    color: "#fff", // White text
  },

  // ===== EMPTY STATE =====
  emptyStateContainer: {
    flex: 1, // Take available space
    justifyContent: "center", // Center vertically
    alignItems: "center", // Center horizontally
    paddingVertical: 40, // Vertical padding
  },

  emptyStateText: {
    fontSize: 16, // Standard text size
    fontWeight: "600", // Semi-bold
    color: "#999", // Light gray text
    marginTop: 12, // Space above text
  },

  emptyStateSubtext: {
    fontSize: 14, // Small text size
    color: "#bbb", // Lighter gray text
    marginTop: 4, // Space above text
  },

  pdfListContent: {
    paddingHorizontal: 12, // Horizontal padding
    paddingBottom: 12, // Bottom padding
  },

  // ===== PDF LIST ITEM =====
  pdfItem: {
    flexDirection: "row", // Horizontal layout
    backgroundColor: "#f9f9f9", // Very light gray background
    borderRadius: 12, // Rounded corners
    padding: 12, // Internal padding
    marginBottom: 8, // Space between items
    alignItems: "center", // Center vertically
    borderWidth: 1, // Border
    borderColor: "#e0e0e0", // Light gray border
    elevation: 1, // Android shadow
    shadowColor: "#000", // iOS shadow color
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },

  // ===== PDF ICON CONTAINER =====
  pdfIconContainer: {
    width: 50, // Fixed width
    height: 50, // Fixed height (square)
    borderRadius: 8, // Rounded corners
    justifyContent: "center", // Center content vertically
    alignItems: "center", // Center content horizontally
    marginRight: 12, // Space before text
  },

  // ===== PDF INFORMATION =====
  pdfInfoContainer: {
    flex: 1, // Take remaining space
  },

  pdfName: {
    fontSize: 14, // Standard text size
    fontWeight: "600", // Semi-bold
    color: "#333", // Dark text
  },

  pdfDate: {
    fontSize: 12, // Small text size
    color: "#888", // Medium gray text
    marginTop: 2, // Space above text
  },

  pdfSize: {
    fontSize: 12, // Small text size
    color: "#aaa", // Light gray text
    marginTop: 2, // Space above text
  },

  // ===== ACTION BUTTONS =====
  pdfActionsContainer: {
    flexDirection: "row", // Buttons side by side
    gap: 8, // Space between buttons
  },

  pdfActionButton: {
    padding: 8, // Internal padding
    borderRadius: 6, // Rounded corners
    backgroundColor: "#f0f0f0", // Light gray background
    justifyContent: "center", // Center content
    alignItems: "center", // Center content
    minWidth: 40, // Minimum width for touch area
    minHeight: 40, // Minimum height for touch area
  },
});

// =====================================================
// EXPORT - Make component available for use
// =====================================================
export default SavedPdfsComponent;
