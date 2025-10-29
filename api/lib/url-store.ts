/**
 * In-memory URL store for TinyLink
 * Owner: Forge
 */

export interface ShortUrl {
  code: string;
  originalUrl: string;
  clicks: number;
  createdAt: Date;
}

export class UrlStore {
  private urls: Map<string, ShortUrl> = new Map();

  /**
   * Generate a random 6-character alphanumeric code
   */
  generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create a short URL
   */
  shorten(originalUrl: string): ShortUrl {
    let code = this.generateCode();

    // Ensure uniqueness (very unlikely to collide with 6 chars)
    while (this.urls.has(code)) {
      code = this.generateCode();
    }

    const shortUrl: ShortUrl = {
      code,
      originalUrl,
      clicks: 0,
      createdAt: new Date(),
    };

    this.urls.set(code, shortUrl);
    return shortUrl;
  }

  /**
   * Get original URL by code and increment click count
   */
  getAndTrack(code: string): string | null {
    const shortUrl = this.urls.get(code);
    if (!shortUrl) return null;

    shortUrl.clicks++;
    return shortUrl.originalUrl;
  }

  /**
   * Get stats without incrementing
   */
  getStats(code: string): ShortUrl | null {
    return this.urls.get(code) || null;
  }

  /**
   * Get all URLs (for debugging)
   */
  getAll(): ShortUrl[] {
    return Array.from(this.urls.values());
  }
}
