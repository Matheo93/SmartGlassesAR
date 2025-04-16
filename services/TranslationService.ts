// services/TranslationService.ts
import { useState, useCallback } from 'react';
import ApiConfig from './ApiConfig';

type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DetectedText = {
  text: string;
  translatedText?: string;
  boundingBox: BoundingBox;
  confidence: number;
};

/**
 * Service for real-time text detection and translation
 */
export class TranslationService {
  /**
   * Detects text in an image using Google Cloud Vision API
   */
  static async detectText(base64Image: string): Promise<DetectedText[]> {
    try {
      // Remove data URI prefix if present
      const imageContent = base64Image.replace(/^data:image\/\w+;base64,/, '');
      
      // Prepare request for Cloud Vision API
      const body = JSON.stringify({
        requests: [
          {
            image: {
              content: imageContent,
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 20,
              },
            ],
          },
        ],
      });

      // Call Cloud Vision API
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.VISION_API}?key=${ApiConfig.getApiKey()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      const data = await response.json();
      
      if (!data.responses || !data.responses[0] || !data.responses[0].textAnnotations) {
        return [];
      }

      // Transform results into our format
      return data.responses[0].textAnnotations.map((annotation: any, index: number) => {
        // Get bounding box coordinates
        const vertices = annotation.boundingPoly.vertices;
        
        // Calculate the bounding box from vertices
        const minX = Math.min(...vertices.map((v: any) => v.x || 0));
        const minY = Math.min(...vertices.map((v: any) => v.y || 0));
        const maxX = Math.max(...vertices.map((v: any) => v.x || 0));
        const maxY = Math.max(...vertices.map((v: any) => v.y || 0));
        
        // Scale to 0-1000 range for standardization across different devices
        const imageWidth = 1000;
        const imageHeight = 1000;
        
        return {
          text: annotation.description,
          boundingBox: {
            x: (minX / imageWidth) * 1000,
            y: (minY / imageHeight) * 1000,
            width: ((maxX - minX) / imageWidth) * 1000,
            height: ((maxY - minY) / imageHeight) * 1000,
          },
          confidence: annotation.score || 0.9, // Default if no score
        };
      });
    } catch (error) {
      console.error('Error in text detection:', error);
      throw error;
    }
  }

  /**
   * Translates text using Google Cloud Translation API
   */
  static async translateText(
    text: string,
    targetLanguage: string = 'en',
    sourceLanguage?: string
  ): Promise<{ translatedText: string; detectedLanguage?: string }> {
    try {
      // Build request URL with API key
      const url = `${ApiConfig.API_ENDPOINTS.TRANSLATION}?key=${ApiConfig.getApiKey()}`;
      
      // Prepare request body
      const body: any = {
        q: text,
        target: targetLanguage,
      };

      if (sourceLanguage) {
        body.source = sourceLanguage;
      }

      // Call Translation API
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.data || !data.data.translations || data.data.translations.length === 0) {
        throw new Error('No translation found');
      }

      // Return translated text
      return {
        translatedText: data.data.translations[0].translatedText,
        detectedLanguage: data.data.translations[0].detectedSourceLanguage,
      };
    } catch (error) {
      console.error('Error in translation:', error);
      throw error;
    }
  }

  /**
   * Detect and translate text in an image
   */
  static async detectAndTranslateText(
    base64Image: string,
    targetLanguage: string = 'en'
  ): Promise<DetectedText[]> {
    try {
      // First detect all text in the image
      const detectedTexts = await this.detectText(base64Image);
      
      if (detectedTexts.length === 0) {
        return [];
      }

      // Then translate each detected text
      const translatedTexts = await Promise.all(
        detectedTexts.map(async (detectedText) => {
          try {
            // Skip translation for very short text or just numbers
            if (detectedText.text.length <= 1 || /^[\d\s]+$/.test(detectedText.text)) {
              return {
                ...detectedText,
                translatedText: detectedText.text,
              };
            }
            
            const translation = await this.translateText(detectedText.text, targetLanguage);
            
            return {
              ...detectedText,
              translatedText: translation.translatedText,
            };
          } catch (err) {
            // If translation fails, return original text
            return {
              ...detectedText,
              translatedText: detectedText.text,
            };
          }
        })
      );

      return translatedTexts;
    } catch (error) {
      console.error('Error in detect and translate:', error);
      throw error;
    }
  }
}

// React hook for using the translation service
export function useTranslation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedTexts, setTranslatedTexts] = useState<DetectedText[]>([]);

  // Function to detect and translate text from an image
  const detectAndTranslate = useCallback(async (base64Image: string, targetLanguage: string = 'en') => {
    try {
      setIsLoading(true);
      setError(null);
      
      const results = await TranslationService.detectAndTranslateText(base64Image, targetLanguage);
      setTranslatedTexts(results);
      
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    translatedTexts,
    detectAndTranslate,
  };
}