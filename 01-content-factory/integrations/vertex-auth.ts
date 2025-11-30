import { SignJWT, importPKCS8 } from 'jose';

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

let cachedToken: { token: string; expiry: number } | null = null;

export async function getVertexAIAccessToken(): Promise<string | null> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  
  if (!serviceAccountJson) {
    console.log('[VertexAuth] GOOGLE_SERVICE_ACCOUNT_JSON not configured');
    return null;
  }

  if (cachedToken && cachedToken.expiry > Date.now() + 60000) {
    return cachedToken.token;
  }

  try {
    const credentials: ServiceAccountCredentials = JSON.parse(serviceAccountJson);
    
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600;

    const privateKey = await importPKCS8(credentials.private_key, 'RS256');
    
    const jwt = await new SignJWT({
      iss: credentials.client_email,
      sub: credentials.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .sign(privateKey);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[VertexAuth] Token exchange failed:', error);
      return null;
    }

    const tokenData = await tokenResponse.json();
    
    cachedToken = {
      token: tokenData.access_token,
      expiry: Date.now() + (tokenData.expires_in * 1000),
    };

    console.log('[VertexAuth] Successfully obtained access token');
    return cachedToken.token;
  } catch (error: any) {
    console.error('[VertexAuth] Error getting access token:', error.message);
    return null;
  }
}

export function getProjectId(): string {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const credentials = JSON.parse(serviceAccountJson);
      return credentials.project_id;
    } catch {}
  }
  return process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0274381734';
}

export function getLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
}
