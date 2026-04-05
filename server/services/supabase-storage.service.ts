import { getSupabaseClient } from "../config/supabase";

export interface UploadDocumentOptions {
  bucket: string;
  fileName: string;
  file: Buffer;
  contentType: string;
  /**
   * Prefix to namespace storage paths (e.g. userId or clinicId/userId).
   * Must be safe for use in a Storage object path.
   */
  prefix: string;
}

export interface UploadedDocument {
  path: string;
  url: string;
  bucket: string;
  fileName: string;
}

/**
 * Service for managing file uploads to Supabase Storage
 */
export class SupabaseStorageService {
  private static readonly SIGNED_URL_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Upload a document to Supabase Storage
   */
  static async uploadDocument(
    options: UploadDocumentOptions
  ): Promise<UploadedDocument> {
    const supabase = getSupabaseClient();
    const { bucket, fileName, file, contentType, prefix } = options;

    try {
      const timestamp = Date.now();
      const filePath = `${prefix}/${timestamp}-${fileName}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (error || !data) {
        throw new Error(`Upload failed: ${error?.message || "Unknown error"}`);
      }

      // Get signed URL for access
      const signedUrl = await this.getSignedUrl(bucket, filePath);

      return {
        path: data.path,
        url: signedUrl,
        bucket,
        fileName,
      };
    } catch (error) {
      console.error("Document upload error:", error);
      throw new Error("Failed to upload document");
    }
  }

  /**
   * Get a signed URL for accessing a document
   */
  static async getSignedUrl(
    bucket: string,
    path: string,
    expirySeconds: number = this.SIGNED_URL_EXPIRY
  ): Promise<string> {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expirySeconds);

      if (error || !data) {
        throw new Error(
          `Failed to create signed URL: ${error?.message || "Unknown error"}`
        );
      }

      return data.signedUrl;
    } catch (error) {
      console.error("Signed URL creation error:", error);
      throw new Error("Failed to create signed URL");
    }
  }

  /**
   * Delete a document from storage
   */
  static async deleteDocument(
    bucket: string,
    path: string
  ): Promise<boolean> {
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Document deletion error:", error);
      return false;
    }
  }

  /**
   * List all documents for a user
   */
  static async listUserDocuments(
    userId: string,
    bucket: string
  ): Promise<string[]> {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(userId);

      if (error) {
        throw error;
      }

      return data?.map((file) => file.name) || [];
    } catch (error) {
      console.error("List documents error:", error);
      return [];
    }
  }

  /**
   * Validate file before upload
   */
  static validateFile(
    file: Buffer,
    fileName: string,
    maxSizeBytes: number = 5 * 1024 * 1024 // 5MB
  ): { valid: boolean; error?: string } {
    // Check file size
    if (file.length > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds maximum of ${maxSizeBytes / 1024 / 1024}MB`,
      };
    }

    // Check file extension
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png"];
    const extension = fileName.split(".").pop()?.toLowerCase();

    if (!extension || !allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed: ${allowedExtensions.join(", ")}`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload multiple documents for a user (batch operation)
   */
  static async uploadDocumentBatch(
    userId: string,
    documents: Array<{ fileName: string; file: Buffer; contentType: string }>,
    bucket: string
  ): Promise<UploadedDocument[]> {
    const results: UploadedDocument[] = [];

    for (const doc of documents) {
      try {
        const validation = this.validateFile(doc.file, doc.fileName);
        if (!validation.valid) {
          console.warn(
            `Skipping ${doc.fileName}: ${validation.error}`
          );
          continue;
        }

        const uploaded = await this.uploadDocument({
          bucket,
          fileName: doc.fileName,
          file: doc.file,
          contentType: doc.contentType,
          prefix: userId,
        });

        results.push(uploaded);
      } catch (error) {
        console.error(`Failed to upload ${doc.fileName}:`, error);
        // Continue with next file
      }
    }

    return results;
  }
}

export default SupabaseStorageService;
