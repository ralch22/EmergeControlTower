import type { WordpressConfig, GeneratedContentRecord } from "../../shared/schema";

interface WPGraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

interface CreatePostMutationData {
  createPost: {
    post: {
      id: string;
      databaseId: number;
      title: string;
      status: string;
      link: string;
      date: string;
      slug: string;
    } | null;
  };
}

interface TestConnectionData {
  generalSettings: {
    title: string;
    description: string;
    url: string;
  };
  viewer?: {
    name: string;
    email: string;
    capabilities: string[];
  };
}

interface CategoryData {
  categories: {
    nodes: Array<{
      id: string;
      databaseId: number;
      name: string;
      slug: string;
    }>;
  };
}

interface MediaData {
  createMediaItem?: {
    mediaItem: {
      id: string;
      databaseId: number;
      sourceUrl: string;
    } | null;
  };
}

export interface PublishResult {
  success: boolean;
  postId?: number;
  postUrl?: string;
  wordpressId?: string;
  error?: string;
  publishedAt?: Date;
}

export interface ConnectionTestResult {
  success: boolean;
  siteTitle?: string;
  siteUrl?: string;
  siteDescription?: string;
  canPublish?: boolean;
  userName?: string;
  error?: string;
}

export class WordPressPublisher {
  private config: WordpressConfig;
  private authHeader: string;

  constructor(config: WordpressConfig, credentials: { password?: string; token?: string }) {
    this.config = config;
    
    if (config.authType === 'jwt' && credentials.token) {
      this.authHeader = `Bearer ${credentials.token}`;
    } else if (config.username && credentials.password) {
      const encoded = Buffer.from(`${config.username}:${credentials.password}`).toString('base64');
      this.authHeader = `Basic ${encoded}`;
    } else {
      throw new Error('Invalid WordPress authentication configuration');
    }
  }

  private async graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<WPGraphQLResponse<T>> {
    const response = await fetch(this.config.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authHeader,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WordPress GraphQL request failed: ${response.status} ${response.statusText} - ${text}`);
    }

    return response.json() as Promise<WPGraphQLResponse<T>>;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const query = `
        query TestConnection {
          generalSettings {
            title
            description
            url
          }
          viewer {
            name
            email
            capabilities
          }
        }
      `;

      const result = await this.graphqlRequest<TestConnectionData>(query);

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          error: result.errors.map(e => e.message).join(', '),
        };
      }

      const settings = result.data?.generalSettings;
      const viewer = result.data?.viewer;
      
      const canPublish = viewer?.capabilities?.some(cap => 
        cap === 'publish_posts' || cap === 'edit_posts' || cap === 'administrator'
      ) ?? false;

      return {
        success: true,
        siteTitle: settings?.title,
        siteUrl: settings?.url,
        siteDescription: settings?.description,
        canPublish,
        userName: viewer?.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error testing WordPress connection',
      };
    }
  }

  async getCategories(): Promise<Array<{ id: string; databaseId: number; name: string; slug: string }>> {
    const query = `
      query GetCategories {
        categories(first: 100) {
          nodes {
            id
            databaseId
            name
            slug
          }
        }
      }
    `;

    const result = await this.graphqlRequest<CategoryData>(query);
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    return result.data?.categories?.nodes || [];
  }

  async publishPost(
    content: GeneratedContentRecord,
    options: {
      status?: 'DRAFT' | 'PENDING' | 'PUBLISH';
      categoryIds?: string[];
      tagIds?: string[];
      featuredImageId?: string;
      excerpt?: string;
    } = {}
  ): Promise<PublishResult> {
    try {
      const title = content.title || 'Untitled Post';
      
      let postContent = '';
      const rawContent = content.content;
      
      if (typeof rawContent === 'object' && rawContent !== null) {
        const contentData = rawContent as Record<string, unknown>;
        if ('body' in contentData && typeof contentData.body === 'string') {
          postContent = contentData.body;
        } else if ('html' in contentData && typeof contentData.html === 'string') {
          postContent = contentData.html;
        } else if ('text' in contentData && typeof contentData.text === 'string') {
          postContent = this.convertTextToHtml(contentData.text);
        } else if ('content' in contentData && typeof contentData.content === 'string') {
          postContent = this.convertTextToHtml(contentData.content);
        }
      } else if (typeof rawContent === 'string') {
        postContent = this.convertTextToHtml(rawContent);
      }

      const status = options.status || this.getDefaultStatus();

      const mutation = `
        mutation CreatePost($input: CreatePostInput!) {
          createPost(input: $input) {
            post {
              id
              databaseId
              title
              status
              link
              date
              slug
            }
          }
        }
      `;

      const variables = {
        input: {
          title,
          content: postContent,
          status,
          excerpt: options.excerpt || this.generateExcerpt(postContent),
          ...(options.categoryIds && { categories: { nodes: options.categoryIds.map(id => ({ id })) } }),
          ...(options.featuredImageId && { featuredImageId: options.featuredImageId }),
        },
      };

      const result = await this.graphqlRequest<CreatePostMutationData>(mutation, variables);

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          error: result.errors.map(e => e.message).join(', '),
        };
      }

      const post = result.data?.createPost?.post;
      
      if (!post) {
        return {
          success: false,
          error: 'Post creation returned empty response',
        };
      }

      return {
        success: true,
        postId: post.databaseId,
        postUrl: post.link,
        wordpressId: post.id,
        publishedAt: new Date(post.date),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error publishing to WordPress',
      };
    }
  }

  async updatePost(
    wordpressPostId: number,
    updates: {
      title?: string;
      content?: string;
      status?: 'DRAFT' | 'PENDING' | 'PUBLISH';
      excerpt?: string;
    }
  ): Promise<PublishResult> {
    try {
      const mutation = `
        mutation UpdatePost($input: UpdatePostInput!) {
          updatePost(input: $input) {
            post {
              id
              databaseId
              title
              status
              link
              date
              slug
            }
          }
        }
      `;

      const variables = {
        input: {
          id: wordpressPostId.toString(),
          ...updates,
        },
      };

      const result = await this.graphqlRequest<{ updatePost: CreatePostMutationData['createPost'] }>(mutation, variables);

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          error: result.errors.map(e => e.message).join(', '),
        };
      }

      const post = result.data?.updatePost?.post;
      
      if (!post) {
        return {
          success: false,
          error: 'Post update returned empty response',
        };
      }

      return {
        success: true,
        postId: post.databaseId,
        postUrl: post.link,
        wordpressId: post.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating WordPress post',
      };
    }
  }

  private getDefaultStatus(): 'DRAFT' | 'PENDING' | 'PUBLISH' {
    switch (this.config.defaultPostStatus) {
      case 'draft': return 'DRAFT';
      case 'pending': return 'PENDING';
      case 'publish': return 'PUBLISH';
      default: return 'PUBLISH';
    }
  }

  private convertTextToHtml(text: string): string {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    
    return paragraphs.map(p => {
      const trimmed = p.trim();
      
      if (trimmed.startsWith('#')) {
        const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          return `<h${level}>${headerMatch[2]}</h${level}>`;
        }
      }
      
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const items = trimmed.split('\n').map(item => {
          const clean = item.replace(/^[-*]\s+/, '');
          return `<li>${clean}</li>`;
        });
        return `<ul>${items.join('')}</ul>`;
      }
      
      if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split('\n').map(item => {
          const clean = item.replace(/^\d+\.\s+/, '');
          return `<li>${clean}</li>`;
        });
        return `<ol>${items.join('')}</ol>`;
      }
      
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
  }

  private generateExcerpt(content: string, maxLength: number = 160): string {
    const textContent = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (textContent.length <= maxLength) {
      return textContent;
    }
    
    const truncated = textContent.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
  }

  static validateEndpointUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsed = new URL(url);
      
      if (parsed.protocol !== 'https:') {
        return { valid: false, error: 'WordPress GraphQL endpoint must use HTTPS for security' };
      }
      
      if (!parsed.pathname.includes('graphql')) {
        return { valid: false, error: 'URL does not appear to be a GraphQL endpoint (should contain "graphql" in path)' };
      }
      
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }
}

export async function getWordPressPublisher(
  config: WordpressConfig,
  getCredential: (key: string) => Promise<string | undefined>
): Promise<WordPressPublisher> {
  let password: string | undefined;
  let token: string | undefined;
  
  if (config.authType === 'jwt' && config.jwtToken) {
    token = await getCredential(config.jwtToken);
  } else if (config.credentialSecretKey) {
    password = await getCredential(config.credentialSecretKey);
  }
  
  return new WordPressPublisher(config, { password, token });
}
