export interface ImageItem {
  id: string;
  uri: string;
  width: number;
  height: number;
  fileName: string;
}

export interface CropData {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface ResizeData {
  width: number;
  height: number;
}

export interface EditedImage extends ImageItem {
  cropData?: CropData;
  resizeData?: ResizeData;
}
