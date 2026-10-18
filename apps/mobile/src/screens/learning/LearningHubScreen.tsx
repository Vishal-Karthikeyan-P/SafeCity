import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types/navigation';
import { LearningApi, Article, LearningCategory } from '../../api/learning';
import { useTheme } from '../../store/themeStore';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type RoutePropType = RouteProp<MainStackParamList, 'LearningHub'>;

// ─── Article Detail Modal ───────────────────────────────────────────────────

interface ArticleDetailModalProps {
  article: Article | null;
  visible: boolean;
  onClose: () => void;
  onAskChatbot: (title: string) => void;
}

const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article,
  visible,
  onClose,
  onAskChatbot,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  if (!article) return null;

  const sections = [
    { label: "What To Do (Do's)", icon: 'checkmark-circle' as const, color: '#16a34a', bg: isDark ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7', content: article.content_dos },
    { label: "What Not To Do (Don'ts)", icon: 'close-circle' as const, color: '#dc2626', bg: isDark ? 'rgba(220, 38, 38, 0.15)' : '#fee2e2', content: article.content_donts },
    { label: 'Emergency Steps', icon: 'alert-circle' as const, color: '#ea580c', bg: isDark ? 'rgba(234, 88, 12, 0.15)' : '#ffedd5', content: article.emergency_steps },
    { label: 'Helpline Numbers', icon: 'call' as const, color: '#2563eb', bg: isDark ? 'rgba(37, 99, 235, 0.15)' : '#dbeafe', content: article.helpline_numbers },
    { label: 'Legal Information', icon: 'ribbon' as const, color: '#9333ea', bg: isDark ? 'rgba(147, 51, 234, 0.15)' : '#f3e8ff', content: article.legal_info },
  ].filter((s) => Boolean(s.content));

  const handleDial = (text: string) => {
    // Look for phone number in helpline text
    const match = text.match(/\d{3,}/);
    if (match) {
      Linking.openURL(`tel:${match[0]}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[modalStyles.container, { backgroundColor: colors.background, paddingTop: insets.top || 16 }]}>
        {/* Header */}
        <View style={[modalStyles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={modalStyles.headerLeft}>
            {article.category ? (
              <View style={[modalStyles.categoryBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={modalStyles.categoryIcon}>{article.category.icon}</Text>
                <Text style={[modalStyles.categoryName, { color: colors.primaryDark }]}>{article.category.name}</Text>
              </View>
            ) : null}
            <Text style={[modalStyles.title, { color: colors.textPrimary }]} numberOfLines={2}>
              {article.title}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[modalStyles.closeBtn, { backgroundColor: colors.background }]}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={modalStyles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Overview Card */}
          <View style={[modalStyles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[modalStyles.overviewLabel, { color: colors.textMuted }]}>Overview</Text>
            <Text style={[modalStyles.overviewText, { color: colors.textPrimary }]}>{article.overview}</Text>
          </View>

          {/* Structured Sections */}
          {sections.map(({ label, icon, color, bg, content }) => (
            <View key={label} style={[modalStyles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[modalStyles.sectionHeader, { backgroundColor: bg }]}>
                <Ionicons name={icon} size={18} color={color} />
                <Text style={[modalStyles.sectionTitle, { color }]}>{label}</Text>
              </View>
              <View style={modalStyles.sectionBody}>
                {content!.split('\n').map((line, idx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  const isHelpline = label === 'Helpline Numbers' && /\d{3,}/.test(trimmed);
                  return (
                    <View key={idx} style={modalStyles.bulletRow}>
                      <Text style={[modalStyles.bulletDot, { color }]}>•</Text>
                      <Text style={[modalStyles.bulletText, { color: colors.textPrimary }]}>
                        {trimmed}
                      </Text>
                      {isHelpline && (
                        <TouchableOpacity
                          style={[modalStyles.callBtn, { backgroundColor: colors.primary }]}
                          onPress={() => handleDial(trimmed)}
                        >
                          <Ionicons name="call" size={14} color="#ffffff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Ask SafeBot Chatbot Banner */}
          <TouchableOpacity
            style={[modalStyles.chatbotBanner, { backgroundColor: colors.primary }]}
            onPress={() => {
              onClose();
              onAskChatbot(article.title);
            }}
            activeOpacity={0.9}
          >
            <View style={modalStyles.chatbotIconWrap}>
              <Ionicons name="sparkles" size={24} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.chatbotTitle}>Have questions about this topic?</Text>
              <Text style={modalStyles.chatbotSubtitle}>Ask SafeBot AI for instant safety advice & assistance</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ─── Main Learning Hub Screen ────────────────────────────────────────────────

export const LearningHubScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    route.params?.categoryId || null
  );
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Fetch categories
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['learning-categories'],
    queryFn: LearningApi.getCategories,
  });

  // Fetch articles
  const {
    data: articlesData,
    isLoading: isArticlesLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['learning-articles', selectedCategoryId, searchQuery],
    queryFn: () => LearningApi.getArticles(1, 30, selectedCategoryId || undefined, searchQuery || undefined),
  });

  const articles = articlesData?.items || [];

  const handleAskChatbot = (topic: string) => {
    navigation.navigate('Chat');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.background }]}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Learning Hub</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Safety guidelines, emergency steps & legal rights
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.chatBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => navigation.navigate('Chat')}
          >
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search guides, laws, emergency steps..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsList}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              {
                backgroundColor: !selectedCategoryId ? colors.primary : colors.background,
                borderColor: !selectedCategoryId ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text
              style={[
                styles.categoryChipText,
                { color: !selectedCategoryId ? '#ffffff' : colors.textSecondary },
              ]}
            >
              All Topics
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedCategoryId(isSelected ? null : cat.id)}
              >
                <Text style={styles.chipIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: isSelected ? '#ffffff' : colors.textSecondary },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Articles Feed */}
      {isArticlesLoading && !isRefetching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading safety guides...</Text>
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="book-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No guides found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Try clearing your search or selecting a different category.
          </Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[colors.primary]} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.articleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setSelectedArticle(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                {item.category ? (
                  <View style={[styles.cardCatBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={styles.cardCatIcon}>{item.category.icon}</Text>
                    <Text style={[styles.cardCatText, { color: colors.primaryDark }]}>{item.category.name}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>

              <Text style={[styles.articleTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.articleOverview, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.overview}
              </Text>

              <View style={styles.cardFooter}>
                {item.emergency_steps && (
                  <View style={[styles.tag, { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.15)' : '#ffedd5' }]}>
                    <Ionicons name="alert-circle" size={12} color="#ea580c" />
                    <Text style={[styles.tagText, { color: '#ea580c' }]}>Emergency Steps</Text>
                  </View>
                )}
                {item.helpline_numbers && (
                  <View style={[styles.tag, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#dbeafe' }]}>
                    <Ionicons name="call" size={12} color="#2563eb" />
                    <Text style={[styles.tagText, { color: '#2563eb' }]}>Helpline</Text>
                  </View>
                )}
                {item.legal_info && (
                  <View style={[styles.tag, { backgroundColor: isDark ? 'rgba(147, 51, 234, 0.15)' : '#f3e8ff' }]}>
                    <Ionicons name="ribbon" size={12} color="#9333ea" />
                    <Text style={[styles.tagText, { color: '#9333ea' }]}>Legal Rights</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Article Detail View Modal */}
      <ArticleDetailModal
        article={selectedArticle}
        visible={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        onAskChatbot={handleAskChatbot}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  chatBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },

  categoryChipsList: { gap: 8, paddingVertical: 4 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, gap: 6 },
  chipIcon: { fontSize: 14 },
  categoryChipText: { fontSize: 13, fontWeight: '600' },

  listContent: { padding: 16, gap: 12 },
  articleCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardCatBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  cardCatIcon: { fontSize: 12 },
  cardCatText: { fontSize: 11, fontWeight: '700' },
  articleTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  articleOverview: { fontSize: 13, lineHeight: 19 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  loadingText: { fontSize: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerLeft: { flex: 1, gap: 6 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  categoryIcon: { fontSize: 12 },
  categoryName: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },

  scrollContent: { padding: 20, gap: 16, paddingBottom: 40 },
  overviewCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  overviewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  overviewText: { fontSize: 14, lineHeight: 22 },

  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionBody: { padding: 16, gap: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { fontSize: 16, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },
  callBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  chatbotBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, gap: 12, marginTop: 8 },
  chatbotIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  chatbotTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  chatbotSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
});
