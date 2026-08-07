import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, BookOpen, AlertCircle } from 'lucide-react'
import { useLearningArticles, useLearningCategories } from '@/api/learning'

export function LearningHubPage() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  
  const { data: categories } = useLearningCategories()
  const { data: articles, isLoading } = useLearningArticles(1, 10, categoryId, search)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Safety Learning Hub</h1>
          <p className="text-gray-500 dark:text-gray-400">Guides, best practices, and emergency procedures.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search articles..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button 
            variant={!categoryId ? 'default' : 'outline'}
            onClick={() => setCategoryId(undefined)}
          >
            All
          </Button>
          {categories?.map((c: any) => (
            <Button 
              key={c.id}
              variant={categoryId === c.id ? 'default' : 'outline'}
              onClick={() => setCategoryId(c.id)}
            >
              {c.icon} {c.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p>Loading articles...</p>
        ) : articles?.items?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No articles found.</p>
          </div>
        ) : (
          articles?.items?.map((article: any) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="text-sm font-medium px-2 py-1 bg-primary/10 text-primary rounded-full mb-2 inline-block">
                    {article.category?.name || 'Article'}
                  </div>
                </div>
                <CardTitle className="text-xl">{article.title}</CardTitle>
                <CardDescription className="line-clamp-2">{article.overview}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-gray-500 mt-2">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" /> Read more
                  </span>
                  {article.emergency_steps && (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertCircle className="w-4 h-4" /> Emergency steps
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
