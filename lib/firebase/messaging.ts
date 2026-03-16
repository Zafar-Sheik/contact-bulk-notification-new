import { getMessaging } from './admin';
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
            if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('Invalid')) {
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
 * Send a simple notification to all devices
 */
export async function sendNotificationToAllDevices(
  tokens: string[],
  title: string,
  body: string,
  imageUrl?: string,
  link?: string
): Promise<SendResult> {
  const message: FCMMessage = {
    notification: {
      title,
      body,
      image: imageUrl,
    },
    webpush: {
      notification: {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'notification',
        data: link ? { url: link } : undefined,
      },
      fcmOptions: link ? { link } : undefined,
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
