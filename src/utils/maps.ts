/**
 * Google Maps image URL utilities for property snapshots
 */

import type { CleanedSale } from '../types/index.js';

/**
 * Build a full address string for geocoding
 */
export function buildFullAddress(sale: CleanedSale): string {
  const parts = [
    sale.situs_address,
    sale.city,
    sale.state,
    sale.zip,
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Generate a Google Maps Street View Static API URL
 * 
 * @param address The full address to show
 * @param apiKey Google Maps API key
 * @param width Image width in pixels
 * @param height Image height in pixels
 */
export function getStreetViewUrl(
  address: string,
  apiKey: string,
  width: number = 400,
  height: number = 200
): string {
  const encodedAddress = encodeURIComponent(address);
  return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${encodedAddress}&key=${apiKey}`;
}

/**
 * Generate a Google Maps Static API URL (satellite view)
 * 
 * @param address The full address to show
 * @param apiKey Google Maps API key
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param zoom Zoom level (19-20 is good for individual properties)
 */
export function getSatelliteViewUrl(
  address: string,
  apiKey: string,
  width: number = 400,
  height: number = 200,
  zoom: number = 19
): string {
  const encodedAddress = encodeURIComponent(address);
  return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=${zoom}&size=${width}x${height}&maptype=satellite&markers=color:red%7C${encodedAddress}&key=${apiKey}`;
}

/**
 * Generate a Google Maps link for the address (clickable in email)
 */
export function getGoogleMapsLink(address: string): string {
  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}

/**
 * Generate image URL based on configured type
 */
export function getPropertyImageUrl(
  sale: CleanedSale,
  apiKey: string,
  imageType: 'streetview' | 'satellite',
  width: number,
  height: number
): string | null {
  if (!apiKey) {
    return null;
  }

  const address = buildFullAddress(sale);
  if (!address) {
    return null;
  }

  if (imageType === 'streetview') {
    return getStreetViewUrl(address, apiKey, width, height);
  } else {
    return getSatelliteViewUrl(address, apiKey, width, height);
  }
}

