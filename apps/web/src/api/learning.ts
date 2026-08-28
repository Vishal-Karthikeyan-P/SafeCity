import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────

export interface LearningCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  is_active: boolean
  created_at: string
}

export interface Article {
  id: string
  title: string
  slug: string
  overview: string
  content_dos: string | null
  content_donts: string | null
  emergency_steps: string | null
  helpline_numbers: string | null
  legal_info: string | null
  category_id: string
  category: LearningCategory | null
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface ArticleListResponse {
  items: Article[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface ArticleCreateInput {
  title: string
  overview: string
  content_dos?: string
  content_donts?: string
  emergency_steps?: string
  helpline_numbers?: string
  legal_info?: string
  category_id: string
  is_published?: boolean
}

// ── Public hooks ──────────────────────────────────────────────

export function useLearningCategories() {
  return useQuery({
    queryKey: ['learning-categories'],
    queryFn: async () => {
      const res = await api.get('/learning/categories')
      return res.data as LearningCategory[]
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useLearningArticles(
  page = 1,
  limit = 12,
  categoryId?: string,
  search?: string,
) {
  return useQuery({
    queryKey: ['learning-articles', page, limit, categoryId, search],
    queryFn: async () => {
      const res = await api.get('/learning/articles', {
        params: {
          page,
          limit,
          category_id: categoryId || undefined,
          search: search || undefined,
        },
      })
      return res.data as ArticleListResponse
    },
    placeholderData: (prev) => prev,
  })
}

export function useLearningArticle(slug: string) {
  return useQuery({
    queryKey: ['learning-article', slug],
    queryFn: async () => {
      const res = await api.get(`/learning/articles/${slug}`)
      return res.data as Article
    },
    enabled: !!slug,
  })
}

// ── Admin hooks ───────────────────────────────────────────────

export function useAdminArticles(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['admin-articles', page, limit],
    queryFn: async () => {
      const res = await api.get('/admin/articles', { params: { page, limit } })
      return res.data as ArticleListResponse
    },
  })
}

export function useCreateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ArticleCreateInput) => api.post('/admin/articles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-articles'] })
      qc.invalidateQueries({ queryKey: ['learning-articles'] })
    },
  })
}

export function useUpdateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ArticleCreateInput> }) =>
      api.patch(`/admin/articles/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-articles'] })
      qc.invalidateQueries({ queryKey: ['learning-articles'] })
    },
  })
}

export function useDeleteArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/articles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-articles'] })
      qc.invalidateQueries({ queryKey: ['learning-articles'] })
    },
  })
}
