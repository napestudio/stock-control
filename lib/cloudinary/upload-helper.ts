import cloudinary from './client';
import type { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Upload image to Cloudinary
 * @param fileBuffer - Base64 encoded image or file buffer
 * @param folder - Cloudinary folder path
 */
export async function uploadImage(
  fileBuffer: string | Buffer,
  folder: string = 'stock-control/products'
): Promise<UploadResult> {
  try {
    // Convert buffer to base64 if needed
    const base64Image = Buffer.isBuffer(fileBuffer)
      ? `data:image/png;base64,${fileBuffer.toString('base64')}`
      : fileBuffer;

    const result: UploadApiResponse = await cloudinary.uploader.upload(
      base64Image,
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        max_file_size: 5000000, // 5MB
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' }, // Max dimensions
          { quality: 'auto:good' }, // Auto quality optimization
          { fetch_format: 'auto' }, // Auto format (WebP for modern browsers)
        ],
      }
    );

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    const err = error as UploadApiErrorResponse;
    console.error('Cloudinary upload error:', err);
    return {
      success: false,
      error: err.message || 'Failed to upload image',
    };
  }
}

/**
 * Delete image from Cloudinary
 * @param publicId - Cloudinary public_id
 */
export async function deleteImage(publicId: string): Promise<DeleteResult> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true, // Invalidate CDN cache
    });

    return { success: true };
  } catch (error) {
    const err = error as Error;
    console.error('Cloudinary delete error:', err);
    return {
      success: false,
      error: err.message || 'Failed to delete image',
    };
  }
}

/**
 * Extract public_id from Cloudinary URL
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    const regex = /\/v\d+\/(.*?)\.\w+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
