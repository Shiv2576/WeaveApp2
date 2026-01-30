// =====================================================
// IMAGE EDITOR COMPONENT - Separate reusable component
// =====================================================
// This component handles all image editing functionality
// (rotate, crop, remove) in an isolated, reusable way
// =====================================================

import React, { useState, useEffect } from "react";
import {
  View, // Container for layout
  Text, // Text display
  StyleSheet, // Styling
  TouchableOpacity, // Pressable buttons
  Image, // Image display
  ScrollView, // Scrollable container
  Alert, // Native alerts
  ActivityIndicator, // Loading spinner
  Modal, // Full-screen overlay
  TextInput, // Text input for PDF name
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Icons

// =====================================================
// TYPE DEFINITIONS
// =====================================================

/**
 * Image Object Type
 * Defines the structure of image data passed to editor
 */
interface ImageItem {
  id: string; // Unique identifier for image
  uri: string; // File path or URI to image
  fileName: string; // Original filename
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  rotation?: number; // Rotation in degrees (0, 90, 180, 270)
}

/**
 * Component Props Type
 * Defines all props accepted by ImageEditorComponent
 */
interface ImageEditorProps {
  visible: boolean; // Whether modal is visible or hidden
  images: ImageItem[]; // Array of image objects to edit
  onClose: () => void; // Callback function when user cancels editing
  onGeneratePdf: (editedImages: ImageItem[], pdfName?: string) => void; // Updated: Accepts optional PDF name
  loading: boolean; // Whether currently loading/processing
}

// =====================================================
// IMAGE EDITOR COMPONENT
// =====================================================
/**
 * ImageEditorComponent
 *
 * A reusable image editor modal that allows users to:
 * - View multiple images in a scrollable list
 * - Rotate images 90 degrees at a time
 * - Crop images (ready for library integration)
 * - Remove unwanted images
 * - Generate PDF from edited images
 * - Cancel editing without saving changes
 *
 * @param {ImageEditorProps} props - Component props with proper typing
 * @returns {JSX.Element} - Modal component for image editing
 */
const ImageEditorComponent: React.FC<ImageEditorProps> = ({
  visible = false, // Default: modal hidden
  images = [], // Default: empty array
  onClose = () => {}, // Default: no-op function
  onGeneratePdf = () => {}, // Default: no-op function
  loading = false, // Default: not loading
}): JSX.Element => {
  // ===================================================
  // STATE MANAGEMENT
  // ===================================================

  // Store images being edited in this modal
  // Separate from parent state to preserve originals if user cancels
  const [editingImages, setEditingImages] = useState<ImageItem[]>([]);

  // State for PDF name input
  const [pdfName, setPdfName] = useState<string>("");

  // State to control PDF naming modal visibility
  const [showNameInput, setShowNameInput] = useState<boolean>(false);

  // Initialize editingImages when images prop changes
  useEffect(() => {
    // Only update if images array has content
    if (images && images.length > 0) {
      // Create a deep copy of images to avoid mutating parent state
      setEditingImages([...images]);
      // Generate a default PDF name based on date and image count
      const defaultName = generateDefaultPdfName(images.length);
      setPdfName(defaultName);
    } else {
      // Reset states when no images
      setPdfName("");
      setShowNameInput(false);
    }
  }, [images, visible]); // Re-initialize when modal opens or images change

  // ===================================================
  // PDF NAMING FUNCTIONS
  // ===================================================

  /**
   * Generates a default PDF name to prevent collisions
   * Format: "Document-YYYY-MM-DD-HHMMSS-#images.pdf"
   *
   * @param {number} imageCount - Number of images in PDF
   * @returns {string} - Generated PDF name
   */
  const generateDefaultPdfName = (imageCount: number): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `Document-${year}-${month}-${day}-${hours}${minutes}${seconds}-${imageCount}images.pdf`;
  };

  /**
   * Validates and sanitizes PDF filename
   * - Removes invalid characters
   * - Ensures .pdf extension
   * - Limits length
   *
   * @param {string} name - Input filename
   * @returns {string} - Sanitized filename
   */
  const sanitizePdfName = (name: string): string => {
    // Remove invalid characters for filenames
    let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

    // Remove leading/trailing spaces and dots
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, "");

    // Ensure it ends with .pdf (case-insensitive)
    if (!sanitized.toLowerCase().endsWith(".pdf")) {
      sanitized += ".pdf";
    }

    // Limit length to prevent issues
    const maxLength = 100;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // If name becomes empty after sanitization, use default
    if (sanitized === ".pdf" || sanitized.trim() === "") {
      return generateDefaultPdfName(editingImages.length);
    }

    return sanitized;
  };

  /**
   * Shows PDF naming modal for user input
   */
  const showPdfNameInput = (): void => {
    setShowNameInput(true);
  };

  /**
   * Handles PDF name confirmation
   * Validates input and generates PDF with custom name
   */
  const handleConfirmPdfName = (): void => {
    if (!pdfName.trim()) {
      Alert.alert("Error", "Please enter a PDF name");
      return;
    }

    const finalPdfName = sanitizePdfName(pdfName.trim());
    setPdfName(finalPdfName);
    setShowNameInput(false);

    // Generate PDF with the custom name
    generatePdfWithName(finalPdfName);
  };

  /**
   * Generates PDF with the specified name
   *
   * @param {string} fileName - The PDF filename to use
   */
  const generatePdfWithName = (fileName: string): void => {
    // Validate that at least one image exists
    if (editingImages.length === 0) {
      Alert.alert("No Images", "Please add at least one image to generate PDF");
      return;
    }

    // Call parent's PDF generation function with the filename
    onGeneratePdf(editingImages, fileName);
  };

  // ===================================================
  // IMAGE EDITING FUNCTIONS
  // ===================================================

  /**
   * Rotate a specific image by 90 degrees
   * Adds 90 to current rotation value (cycles: 0 > 90 > 180 > 270 > 0)
   *
   * @param {string} imageId - ID of image to rotate
   * @param {number} degrees - Degrees to rotate (typically 90)
   * @returns {void}
   */
  const handleRotateImage = (imageId: string, degrees: number): void => {
    setEditingImages((prevImages: ImageItem[]): ImageItem[] =>
      prevImages.map((img: ImageItem): ImageItem => {
        // Check if this is the image to rotate
        if (img.id === imageId) {
          // Calculate new rotation (0-360 degrees)
          const currentRotation = img.rotation || 0;
          const newRotation = (currentRotation + degrees) % 360;

          // Return image with updated rotation
          return {
            ...img, // Keep all existing properties
            rotation: newRotation, // Update rotation value
          };
        }
        // Return unchanged if not target image
        return img;
      }),
    );
  };

  /**
   * Handle image cropping
   * Currently displays alert - ready for crop library integration
   * Popular options: react-native-image-crop-picker, expo-image-manipulator
   *
   * @param {string} imageId - ID of image to crop
   * @returns {void}
   *
   * TODO: Replace Alert with actual crop library implementation
   * Example with react-native-image-crop-picker:
   * ImagePicker.openCropper({
   *   path: imageUri,
   *   width: 300,
   *   height: 400,
   * }).then(image => {
   *   updateImageUri(imageId, image.path);
   * });
   */
  const handleCropImage = (imageId: string): void => {
    // Show alert indicating where crop code goes
    Alert.alert(
      "Crop Image",
      "Integrate your crop library here to crop this image",
      [
        {
          text: "OK",
          onPress: (): void => {
            // TODO: Implement actual crop functionality
            console.log(`Crop image with ID: ${imageId}`);
          },
        },
      ],
    );
  };

  /**
   * Remove an image from the editing list
   * Shows confirmation alert before deletion
   *
   * @param {string} imageId - ID of image to remove
   * @returns {void}
   */
  const handleRemoveImage = (imageId: string): void => {
    // Show confirmation dialog
    Alert.alert("Remove Image", "Are you sure you want to remove this image?", [
      {
        text: "Cancel", // Cancel button
        style: "cancel",
      },
      {
        text: "Remove", // Confirm button
        style: "destructive", // Red text on iOS
        onPress: (): void => {
          // Filter out the image with matching ID
          setEditingImages((prevImages: ImageItem[]): ImageItem[] =>
            prevImages.filter((img: ImageItem): boolean => img.id !== imageId),
          );

          // Update PDF name if images count changed
          if (editingImages.length > 1) {
            const newDefaultName = generateDefaultPdfName(
              editingImages.length - 1,
            );
            setPdfName(newDefaultName);
          }
        },
      },
    ]);
  };

  /**
   * Handle PDF generation from edited images
   * Shows PDF naming modal first, then generates PDF
   *
   * @returns {void}
   */
  const handleGeneratePdf = (): void => {
    // Validate that at least one image exists
    if (editingImages.length === 0) {
      Alert.alert("No Images", "Please add at least one image to generate PDF");
      return;
    }

    // Show PDF naming modal
    showPdfNameInput();
  };

  /**
   * Handle closing the modal
   * User clicked Cancel without generating PDF
   * Clears editing state and closes modal
   *
   * @returns {void}
   */
  const handleClose = (): void => {
    // Clear editing images when closing
    setEditingImages([]);
    setPdfName("");
    setShowNameInput(false);
    // Call parent's onClose callback
    onClose();
  };

  // ===================================================
  // RENDER FUNCTIONS
  // ===================================================

  /**
   * Render a single image with editing controls
   * Shows image with rotation applied, plus edit buttons
   *
   * @param {ImageItem} item - Image object to render
   * @param {number} index - Index in list (position in array)
   * @returns {JSX.Element} - Image container with controls
   */
  const renderImageItem = (item: ImageItem, index: number): JSX.Element => (
    <View style={styles.imageContainer}>
      {/* ===== IMAGE DISPLAY ===== */}
      {/* Image with applied rotation transformation */}
      <Image
        source={{ uri: item.uri }} // Load from device path/URI
        style={[
          styles.image, // Base image styles
          {
            // Apply rotation as CSS transform
            // Rotation value in degrees (0, 90, 180, 270, etc.)
            transform: [{ rotate: `${item.rotation || 0}deg` }],
          },
        ]}
      />

      {/* ===== IMAGE NUMBER BADGE ===== */}
      {/* Show which image in sequence this is */}
      <View style={styles.imageBadge}>
        <Text style={styles.imageBadgeText}>{index + 1}</Text>
      </View>

      {/* ===== EDITING CONTROLS ===== */}
      {/* Buttons for rotate, crop, remove below image */}
      <View style={styles.controlsContainer}>
        {/* ROTATE BUTTON */}
        {/* Rotates image 90 degrees clockwise each time pressed */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={(): void => handleRotateImage(item.id, 90)}
          activeOpacity={0.7} // Visual feedback when pressed
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.controlButtonText}>Rotate</Text>
        </TouchableOpacity>

        {/* CROP BUTTON */}
        {/* Opens crop interface - ready for library integration */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={(): void => handleCropImage(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="crop" size={18} color="#fff" />
          <Text style={styles.controlButtonText}>Crop</Text>
        </TouchableOpacity>

        {/* REMOVE BUTTON */}
        {/* Deletes image from editing list after confirmation */}
        <TouchableOpacity
          style={[styles.controlButton, styles.removeButton]}
          onPress={(): void => handleRemoveImage(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color="#fff" />
          <Text style={styles.controlButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===================================================
  // PDF NAME INPUT MODAL
  // ===================================================
  const renderPdfNameModal = (): JSX.Element => (
    <Modal
      visible={showNameInput}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowNameInput(false)}
    >
      <View style={styles.nameModalOverlay}>
        <View style={styles.nameModalContainer}>
          <Text style={styles.nameModalTitle}>Name Your PDF</Text>
          <Text style={styles.nameModalSubtitle}>
            Enter a name for your PDF document
          </Text>

          <TextInput
            style={styles.nameInput}
            value={pdfName}
            onChangeText={setPdfName}
            placeholder="Enter PDF name"
            autoFocus={true}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={handleConfirmPdfName}
          />

          <Text style={styles.nameHint}>
            • Will automatically add .pdf extension{"\n"}• Invalid characters
            will be replaced{"\n"}• Max 100 characters
          </Text>

          <View style={styles.nameModalButtons}>
            <TouchableOpacity
              style={[styles.nameModalButton, styles.nameModalCancelButton]}
              onPress={() => setShowNameInput(false)}
            >
              <Text style={styles.nameModalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nameModalButton, styles.nameModalConfirmButton]}
              onPress={handleConfirmPdfName}
              disabled={!pdfName.trim()}
            >
              <Text style={styles.nameModalConfirmButtonText}>
                Generate PDF
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ===================================================
  // MAIN RENDER - Modal Component
  // ===================================================
  return (
    <>
      <Modal
        visible={visible} // Show/hide modal based on prop
        animationType="slide" // Slide up animation
        presentationStyle="fullScreen" // Full screen modal
        onRequestClose={handleClose} // Handle Android back button
      >
        <View style={styles.container}>
          {/* ===== HEADER ===== */}
          {/* Top section with title and close button */}
          <View style={styles.header}>
            {/* Close Button - left side */}
            {/* User can cancel editing without saving */}
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Larger touch area
            >
              <Text style={styles.headerButton}>Cancel</Text>
            </TouchableOpacity>

            {/* Modal Title */}
            <Text style={styles.headerTitle}>Edit Images</Text>

            {/* Image Count Badge */}
            {/* Shows how many images are being edited */}
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{editingImages.length}</Text>
            </View>
          </View>

          {/* ===== CONTENT AREA ===== */}
          {/* Scrollable list of images with editing controls */}
          {editingImages.length > 0 ? (
            // Images are present - show the list
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              showsVerticalScrollIndicator={true} // Show scroll bar
            >
              {/* Render each image in the list */}
              {editingImages.map((image: ImageItem, index: number) => (
                <View key={image.id}>{renderImageItem(image, index)}</View>
              ))}
            </ScrollView>
          ) : (
            // No images - show empty state
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No images to edit</Text>
              <Text style={styles.emptyStateSubtext}>
                Cancel and select images first
              </Text>
            </View>
          )}

          {/* ===== FOOTER ===== */}
          {/* Action buttons at bottom of modal */}
          <View style={styles.footer}>
            {/* CANCEL BUTTON */}
            {/* Closes modal without generating PDF */}
            <TouchableOpacity
              style={[styles.footerButton, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading} // Disable while loading
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            {/* GENERATE PDF BUTTON */}
            {/* Creates PDF from edited images and closes modal */}
            <TouchableOpacity
              style={[styles.footerButton, styles.generateButton]}
              onPress={handleGeneratePdf}
              disabled={loading || editingImages.length === 0} // Disable if no images or loading
            >
              {loading ? (
                // Show loading spinner while processing
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                // Show icon and text when idle
                <>
                  <Ionicons name="document-text" size={20} color="#fff" />
                  <Text style={styles.generateButtonText}>Generate PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PDF Name Input Modal */}
      {renderPdfNameModal()}
    </>
  );
};

// =====================================================
// STYLES - All styling for the editor component
// =====================================================
const styles = StyleSheet.create({
  // ===== MAIN CONTAINER =====
  container: {
    flex: 1, // Take full screen
    backgroundColor: "#f5f5f5", // Light gray background
  },

  // ===== HEADER =====
  header: {
    flexDirection: "row", // Horizontal layout
    justifyContent: "space-between", // Space items apart
    alignItems: "center", // Center vertically
    paddingHorizontal: 16, // Horizontal padding
    paddingTop: 16, // Top padding
    paddingBottom: 12, // Bottom padding
    backgroundColor: "#fff", // White background
    borderBottomWidth: 1, // Bottom border
    borderBottomColor: "#e0e0e0", // Light gray border
  },

  headerButton: {
    fontSize: 16, // Standard text size
    color: "#007AFF", // iOS blue
    fontWeight: "600", // Semi-bold
  },

  headerTitle: {
    fontSize: 18, // Larger text
    fontWeight: "700", // Bold
    color: "#333", // Dark gray text
  },

  countBadge: {
    backgroundColor: "#007AFF", // Blue background
    paddingHorizontal: 10, // Horizontal padding
    paddingVertical: 6, // Vertical padding
    borderRadius: 12, // Pill-shaped
  },

  countBadgeText: {
    color: "#fff", // White text
    fontWeight: "700", // Bold
    fontSize: 14,
  },

  // ===== SCROLL VIEW =====
  scrollView: {
    flex: 1, // Take remaining space
  },

  scrollViewContent: {
    padding: 12, // Padding around content
  },

  // ===== IMAGE CONTAINER =====
  imageContainer: {
    marginBottom: 16, // Space between images
    borderRadius: 12, // Rounded corners
    overflow: "hidden", // Clip rounded corners
    backgroundColor: "#fff", // White background
    elevation: 2, // Android shadow
    shadowColor: "#000", // iOS shadow color
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  // ===== IMAGE DISPLAY =====
  image: {
    width: "100%", // Full width
    height: 280, // Fixed height
    resizeMode: "cover", // Cover container, maintain aspect ratio
  },

  imageBadge: {
    position: "absolute", // Overlay on image
    top: 12, // Distance from top
    right: 12, // Distance from right
    width: 32, // Circle size
    height: 32,
    borderRadius: 16, // Perfect circle
    backgroundColor: "rgba(0, 0, 0, 0.6)", // Semi-transparent black
    justifyContent: "center", // Center content
    alignItems: "center",
  },

  imageBadgeText: {
    color: "#fff", // White text
    fontWeight: "700", // Bold
    fontSize: 16,
  },

  // ===== EDITING CONTROLS =====
  controlsContainer: {
    flexDirection: "row", // Buttons in a row
    padding: 12, // Padding around buttons
    gap: 8, // Space between buttons
    backgroundColor: "#f9f9f9", // Light gray background
  },

  controlButton: {
    flex: 1, // Equal width
    flexDirection: "row", // Icon and text in row
    alignItems: "center", // Center vertically
    justifyContent: "center", // Center horizontally
    backgroundColor: "#2196F3", // Material blue
    paddingVertical: 10, // Vertical padding
    borderRadius: 8, // Rounded corners
    gap: 6, // Space between icon and text
  },

  controlButtonText: {
    color: "#fff", // White text
    fontWeight: "600", // Semi-bold
    fontSize: 12, // Small text
  },

  removeButton: {
    backgroundColor: "#FF5722", // Red-orange for delete
  },

  // ===== EMPTY STATE =====
  emptyState: {
    flex: 1, // Take available space
    justifyContent: "center", // Center vertically
    alignItems: "center", // Center horizontally
    paddingVertical: 40,
  },

  emptyStateText: {
    fontSize: 16, // Standard text
    fontWeight: "600", // Semi-bold
    color: "#999", // Light gray text
    marginTop: 12, // Space above text
  },

  emptyStateSubtext: {
    fontSize: 14,
    color: "#bbb", // Lighter gray
    marginTop: 4,
  },

  // ===== FOOTER =====
  footer: {
    flexDirection: "row", // Buttons side by side
    padding: 16, // Padding around buttons
    gap: 12, // Space between buttons
    backgroundColor: "#fff", // White background
    borderTopWidth: 1, // Top border
    borderTopColor: "#e0e0e0", // Light gray border
  },

  footerButton: {
    flex: 1, // Equal width
    flexDirection: "row", // Icon and text in row
    alignItems: "center", // Center vertically
    justifyContent: "center", // Center horizontally
    paddingVertical: 14, // Vertical padding
    borderRadius: 10, // Rounded corners
    gap: 8, // Space between icon and text
  },

  cancelButton: {
    backgroundColor: "#e0e0e0", // Light gray
  },

  cancelButtonText: {
    color: "#333", // Dark text
    fontSize: 16, // Standard text
    fontWeight: "600", // Semi-bold
  },

  generateButton: {
    backgroundColor: "#4CAF50", // Material green
  },

  generateButtonText: {
    color: "#fff", // White text
    fontSize: 16,
    fontWeight: "600",
  },

  // ===== PDF NAME MODAL STYLES =====
  nameModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  nameModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  nameModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },

  nameModalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },

  nameInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#f9f9f9",
  },

  nameHint: {
    fontSize: 12,
    color: "#888",
    marginBottom: 20,
    lineHeight: 18,
  },

  nameModalButtons: {
    flexDirection: "row",
    gap: 12,
  },

  nameModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  nameModalCancelButton: {
    backgroundColor: "#e0e0e0",
  },

  nameModalCancelButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },

  nameModalConfirmButton: {
    backgroundColor: "#4CAF50",
  },

  nameModalConfirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

// =====================================================
// EXPORT - Make component available for use
// =====================================================
export default ImageEditorComponent;
