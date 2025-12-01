interface FireflyConfig {
  clientId: string;
  clientSecret: string;
}

interface FireflyImageOutput {
  seed: number;
  image: {
    url: string;
  };
}

interface FireflyGenerateResponse {
  version: string;
  size: { width: number; height: number };
  outputs: FireflyImageOutput[];
  contentClass: string;
}

interface FireflyModel {
  id: string;
  name: string;
  type: string;
  status: string;
}

class AdobeFireflyProvider {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private baseUrl = 'https://firefly-api.adobe.io';
  private authUrl = 'https://ims-na1.adobelogin.com/ims/token/v3';

  constructor(config?: FireflyConfig) {
    this.clientId = config?.clientId || process.env.ADOBE_CLIENT_ID || '';
    this.clientSecret = config?.clientSecret || process.env.ADOBE_CLIENT_SECRET || '';
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('scope', 'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis');

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Adobe auth failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    console.log('[AdobeFirefly] Access token obtained, expires in', data.expires_in, 'seconds');
    return this.accessToken!;
  }

  async generateImage(options: {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    numImages?: number;
    contentClass?: 'photo' | 'art';
    style?: string;
    visualIntensity?: number;
  }): Promise<{
    imageUrl: string;
    seed: number;
    allOutputs: FireflyImageOutput[];
  }> {
    if (!this.isConfigured()) {
      throw new Error('Adobe Firefly not configured. Set ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET.');
    }

    const startTime = Date.now();
    const token = await this.getAccessToken();

    const requestBody: Record<string, unknown> = {
      prompt: options.prompt,
      n: options.numImages || 1,
      size: {
        width: options.width || 1024,
        height: options.height || 1024,
      },
      contentClass: options.contentClass || 'art',
    };

    if (options.negativePrompt) {
      requestBody.negativePrompt = options.negativePrompt;
    }

    if (options.style) {
      requestBody.style = { presets: [options.style] };
    }

    if (options.visualIntensity !== undefined) {
      requestBody.visualIntensity = options.visualIntensity;
    }

    console.log('[AdobeFirefly] Generating image with prompt:', options.prompt.substring(0, 100) + '...');

    const response = await fetch(`${this.baseUrl}/v3/images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.clientId,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firefly generate failed: ${response.status} - ${errorText}`);
    }

    const result: FireflyGenerateResponse = await response.json();
    const latency = Date.now() - startTime;
    
    console.log(`[AdobeFirefly] Image generated in ${latency}ms, got ${result.outputs.length} outputs`);

    if (!result.outputs || result.outputs.length === 0) {
      throw new Error('Firefly returned no outputs');
    }

    return {
      imageUrl: result.outputs[0].image.url,
      seed: result.outputs[0].seed,
      allOutputs: result.outputs,
    };
  }

  async generateImageWithStyle(options: {
    prompt: string;
    referenceImageUrl?: string;
    structureImageUrl?: string;
    stylePreset?: string;
    width?: number;
    height?: number;
  }): Promise<{ imageUrl: string; seed: number }> {
    if (!this.isConfigured()) {
      throw new Error('Adobe Firefly not configured');
    }

    const token = await this.getAccessToken();

    const requestBody: Record<string, unknown> = {
      prompt: options.prompt,
      n: 1,
      size: {
        width: options.width || 1024,
        height: options.height || 1024,
      },
    };

    if (options.referenceImageUrl) {
      requestBody.style = {
        imageReference: {
          source: { url: options.referenceImageUrl },
        },
      };
    }

    if (options.structureImageUrl) {
      requestBody.structure = {
        imageReference: {
          source: { url: options.structureImageUrl },
        },
      };
    }

    if (options.stylePreset) {
      requestBody.style = {
        ...(requestBody.style as object || {}),
        presets: [options.stylePreset],
      };
    }

    const response = await fetch(`${this.baseUrl}/v3/images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.clientId,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firefly style generation failed: ${response.status} - ${errorText}`);
    }

    const result: FireflyGenerateResponse = await response.json();
    
    if (!result.outputs || result.outputs.length === 0) {
      throw new Error('No outputs returned');
    }

    return {
      imageUrl: result.outputs[0].image.url,
      seed: result.outputs[0].seed,
    };
  }

  async expandImage(options: {
    imageUrl: string;
    prompt?: string;
    size: { width: number; height: number };
    placement?: { inset: { left: number; top: number; right: number; bottom: number } };
  }): Promise<{ imageUrl: string }> {
    if (!this.isConfigured()) {
      throw new Error('Adobe Firefly not configured');
    }

    const token = await this.getAccessToken();

    const requestBody = {
      image: { source: { url: options.imageUrl } },
      size: options.size,
      prompt: options.prompt,
      placement: options.placement,
    };

    const response = await fetch(`${this.baseUrl}/v3/images/expand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.clientId,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firefly expand failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return { imageUrl: result.outputs[0].image.url };
  }

  async fillImage(options: {
    imageUrl: string;
    maskUrl: string;
    prompt: string;
  }): Promise<{ imageUrl: string }> {
    if (!this.isConfigured()) {
      throw new Error('Adobe Firefly not configured');
    }

    const token = await this.getAccessToken();

    const requestBody = {
      image: { source: { url: options.imageUrl } },
      mask: { source: { url: options.maskUrl } },
      prompt: options.prompt,
    };

    const response = await fetch(`${this.baseUrl}/v3/images/fill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.clientId,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firefly fill failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return { imageUrl: result.outputs[0].image.url };
  }

  async listCustomModels(): Promise<FireflyModel[]> {
    if (!this.isConfigured()) {
      throw new Error('Adobe Firefly not configured');
    }

    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v3/models`, {
      method: 'GET',
      headers: {
        'x-api-key': this.clientId,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list models: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.models || [];
  }

  async generateWithCustomModel(options: {
    modelId: string;
    prompt: string;
    numImages?: number;
    width?: number;
    height?: number;
  }): Promise<{ imageUrl: string; allOutputs: FireflyImageOutput[] }> {
    if (!this.isConfigured()) {
      throw new Error('Adobe Firefly not configured');
    }

    const token = await this.getAccessToken();

    const requestBody = {
      prompt: options.prompt,
      n: options.numImages || 1,
      size: {
        width: options.width || 1024,
        height: options.height || 1024,
      },
      contentClass: 'art',
      style: {
        customModel: { id: options.modelId },
      },
    };

    console.log('[AdobeFirefly] Generating with custom model:', options.modelId);

    const response = await fetch(`${this.baseUrl}/v3/images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.clientId,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Custom model generation failed: ${response.status} - ${errorText}`);
    }

    const result: FireflyGenerateResponse = await response.json();
    
    return {
      imageUrl: result.outputs[0].image.url,
      allOutputs: result.outputs,
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Not configured - missing ADOBE_CLIENT_ID or ADOBE_CLIENT_SECRET' };
      }
      
      await this.getAccessToken();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const adobeFirefly = new AdobeFireflyProvider();
export { AdobeFireflyProvider };
