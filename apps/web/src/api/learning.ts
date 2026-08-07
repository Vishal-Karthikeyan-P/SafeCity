import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useLearningCategories() {
  return useQuery({
    queryKey: ['learning-categories'],
    queryFn: async () => {
      const res = await api.get('/learning/categories')
      return res.data
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useLearningArticles(page = 1, limit = 10, categoryId?: string, search?: string) {
  return useQuery({
    queryKey: ['learning-articles', page, limit, categoryId, search],
    queryFn: async () => {
      const res = await api.get('/learning/articles', {
        params: { page, limit, category_id: categoryId, search },
      })
      return res.data
    },
  })
}

export function useLearningArticle(slug: string) {
  return useQuery({
    queryKey: ['learning-article', slug],
    queryFn: async () => {
      const res = await api.get(`/learning/articles/${slug}`)
      return res.data
    },
    enabled: !!slug,
  })
}
