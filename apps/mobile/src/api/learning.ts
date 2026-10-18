import { apiClient } from './client';

export interface LearningCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  overview: string;
  content_dos: string | null;
  content_donts: string | null;
  emergency_steps: string | null;
  helpline_numbers: string | null;
  legal_info: string | null;
  category_id: string;
  category: LearningCategory | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArticleListResponse {
  items: Article[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const LearningApi = {
  async getCategories(): Promise<LearningCategory[]> {
    const res = await apiClient.get<LearningCategory[]>('/learning/categories');
    return res.data;
  },

  async getArticles(
    page: number = 1,
    limit: number = 20,
    categoryId?: string,
    search?: string
  ): Promise<ArticleListResponse> {
    const params: Record<string, any> = { page, limit };
    if (categoryId) params.category_id = categoryId;
    if (search && search.trim().length > 0) params.search = search.trim();
    const res = await apiClient.get<ArticleListResponse>('/learning/articles', { params });
    return res.data;
  },

  async getArticle(slugOrId: string): Promise<Article> {
    const res = await apiClient.get<Article>(`/learning/articles/${slugOrId}`);
    return res.data;
  },
};
