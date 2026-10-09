import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Keyboard,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen } from '../../components/common/SafeScreen';
import { useTheme } from '../../store/themeStore';
import { ChatApi, ChatMessage, ChatSuggestion } from '../../api/chat';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'init_welcome',
  role: 'assistant',
  content:
    "Hello! I am your SafeCity AI Safety Assistant, powered by Gemini.\n\nI can help you with:\n• SafeCity SOS, Safe Routes, Live Map & reporting\n• Emergency do's and don'ts & first aid\n• Official Indian emergency helplines (112, 1091, 1098, 1930)\n• Verified legal rights (POSH Act, POCSO Act, IT Act, BNS/IPC)\n\nHow can I help protect you today?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  sources: ['SafeCity Verified Knowledge Base'],
};

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ChatSuggestion[]>([]);

  const flatListRef = useRef<FlatList>(null);

  // Load suggestions on mount
  useEffect(() => {
    ChatApi.getSuggestions()
      .then((res) => {
        if (res?.suggestions) setSuggestions(res.suggestions);
      })
      .catch(() => {});
  }, []);

  const handleSend = async (messageText?: string) => {
    const text = (messageText || inputText).trim();
    if (!text || isLoading) return;

    setErrorMsg(null);
    setInputText('');
    Keyboard.dismiss();

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await ChatApi.sendMessage(text, historyPayload);

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: res.is_emergency,
        suggestedActions: res.suggested_actions,
        sources: res.sources,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        'Unable to connect to SafeCity Assistant. Please check your network and try again.';
      setErrorMsg(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Call',
      'Call National Emergency Services (112)?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 112',
          style: 'destructive',
          onPress: () => Linking.openURL('tel:112'),
        },
      ]
    );
  };

  const handleResetChat = () => {
    Alert.alert('Reset Chat', 'Clear message history and start a new conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'default',
        onPress: () => {
          setMessages([
            {
              ...INITIAL_MESSAGE,
              id: `init_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          setErrorMsg(null);
        },
      },
    ]);
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        {!isUser && (
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="sparkles" size={14} color="#ffffff" />
          </View>
        )}

        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: colors.primary }]
              : item.isEmergency
              ? [styles.bubbleEmergency, { borderColor: colors.alert }]
              : [styles.bubbleAssistant, { backgroundColor: colors.surface, borderColor: colors.border }],
          ]}
        >
          {item.isEmergency && (
            <View style={styles.emergencyBanner}>
              <Ionicons name="warning" size={16} color={colors.alert} />
              <Text style={[styles.emergencyBannerText, { color: colors.alert }]}>
                IMMEDIATE DANGER PROTOCOL
              </Text>
            </View>
          )}

          <Text
            style={[
              styles.messageText,
              { color: isUser ? '#ffffff' : colors.textPrimary },
            ]}
          >
            {item.content}
          </Text>

          {/* Action chips */}
          {item.suggestedActions && item.suggestedActions.length > 0 && (
            <View style={styles.actionChipsContainer}>
              {item.suggestedActions.map((action, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.actionChip, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff' }]}
                  onPress={() => handleSend(action)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionChipText, { color: colors.primary }]}>
                    👉 {action}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Grounded sources tag */}
          {item.sources && item.sources.length > 0 && (
            <View style={styles.sourcesContainer}>
              <Text style={[styles.sourcesLabel, { color: colors.textSecondary }]}>Sources: </Text>
              <Text style={[styles.sourcesText, { color: colors.textSecondary }]}>
                {item.sources.join(' • ')}
              </Text>
            </View>
          )}

          <Text
            style={[
              styles.timestampText,
              { color: isUser ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
            ]}
          >
            {item.timestamp}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeScreen backgroundColor={colors.background}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>SafeCity AI</Text>
            <View style={[styles.geminiBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.geminiBadgeText, { color: colors.primary }]}>GEMINI</Text>
            </View>
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Grounded Safety & Legal Hub (India)
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.emergencyCallBtn, { backgroundColor: colors.alert }]}
            onPress={handleEmergencyCall}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={14} color="#ffffff" />
            <Text style={styles.emergencyCallText}>112</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetChat}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Emergency Disclaimer Bar ──────────────────────────── */}
      <View style={[styles.disclaimerBar, { backgroundColor: isDark ? '#2a2012' : '#fef3c7', borderBottomColor: isDark ? '#4a3b1a' : '#fde68a' }]}>
        <Ionicons name="shield-checkmark" size={14} color="#d97706" />
        <Text style={[styles.disclaimerText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
          Informational safety assistant. Dial 112 for active emergencies.
        </Text>
      </View>

      {/* ── Message FlatList ──────────────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <>
            {isLoading && (
              <View style={[styles.loadingBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  SafeCity AI is checking safety knowledge...
                </Text>
              </View>
            )}

            {errorMsg && (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: colors.alert }]}>
                <Ionicons name="alert-circle" size={16} color={colors.alert} />
                <Text style={[styles.errorText, { color: colors.alert }]}>{errorMsg}</Text>
              </View>
            )}
          </>
        }
      />

      {/* ── Quick Suggestions Bar ─────────────────────────────── */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <FlatList
            horizontal
            data={suggestions}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionChip, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => handleSend(item.question)}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionIcon}>{item.icon}</Text>
                <Text style={[styles.suggestionText, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.question}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* ── Bottom Input Row ──────────────────────────────────── */}
      <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { color: colors.textPrimary }]}
            placeholder="Ask about SOS, night safety, laws, or first aid..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={(txt) => setInputText(txt.slice(0, 600))}
            multiline
            maxLength={600}
            editable={!isLoading}
          />
          {inputText.length > 400 && (
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>
              {inputText.length}/600
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() && !isLoading ? colors.primary : colors.border,
            },
          ]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isLoading}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  geminiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  geminiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emergencyCallText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  resetBtn: {
    padding: 6,
  },
  disclaimerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  disclaimerText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bubbleEmergency: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 2,
    borderBottomLeftRadius: 4,
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  emergencyBannerText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionChipsContainer: {
    marginTop: 10,
    gap: 6,
  },
  actionChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sourcesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    alignItems: 'center',
  },
  sourcesLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  sourcesText: {
    fontSize: 10,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  loadingText: {
    fontSize: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  suggestionsContainer: {
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  suggestionsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 220,
  },
  suggestionIcon: {
    fontSize: 14,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputContainer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 44,
    maxHeight: 100,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    padding: 0,
    lineHeight: 18,
  },
  charCount: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
});
