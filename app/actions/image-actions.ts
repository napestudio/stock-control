"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { uploadImage, deleteImage } from "@/lib/cloudinary/upload-helper";

interface UploadImageResult {
  success: boolean;
  imageUrl?: string;
  imagePublicId?: string;
  error?: string;
}

/**
 * Upload product image to Cloudinary
 * Server Action for handling image uploads
 */
export async function uploadProductImage(
  formData: FormData
): Promise<UploadImageResult> {
  try {
    // Authentication check
    const session = await auth();
    if (!isAdmin(session)) {
      return {
        success: false,
        error: "Unauthorized: Admin access required",
      };
    }

    // Extract file from FormData
    const file = formData.get("image") as File | null;

    if (!file) {
      return {
        success: false,
        error: "No image file provided",
      };
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: "Invalid file type. Only JPG, PNG, and WebP are allowed.",
      };
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: "File size exceeds 5MB limit",
      };
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await uploadImage(buffer, "stock-control/products");

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to upload image",
      };
    }

    return {
      success: true,
      imageUrl: result.url,
      imagePublicId: result.publicId,
    };
  } catch (error) {
    console.error("Upload product image error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An error occurred during upload",
    };
  }
}

/**
 * Delete product image from Cloudinary
 */
export async function deleteProductImage(
  publicId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Authentication check
    const session = await auth();
    if (!isAdmin(session)) {
      return {
        success: false,
        error: "Unauthorized: Admin access required",
      };
    }

    if (!publicId) {
      return {
        success: false,
        error: "No public ID provided",
      };
    }

    const result = await deleteImage(publicId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete image",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Delete product image error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An error occurred during deletion",
    };
  }
}
