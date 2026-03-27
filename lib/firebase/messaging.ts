import { getMessaging } from './admin';
import sharp from 'sharp';
import type { FCMMessage } from '@/types';

const BATCH_SIZE = 500; // FCM allows max 500 tokens per batch

interface SendResult {
  success: number;
  failed: number;
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

/**
 * Send push notification to multiple FCM tokens
 * Uses batching to handle large numbers of tokens
 */
export async function sendPushNotification(
  tokens: string[],
  message: FCMMessage
): Promise<SendResult> {
  if (!tokens.length) {
    return { success: 0, failed: 0 };
  }

  let successCount = 0;
  let failedCount = 0;
  const errors: Array<{ index: number; error: string }> = [];

  // Process tokens in batches of 500 - using parallel processing for faster delivery
  const batchPromises: Promise<void>[] = [];
  
  console.log("Sending notification to:", tokens.length, "devices");
  
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batchTokens = tokens.slice(i, i + BATCH_SIZE);
    console.log("Sending batch:", batchTokens.length, "tokens, batch index:", i / BATCH_SIZE);
    
    // Create a promise for each batch
    batchPromises.push((async () => {
      try {
        // Use data-only payload for full control
        // This ensures no automatic notification display by FCM
        const response = await getMessaging().sendEachForMulticast({
          data: message.data,
          webpush: message.webpush,
          tokens: batchTokens,
        });
        
        successCount += response.successCount;
        failedCount += response.failureCount;

        // Collect errors with their indices
        if (response.responses) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorMsg = resp.error?.message || 'Unknown error';
              errors.push({
                index: i + idx,
                error: errorMsg,
              });
            }
          });
        }
      } catch (error) {
        failedCount += batchTokens.length;
      }
    })());
  }
  
  // Wait for all batches to complete in parallel
  await Promise.all(batchPromises);

  return {
    success: successCount,
    failed: failedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Compress image for FCM - aggressively reduce size to ensure it sends
 * FCM has 4KB limit for notification payload
 */
async function compressImageForFCM(imageDataUrl: string): Promise<string | null> {
  try {
    // Extract base64 data from data URL
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Skip compression for Android - FCM can fetch from URL
    // Only compress for web/pwa which has 4KB payload limit
    // For base64 images, we still compress but with faster settings
    
    // Fast compression - single pass with smaller size
    const img = await sharp(imageBuffer)
      .resize(60, 60, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 40 })
      .toBuffer();
    
    if (img.length <= 4000) {
      return `data:image/webp;base64,${img.toString('base64')}`;
    }
    
    // If still too large, try even smaller
    const img2 = await sharp(imageBuffer)
      .resize(40, 40, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 30 })
      .toBuffer();
    
    return `data:image/webp;base64,${img2.toString('base64')}`;
  } catch (error) {
    console.error('Failed to compress image for FCM:', error);
    return null;
  }
}

/**
 * Send a simple notification to all devices
 */
export async function sendNotificationToAllDevices(
  tokens: string[],
  title: string,
  body: string,
  imageUrl?: string,
  link?: string,
  notificationId?: string
): Promise<SendResult> {
  // For Android/FCM, we need to compress the image to stay under 4KB payload limit
  let fcmImageUrl = imageUrl;
  
  // Skip compression for URL images - FCM can fetch from URL on Android
  // Only compress base64 images which are already embedded
  if (imageUrl && imageUrl.startsWith('data:')) {
    // Fast compression for base64 images
    const compressedImage = await compressImageForFCM(imageUrl);
    if (compressedImage) {
      fcmImageUrl = compressedImage;
    }
  } else if (imageUrl && imageUrl.startsWith('http')) {
    // URL images are handled directly by FCM - no compression needed
    fcmImageUrl = imageUrl;
  }

  // Build data payload - DATA ONLY (no notification object)
  // This gives us full control over notification display on all platforms
  const dataPayload: Record<string, string> = {
    title: title,
    body: body,
    image: fcmImageUrl || '',
    link: link || '/',
    foreground: 'false',
  };
  if (notificationId) {
    dataPayload.notificationId = notificationId;
  }

  const message: FCMMessage = {
    // Use data payload only - let service worker handle all notification display
    // This prevents duplicate notifications on both iOS and Android
    data: dataPayload,
    webpush: {
      // Set high urgency for Android when app is closed
      headers: {
        Urgency: 'high',
      },
    },
    tokens,
  };

  return sendPushNotification(tokens, message);
}

/**
 * Remove invalid tokens from the database
 */
export async function removeInvalidTokens(
  invalidTokens: string[],
  DeviceModel: typeof import('@/lib/models').Device
): Promise<number> {
  if (invalidTokens.length === 0) return 0;

  try {
    const result = await DeviceModel.deleteMany({
      fcmToken: { $in: invalidTokens },
    });
    return result.deletedCount;
  } catch (error) {
    console.error('Error removing invalid tokens:', error);
    return 0;
  }
}
