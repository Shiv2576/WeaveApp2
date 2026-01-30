import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useImagePicker } from "./hooks/imagePicker";
import {
  generatePdf,
  sharePdf,
  renamePdf,
  listAllPdfs,
  deletePdfFile,
  getPdfFileInfo,
  openPdf,
} from "./services/pdfService";

import { rotateImage } from "./services/imageService";

const { width } = Dimensions.get("window");

export default function App() {
  const [images, setImages] = useState<any[]>([]);
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<"editor" | "gallery">("editor");
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [pdfToRename, setPdfToRename] = useState<{
    uri: string;
    currentName: string;
    newName: string;
  } | null>(null);
  const [renaming, setRenaming] = useState(false);

  const {
    images: pickedImages,
    pickImages,
    setImages: setPickedImages,
  } = useImagePicker();

  useEffect(() => {
    loadPdfs();
  }, []);

  useEffect(() => {
    if (pickedImages && pickedImages.length > 0) {
      setImages([
        ...images,
        ...pickedImages.map((img: any) => ({
          uri: img.uri,
          id: Date.now().toString() + Math.random(),
          width: img.width,
          height: img.height,
          fileName: img.fileName || `image_${Date.now()}.jpg`,
        })),
      ]);
      setPickedImages([]);
    }
  }, [pickedImages]);

  const loadPdfs = async () => {
    try {
      const pdfList = await listAllPdfs();
      setPdfs(pdfList);
    } catch (error) {
      console.error("Error loading PDFs:", error);
    }
  };

  const handleAddImage = async () => {
    try {
      await pickImages();
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id));
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) {
      Alert.alert("Error", "Please add at least one image");
      return;
    }

    console.log("=== GENERATING PDF ===");
    console.log("Number of images:", images.length);

    setLoading(true);
    try {
      // Generate PDF with a temporary name
      const tempPdfName = `temp_${Date.now()}.pdf`;
      console.log("Generating temporary PDF:", tempPdfName);

      const pdfUri = await generatePdf(images, tempPdfName);
      console.log("PDF generated at:", pdfUri);

      // Get file info for the generated PDF
      const pdfInfo = await getPdfFileInfo(pdfUri);
      console.log("PDF info:", pdfInfo);

      // Show rename modal with the generated PDF
      setPdfToRename({
        uri: pdfUri,
        currentName: tempPdfName,
        newName: `document_${new Date().toISOString().slice(0, 10)}.pdf`,
      });
      setRenameModalVisible(true);

      // Clear images
      setImages([]);
    } catch (error: any) {
      console.error("PDF generation failed:", error);
      Alert.alert(
        "Error ❌",
        `Failed to generate PDF:\n\n${error.message || "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRenamePdf = async () => {
    if (!pdfToRename || !pdfToRename.newName.trim()) {
      Alert.alert("Error", "Please enter a valid PDF name");
      return;
    }

    setRenaming(true);
    try {
      console.log(
        "Renaming PDF:",
        pdfToRename.currentName,
        "→",
        pdfToRename.newName,
      );

      // Rename the PDF
      const newUri = await renamePdf(pdfToRename.uri, pdfToRename.newName);
      console.log("PDF renamed to:", newUri);

      // Close modal
      setRenameModalVisible(false);
      setPdfToRename(null);

      // Refresh PDF list
      setTimeout(() => {
        loadPdfs();
        setCurrentTab("gallery");
      }, 500);

      Alert.alert(
        "Success ✅",
        `PDF saved as "${pdfToRename.newName}"!\n\nCheck the Gallery tab to view, share, or delete it.`,
        [
          {
            text: "Open Gallery",
            onPress: () => setCurrentTab("gallery"),
          },
          {
            text: "Share Now",
            onPress: () => handleSharePdf(newUri, pdfToRename.newName),
          },
          { text: "OK", style: "default" },
        ],
      );
    } catch (error: any) {
      console.error("Rename failed:", error);
      Alert.alert(
        "Error ❌",
        `Failed to rename PDF:\n\n${error.message || "Unknown error"}`,
      );
    } finally {
      setRenaming(false);
    }
  };

  const handleOpenPdf = async (pdfUri: string, fileName: string) => {
    try {
      await openPdf(pdfUri, fileName); // Use the new open function
    } catch (error: any) {
      console.error("Error opening PDF:", error);
      Alert.alert("Error", `Failed to open PDF: ${error.message}`);
    }
  };

  const handleSharePdf = async (pdfUri: string, fileName: string) => {
    try {
      await sharePdf(pdfUri, fileName);
    } catch (error) {
      Alert.alert("Error", "Failed to share PDF");
    }
  };

  const handleDeletePdf = async (pdfUri: string, fileName: string) => {
    Alert.alert(
      "Delete PDF",
      `Are you sure you want to delete "${fileName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePdfFile(pdfUri);
              loadPdfs();
              Alert.alert("Success", "PDF deleted successfully");
            } catch (error) {
              Alert.alert("Error", "Failed to delete PDF");
            }
          },
        },
      ],
    );
  };

  const handleDiscardPdf = () => {
    Alert.alert(
      "Discard PDF",
      "Are you sure you want to discard this PDF without saving?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setRenameModalVisible(false);
            setPdfToRename(null);
            Alert.alert("Discarded", "PDF was not saved.");
          },
        },
      ],
    );
  };

  const handleRotateImage = async (id: string, degrees: number) => {
    try {
      // Find the image
      const imageIndex = images.findIndex((img) => img.id === id);
      if (imageIndex === -1) return;

      const imageToRotate = images[imageIndex];

      // Rotate the image
      const rotatedImage = await rotateImage(imageToRotate, degrees);

      // Update the image with new URI
      const updatedImages = [...images];
      updatedImages[imageIndex] = {
        ...rotatedImage,
        id: imageToRotate.id,
        fileName: imageToRotate.fileName,
      };

      setImages(updatedImages);
    } catch (error) {
      console.error("Error rotating image:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Weave</Text>
        <Text style={styles.subtitle}>Convert images to PDF</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, currentTab === "editor" && styles.activeTab]}
          onPress={() => setCurrentTab("editor")}
        >
          <Ionicons
            name="images-outline"
            size={20}
            color={currentTab === "editor" ? "#000000" : "#666666"}
          />
          <Text
            style={[
              styles.tabText,
              currentTab === "editor" && styles.activeTabText,
            ]}
          >
            Editor
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentTab === "gallery" && styles.activeTab]}
          onPress={() => setCurrentTab("gallery")}
        >
          <Ionicons
            name="folder-outline"
            size={20}
            color={currentTab === "gallery" ? "#000000" : "#666666"}
          />
          <Text
            style={[
              styles.tabText,
              currentTab === "gallery" && styles.activeTabText,
            ]}
          >
            Gallery
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {currentTab === "editor" ? (
          <>
            {/* Stats Bar */}
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>
                {images.length} image{images.length !== 1 ? "s" : ""} selected
              </Text>
              {images.length > 0 && (
                <TouchableOpacity onPress={() => setImages([])}>
                  <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Add Image Button */}
            <TouchableOpacity style={styles.addButton} onPress={handleAddImage}>
              <Ionicons name="add" size={22} color="white" />
              <Text style={styles.addButtonText}>Add Images</Text>
            </TouchableOpacity>

            {/* Images Grid */}
            {images.length > 0 ? (
              <FlatList
                data={images}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <View style={styles.imageItem}>
                    <View style={styles.imageNumber}>
                      <Text style={styles.imageNumberText}>{index + 1}</Text>
                    </View>

                    <Image
                      source={{ uri: item.uri }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />

                    {/* Simple Rotate Button in top-right corner */}
                    <TouchableOpacity
                      onPress={() => handleRotateImage(item.id, 90)}
                      style={styles.rotateButton}
                    >
                      <Ionicons name="refresh" size={20} color="white" />
                    </TouchableOpacity>

                    {/* Remove Button */}
                    <TouchableOpacity
                      onPress={() => handleRemoveImage(item.id)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close" size={20} color="white" />
                    </TouchableOpacity>

                    <Text style={styles.imageName} numberOfLines={1}>
                      {item.fileName || `Image ${index + 1}`}
                    </Text>
                  </View>
                )}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.imagesContainer}
                scrollEnabled={true}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="image-outline" size={64} color="#CCCCCC" />
                <Text style={styles.emptyTitle}>No Images</Text>
                <Text style={styles.emptySubtitle}>
                  Tap "Add Images" to select photos{"\n"}from your gallery
                </Text>
              </View>
            )}

            {/* Generate PDF Button */}
            <View style={styles.bottomContainer}>
              <TouchableOpacity
                style={[
                  styles.generateButton,
                  (images.length === 0 || loading) && styles.disabledButton,
                ]}
                onPress={handleGeneratePdf}
                disabled={images.length === 0 || loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="document-text-outline"
                      size={22}
                      color="white"
                    />
                    <Text style={styles.generateButtonText}>
                      Generate PDF{" "}
                      {images.length > 0 ? `(${images.length})` : ""}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* PDFs Gallery Header */}
            <View style={styles.galleryHeader}>
              <Text style={styles.galleryTitle}>Your PDFs ({pdfs.length})</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={loadPdfs}>
                <Ionicons name="refresh" size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            {/* PDFs List */}
            {pdfs.length > 0 ? (
              <FlatList
                data={pdfs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.pdfItem}>
                    <View style={styles.pdfIconContainer}>
                      <Ionicons
                        name="document-text"
                        size={32}
                        color="#FF3B30"
                      />
                    </View>
                    <View style={styles.pdfInfo}>
                      <Text style={styles.pdfName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.pdfMeta}>
                        {item.size} • Created: {item.date}
                      </Text>
                    </View>
                    <View style={styles.pdfActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleOpenPdf(item.uri, item.name)}
                      >
                        <Ionicons
                          name="eye-outline"
                          size={22}
                          color="#007AFF"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleSharePdf(item.uri, item.name)}
                      >
                        <Ionicons
                          name="share-outline"
                          size={22}
                          color="#34C759"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDeletePdf(item.uri, item.name)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={22}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={64} color="#CCCCCC" />
                <Text style={styles.emptyTitle}>No PDFs Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Generate your first PDF in the Editor tab{"\n"}
                  Your PDFs will appear here automatically
                </Text>
                <TouchableOpacity
                  style={styles.switchTabButton}
                  onPress={() => setCurrentTab("editor")}
                >
                  <Text style={styles.switchTabButtonText}>Go to Editor</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Rename PDF Modal */}
      <Modal
        visible={renameModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !renaming && setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save Your PDF</Text>
              <TouchableOpacity
                onPress={() => !renaming && setRenameModalVisible(false)}
                disabled={renaming}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.pdfPreview}>
                <Ionicons name="document-text" size={48} color="#FF3B30" />
                <Text style={styles.pdfPreviewText}>
                  PDF Generated Successfully!
                </Text>
                <Text style={styles.pdfPreviewSubtext}>
                  {images.length} image{images.length !== 1 ? "s" : ""}{" "}
                  converted
                </Text>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>PDF File Name</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={pdfToRename?.newName || ""}
                    onChangeText={(text) =>
                      setPdfToRename(
                        pdfToRename ? { ...pdfToRename, newName: text } : null,
                      )
                    }
                    placeholder="Enter PDF name"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!renaming}
                  />
                  {pdfToRename?.newName && !renaming && (
                    <TouchableOpacity
                      onPress={() =>
                        setPdfToRename(
                          pdfToRename ? { ...pdfToRename, newName: "" } : null,
                        )
                      }
                      style={styles.clearButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.inputHint}>
                  File will be saved as:{" "}
                  {pdfToRename?.newName.endsWith(".pdf")
                    ? pdfToRename.newName
                    : `${pdfToRename?.newName || ""}.pdf`}
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={handleDiscardPdf}
                  disabled={renaming}
                >
                  <Text style={styles.cancelButtonText}>Discard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleRenamePdf}
                  disabled={renaming}
                >
                  {renaming ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={20} color="white" />
                      <Text style={styles.saveButtonText}>Save PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ... (keep all your existing styles, add these new ones:)

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  modalContent: {
    padding: 20,
  },
  pdfPreview: {
    alignItems: "center",
    marginBottom: 24,
  },
  pdfPreviewText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginTop: 12,
    marginBottom: 4,
  },
  pdfPreviewSubtext: {
    fontSize: 14,
    color: "#666",
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FAFAFA",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  inputHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  cancelButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#000000",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  // Keep all your existing styles below...
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    backgroundColor: "#000000",
    paddingVertical: Platform.OS === "ios" ? 50 : 30,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F8F8F8",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: "#000000",
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666666",
  },
  activeTabText: {
    color: "#000000",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  statsText: {
    fontSize: 14,
    color: "#666666",
  },
  clearText: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "500",
  },
  addButton: {
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  imagesContainer: {
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  imageItem: {
    width: (width - 40) / 2,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F8F8F8",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    position: "relative",
  },
  imageNumber: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  imageNumberText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  thumbnail: {
    width: "100%",
    height: 150,
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  imageName: {
    fontSize: 12,
    color: "#666666",
    padding: 8,
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 70,
    left: 16,
    right: 16,
  },
  generateButton: {
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 10,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.5,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
  },
  refreshButton: {
    padding: 8,
  },
  pdfItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  pdfIconContainer: {
    marginRight: 16,
  },
  pdfInfo: {
    flex: 1,
  },
  pdfName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  pdfMeta: {
    fontSize: 12,
    color: "#666666",
  },
  pdfActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  switchTabButton: {
    backgroundColor: "#000000",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  switchTabButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  rotateButton: {
    position: "absolute",
    bottom: 35,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
