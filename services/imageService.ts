/*

cropImage

rotateImage

*/

import * as ImageManipulator from "expo-image-manipulator";
import { ImageItem, CropData, EditedImage } from "../types";

/**
 * Simple crop function using existing types
 */
export const cropImage = async (
  imageItem: ImageItem,
  cropData: CropData,
): Promise<EditedImage> => {
  const result = await ImageManipulator.manipulateAsync(
    imageItem.uri,
    [{ crop: cropData }],
    {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    ...imageItem,
    uri: result.uri,
    width: result.width,
    height: result.height,
    cropData,
  };
};

/**
 * Simple rotate function
 */
export const rotateImage = async (
  imageItem: ImageItem,
  degrees: number, // Positive = clockwise, negative = counter-clockwise
): Promise<EditedImage> => {
  const result = await ImageManipulator.manipulateAsync(
    imageItem.uri,
    [{ rotate: degrees }],
    {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    ...imageItem,
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
};
