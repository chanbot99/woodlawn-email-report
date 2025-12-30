/**
 * S3 uploader stub for optional cloud storage
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import type { ExtractorConfig } from '../types/index.js';

/**
 * S3 upload result
 */
export interface S3UploadResult {
  bucket: string;
  key: string;
  url: string;
}

/**
 * Create S3 client if configuration is provided
 */
export function createS3Client(config: ExtractorConfig): S3Client | null {
  if (!config.s3Bucket) {
    logger.debug('S3 upload disabled - no bucket configured');
    return null;
  }

  return new S3Client({
    region: config.awsRegion,
  });
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
  client: S3Client,
  bucket: string,
  key: string,
  filePath: string,
  contentType: string = 'application/octet-stream'
): Promise<S3UploadResult> {
  const fileContent = fs.readFileSync(filePath);
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  await client.send(command);
  
  const url = `https://${bucket}.s3.amazonaws.com/${key}`;
  
  logger.info('Uploaded file to S3', { bucket, key, url });
  
  return { bucket, key, url };
}

/**
 * Upload extraction outputs to S3
 */
export async function uploadOutputs(
  config: ExtractorConfig,
  files: { path: string; keyPrefix: string }[]
): Promise<S3UploadResult[]> {
  const client = createS3Client(config);
  
  if (!client) {
    logger.debug('Skipping S3 upload - not configured');
    return [];
  }

  const results: S3UploadResult[] = [];

  for (const file of files) {
    const ext = path.extname(file.path).toLowerCase();
    const contentType = ext === '.json' 
      ? 'application/json' 
      : ext === '.csv' 
        ? 'text/csv' 
        : 'application/octet-stream';
    
    const key = `${file.keyPrefix}${path.basename(file.path)}`;
    
    try {
      const result = await uploadToS3(
        client,
        config.s3Bucket,
        key,
        file.path,
        contentType
      );
      results.push(result);
    } catch (error) {
      logger.error('Failed to upload to S3', error as Error, { 
        file: file.path, 
        key,
      });
    }
  }

  return results;
}

/**
 * Generate S3 key prefix for a given date range
 */
export function generateS3KeyPrefix(countyName: string, dateLabel: string): string {
  const datePart = dateLabel.replace('Week of ', '').replace(/-/g, '/');
  return `newhomeowners/${countyName.toLowerCase()}/${datePart}/`;
}

