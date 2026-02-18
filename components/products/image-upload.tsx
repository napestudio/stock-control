"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import Image from "next/image";
import { uploadProductImage } from "@/app/actions/image-actions";

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageChange: (
    imageUrl: string | null,
    imagePublicId: string | null,
  ) => void;
  disabled?: boolean;
}

export default function ImageUpload({
  currentImageUrl,
  onImageChange,
  disabled = false,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(
    currentImageUrl || null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Cleanup effect - revoke data URLs when component unmounts or preview changes
  useEffect(() => {
    return () => {
      // Abort any ongoing FileReader operations
      if (readerRef.current) {
        readerRef.current.abort();
        readerRef.current = null;
      }
      // Revoke the preview URL if it's a blob URL
      if (previewUrlRef.current && previewUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError("File size must be less than 5MB");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG, and WebP formats are supported");
      return;
    }

    setError(null);

    // Clean up previous FileReader if it exists
    if (readerRef.current) {
      readerRef.current.abort();
    }

    // Clean up previous preview URL if it's a blob URL
    if (previewUrlRef.current && previewUrlRef.current.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    // Use createObjectURL for preview instead of FileReader (much more memory efficient)
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreview(objectUrl);

    // Upload to Cloudinary via Server Action
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const result = await uploadProductImage(formData);

      if (result.success && result.imageUrl && result.imagePublicId) {
        // Clean up the temporary object URL since we now have the Cloudinary URL
        if (
          previewUrlRef.current &&
          previewUrlRef.current.startsWith("blob:")
        ) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
        onImageChange(result.imageUrl, result.imagePublicId);
        setPreview(result.imageUrl);
      } else {
        setError(result.error || "Failed to upload image");
        // Clean up the object URL on error
        if (
          previewUrlRef.current &&
          previewUrlRef.current.startsWith("blob:")
        ) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
        setPreview(currentImageUrl || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      // Clean up the object URL on error
      if (previewUrlRef.current && previewUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreview(currentImageUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    // Clean up object URL if it exists
    if (previewUrlRef.current && previewUrlRef.current.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    onImageChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Product Image
        <span className="text-gray-500 text-xs ml-1">(Optional)</span>
      </label>

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div
          className={`relative w-32 h-32 border-2 border-dashed rounded-lg overflow-hidden ${
            preview ? "border-gray-300" : "border-gray-300 bg-gray-50"
          }`}
        >
          {preview ? (
            <Image
              src={preview}
              alt="Product preview"
              fill
              className="object-cover"
              sizes="128px"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={disabled || isUploading}
            className="hidden"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClick}
              disabled={disabled || isUploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {preview ? "Cambiar Foto" : "Subir Foto"}
            </button>

            {preview && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Eliminar
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500">JPG, PNG or WebP. Max 5MB.</p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {isUploading && (
            <p className="text-sm text-indigo-600">Uploading...</p>
          )}
        </div>
      </div>
    </div>
  );
}
