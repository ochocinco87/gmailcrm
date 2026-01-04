/**
 * Camera & Screenshot Service
 * Handles taking photos and screenshots to attach to deals
 */

import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { Platform, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import { FirebaseService, Attachment } from './FirebaseService';
import { AuthService } from './AuthService';

export interface CaptureResult {
  uri: string;
  type: 'image/jpeg' | 'image/png';
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}

export class CameraService {
  /**
   * Request camera permissions
   */
  static async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      // iOS permissions are handled by Info.plist
      return true;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'Effortless CRM needs access to your camera to take photos of deal details.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  }

  /**
   * Take a photo with camera
   */
  static async takePhoto(): Promise<CaptureResult | null> {
    try {
      // Request permission
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      const options: CameraOptions = {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        saveToPhotos: false,
        includeBase64: false,
      };

      const result = await launchCamera(options);

      return this.processImagePickerResult(result);
    } catch (error) {
      console.error('Error taking photo:', error);
      throw error;
    }
  }

  /**
   * Pick image from gallery
   */
  static async pickFromGallery(): Promise<CaptureResult | null> {
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        selectionLimit: 1,
        includeBase64: false,
      };

      const result = await launchImageLibrary(options);

      return this.processImagePickerResult(result);
    } catch (error) {
      console.error('Error picking from gallery:', error);
      throw error;
    }
  }

  /**
   * Process image picker result
   */
  private static processImagePickerResult(
    result: ImagePickerResponse
  ): CaptureResult | null {
    if (result.didCancel) {
      console.log('User cancelled image picker');
      return null;
    }

    if (result.errorCode) {
      throw new Error(`Image picker error: ${result.errorMessage}`);
    }

    const asset = result.assets?.[0];
    if (!asset || !asset.uri) {
      throw new Error('No image selected');
    }

    return {
      uri: asset.uri,
      type: (asset.type as 'image/jpeg' | 'image/png') || 'image/jpeg',
      fileName: asset.fileName || `photo_${Date.now()}.jpg`,
      fileSize: asset.fileSize || 0,
      width: asset.width,
      height: asset.height,
    };
  }

  /**
   * Upload image to Firebase Storage
   * Note: In production, you'd upload to Firebase Storage or your own server
   * For now, we'll use base64 encoding (not recommended for large files)
   */
  static async uploadImage(capture: CaptureResult): Promise<string> {
    try {
      console.log('Uploading image:', capture.fileName);

      // Read file as base64
      const base64 = await RNFS.readFile(capture.uri, 'base64');

      // In production, upload to Firebase Storage and return URL
      // For now, we'll return a data URL (not recommended for production)
      const dataUrl = `data:${capture.type};base64,${base64}`;

      console.log('✓ Image uploaded (base64)');
      return dataUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  /**
   * Create thumbnail from image
   */
  static async createThumbnail(
    imageUri: string,
    maxSize: number = 200
  ): Promise<string> {
    try {
      // In production, use react-native-create-thumbnail or similar
      // For now, return the same image
      // TODO: Implement actual thumbnail generation
      return imageUri;
    } catch (error) {
      console.error('Error creating thumbnail:', error);
      return imageUri;
    }
  }

  /**
   * Attach image to deal
   */
  static async attachToDeal(dealId: string, capture: CaptureResult): Promise<void> {
    try {
      console.log('Attaching image to deal:', dealId);

      // Upload image
      const imageUrl = await this.uploadImage(capture);

      // Create thumbnail
      const thumbnailUrl = await this.createThumbnail(imageUrl);

      // Get user info
      const user = await AuthService.getCurrentUser();
      if (!user) throw new Error('No user signed in');

      // Create attachment object
      const attachment: Attachment = {
        id: `att_${Date.now()}`,
        url: imageUrl,
        thumbnailUrl,
        type: 'image',
        name: capture.fileName,
        size: capture.fileSize,
        uploadedAt: new Date().toISOString(),
        uploadedBy: {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName,
        },
      };

      // Add to deal
      await FirebaseService.addAttachment(dealId, attachment);

      console.log('✓ Image attached to deal');
    } catch (error) {
      console.error('Error attaching image:', error);
      throw error;
    }
  }

  /**
   * Show image picker options (camera or gallery)
   */
  static async showOptions(): Promise<'camera' | 'gallery' | null> {
    // This would show a native ActionSheet or Modal
    // For now, return null and let the UI handle it
    return null;
  }

  /**
   * Capture and attach to deal in one step
   */
  static async captureAndAttach(
    dealId: string,
    source: 'camera' | 'gallery' = 'camera'
  ): Promise<void> {
    try {
      // Capture image
      const capture = source === 'camera'
        ? await this.takePhoto()
        : await this.pickFromGallery();

      if (!capture) {
        console.log('No image captured');
        return;
      }

      // Attach to deal
      await this.attachToDeal(dealId, capture);

      console.log('✓ Image captured and attached');
    } catch (error) {
      console.error('Error in captureAndAttach:', error);
      throw error;
    }
  }
}
