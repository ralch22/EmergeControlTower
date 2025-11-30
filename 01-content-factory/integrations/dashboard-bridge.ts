/**
 * Dashboard Bridge - Express API to Python LangGraph Pipeline
 * 
 * This module provides functions to call the Python FastAPI server
 * for video generation jobs using the LangGraph pipeline.
 */

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export interface IngredientScene {
  id: string;
  prompt: string;
  duration: number;
  imageUrl?: string;
  order: number;
}

export interface IngredientBundle {
  scenes: IngredientScene[];
  voiceoverScript: string;
  voiceStyle: string;
  aspectRatio: string;
  resolution: string;
}

export interface IngredientGenerationResponse {
  success: boolean;
  generationId?: string;
  status?: string;
  message?: string;
  error?: string;
}

export interface SceneResult {
  scene_id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

export interface GenerationStatusResponse {
  success: boolean;
  generationId?: string;
  status?: string;
  totalScenes?: number;
  completedScenes?: number;
  failedScenes?: number;
  sceneResults?: SceneResult[];
  voiceoverUrl?: string;
  voiceoverError?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/**
 * Trigger ingredient-based video generation in the Python LangGraph pipeline
 * 
 * @param bundle - The ingredient bundle containing scenes, voiceover, and settings
 * @returns Promise with generation ID or error
 */
export async function triggerIngredientGeneration(
  bundle: IngredientBundle
): Promise<IngredientGenerationResponse> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/ingredients-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scenes: bundle.scenes.map(scene => ({
          id: scene.id,
          prompt: scene.prompt,
          duration: scene.duration,
          imageUrl: scene.imageUrl,
          order: scene.order,
        })),
        voiceoverScript: bundle.voiceoverScript,
        voiceStyle: bundle.voiceStyle,
        aspectRatio: bundle.aspectRatio,
        resolution: bundle.resolution,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || `Python API returned status ${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      generationId: data.generation_id,
      status: data.status,
      message: data.message,
    };
  } catch (error: any) {
    console.error('[DashboardBridge] Error triggering ingredient generation:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: `Cannot connect to Python API at ${PYTHON_API_URL}. Make sure the Python server is running.`,
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to trigger ingredient generation',
    };
  }
}

/**
 * Get the status of an ingredient-based video generation job
 * 
 * @param generationId - The generation ID returned from triggerIngredientGeneration
 * @returns Promise with generation status or error
 */
export async function getGenerationStatus(
  generationId: string
): Promise<GenerationStatusResponse> {
  try {
    const response = await fetch(
      `${PYTHON_API_URL}/api/ingredients-generate/${generationId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Generation not found',
        };
      }
      
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || `Python API returned status ${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      generationId: data.generation_id,
      status: data.status,
      totalScenes: data.total_scenes,
      completedScenes: data.completed_scenes,
      failedScenes: data.failed_scenes,
      sceneResults: data.scene_results,
      voiceoverUrl: data.voiceover_url,
      voiceoverError: data.voiceover_error,
      startedAt: data.started_at,
      completedAt: data.completed_at,
    };
  } catch (error: any) {
    console.error('[DashboardBridge] Error getting generation status:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: `Cannot connect to Python API at ${PYTHON_API_URL}. Make sure the Python server is running.`,
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to get generation status',
    };
  }
}

/**
 * Check if the Python API is healthy and reachable
 * 
 * @returns Promise with health check result
 */
export async function checkPythonApiHealth(): Promise<{
  healthy: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        healthy: false,
        error: `Python API returned status ${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      healthy: true,
      message: `Python API is running: ${data.service || 'Content Factory Agent'} v${data.version || '1.0.0'}`,
    };
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      return {
        healthy: false,
        error: `Cannot connect to Python API at ${PYTHON_API_URL}`,
      };
    }
    
    return {
      healthy: false,
      error: error.message || 'Failed to check Python API health',
    };
  }
}

/**
 * Get the configured Python API URL
 */
export function getPythonApiUrl(): string {
  return PYTHON_API_URL;
}
