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

  console.log('FCM: Sending to', tokens.length, 'tokens');
  
  let successCount = 0;
  let failedCount = 0;
  const errors: Array<{ index: number; error: string }> = [];

  // Process tokens in batches of 500
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batchTokens = tokens.slice(i, i + BATCH_SIZE);
    
    try {
      console.log('FCM: Sending batch', Math.floor(i / BATCH_SIZE) + 1, 'of', Math.ceil(tokens.length / BATCH_SIZE));
      const response = await getMessaging().sendEachForMulticast({
        notification: message.notification,
        webpush: message.webpush,
        tokens: batchTokens,
      });
      
      console.log('FCM: Batch result - success:', response.successCount, 'failure:', response.failureCount);
      successCount += response.successCount;
      failedCount += response.failureCount;

      // Collect errors with their indices
      if (response.responses) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorMsg = resp.error?.message || 'Unknown error';
            console.log('FCM: Token index', i + idx, 'failed:', errorMsg);
            errors.push({
              index: i + idx,
              error: errorMsg,
            });
            
            // Handle invalid tokens - mark for removal
            if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('NotRegistered') || errorMsg.includes('Invalid')) {
              console.log('FCM: Invalid token detected at index', i + idx);
            }
          }
        });
      }
    } catch (error) {
      console.error(`Error sending batch ${i / BATCH_SIZE + 1}:`, error);
      failedCount += batchTokens.length;
    }
  }

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
    
    // Aggressive compression - start small and reduce quality
    // FCM notification payload limit is 4KB
    
    // Try 1: 100x100 with moderate quality
    const img1 = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer();
    
    if (img1.length <= 4000) {
      return `data:image/webp;base64,${img1.toString('base64')}`;
    }
    
    // Try 2: 80x80 with lower quality
    const img2 = await sharp(imageBuffer)
      .resize(80, 80, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 50 })
      .toBuffer();
    
    if (img2.length <= 4000) {
      return `data:image/webp;base64,${img2.toString('base64')}`;
    }
    
    // Try 3: 60x60 with low quality
    const img3 = await sharp(imageBuffer)
      .resize(60, 60, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 40 })
      .toBuffer();
    
    return `data:image/webp;base64,${img3.toString('base64')}`;
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
  link?: string
): Promise<SendResult> {
  // For Android, we need to compress the image to stay under 4KB payload limit
  let fcmImageUrl = imageUrl;
  if (imageUrl && imageUrl.startsWith('data:')) {
    // Image is base64 encoded - compress it for FCM
    const compressedImage = await compressImageForFCM(imageUrl);
    if (compressedImage) {
      fcmImageUrl = compressedImage;
    }
  }

  const message: FCMMessage = {
    notification: {
      title,
      body,
      image: fcmImageUrl,
    },
    webpush: {
      notification: {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'notification',
        title,
        body,
        image: fcmImageUrl,
      },
      fcmOptions: link ? { link } : undefined,
      data: link ? { url: link } : undefined,
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
