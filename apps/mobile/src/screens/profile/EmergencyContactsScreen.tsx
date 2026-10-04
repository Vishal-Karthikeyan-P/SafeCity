/**
 * EmergencyContactsScreen
 * User-to-user in-app emergency contacts:
 *  - Search SafeCity users
 *  - Send/revoke contact requests
 *  - Accept/reject incoming requests
 *  - View accepted contacts
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeScreen } from '../../components/common/SafeScreen';
import { useTheme } from '../../store/themeStore';
import {
  ContactRequestsApi,
  ContactRequest,
  UserSearchResult,
} from '../../api/contactRequests';

export const EmergencyContactsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const theme = useTheme();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'contacts' | 'incoming' | 'outgoing' | 'search'>(
    'contacts'
  );

  // Queries
  const { data: accepted = [], isLoading: loadingAccepted, refetch: refetchAccepted } =
    useQuery({ queryKey: ['contacts', 'accepted'], queryFn: ContactRequestsApi.listAccepted });

  const { data: incoming = [], isLoading: loadingIncoming, refetch: refetchIncoming } =
    useQuery({ queryKey: ['contacts', 'incoming'], queryFn: ContactRequestsApi.listIncoming });

  const { data: outgoing = [], isLoading: loadingOutgoing, refetch: refetchOutgoing } =
    useQuery({ queryKey: ['contacts', 'outgoing'], queryFn: ContactRequestsApi.listOutgoing });

  const { data: searchResults = [], isFetching: isSearching, refetch: runSearch } = useQuery({
    queryKey: ['contacts', 'search', searchQuery],
    queryFn: () => ContactRequestsApi.searchUsers(searchQuery),
    enabled: searchQuery.length >= 2 && activeTab === 'search',
    staleTime: 10000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['contacts'] });
  };

  // Mutations
  const sendMutation = useMutation({
    mutationFn: (contactId: string) => ContactRequestsApi.sendRequest(contactId),
    onSuccess: () => { invalidate(); Alert.alert('Request Sent', 'Emergency contact request sent successfully.'); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to send request'),
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => ContactRequestsApi.acceptRequest(requestId),
    onSuccess: () => { invalidate(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to accept'),
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => ContactRequestsApi.rejectRequest(requestId),
    onSuccess: () => { invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (requestId: string) => ContactRequestsApi.deleteRequest(requestId),
    onSuccess: () => { invalidate(); },
  });

  const handleRefresh = () => {
    refetchAccepted();
    refetchIncoming();
    refetchOutgoing();
  };

  const confirmRevoke = (req: ContactRequest, isAccepted: boolean) => {
    Alert.alert(
      isAccepted ? 'Remove Contact' : 'Cancel Request',
      isAccepted
        ? 'Remove this person as your emergency contact?'
        : 'Cancel this contact request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isAccepted ? 'Remove' : 'Cancel Request',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(req.id),
        },
      ]
    );
  };

  const s = makeStyles(theme);

  const renderAccepted = ({ item }: { item: ContactRequest }) => {
    const other = item.requester_id === item.contact_id
      ? item.contact
      : item.requester?.id === item.contact_id
        ? item.requester
        : item.contact;
    const name = other?.full_name || 'Unknown';
    const email = other?.email || '';
    return (
      <View style={s.contactRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.contactInfo}>
          <Text style={s.contactName}>{name}</Text>
          <Text style={s.contactEmail}>{email}</Text>
          <View style={s.acceptedBadge}>
            <Ionicons name="shield-checkmark" size={12} color={theme.safe} />
            <Text style={[s.badgeText, { color: theme.safe }]}>Emergency Contact</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.removeBtn}
          onPress={() => confirmRevoke(item, true)}
        >
          <Ionicons name="person-remove-outline" size={18} color={theme.error} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderIncoming = ({ item }: { item: ContactRequest }) => {
    const requester = item.requester;
    return (
      <View style={s.contactRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(requester?.full_name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.contactInfo}>
          <Text style={s.contactName}>{requester?.full_name || 'Unknown'}</Text>
          <Text style={s.contactEmail}>{requester?.email || ''}</Text>
          {item.message ? <Text style={s.requestMessage}>"{item.message}"</Text> : null}
        </View>
        <View style={s.actionBtns}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.safe }]}
            onPress={() => acceptMutation.mutate(item.id)}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.error }]}
            onPress={() => rejectMutation.mutate(item.id)}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderOutgoing = ({ item }: { item: ContactRequest }) => {
    const contact = item.contact;
    const statusColor =
      item.status === 'accepted' ? theme.safe :
      item.status === 'rejected' ? theme.error :
      theme.textMuted;
    return (
      <View style={s.contactRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(contact?.full_name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.contactInfo}>
          <Text style={s.contactName}>{contact?.full_name || 'Unknown'}</Text>
          <Text style={s.contactEmail}>{contact?.email || ''}</Text>
          <Text style={[s.statusText, { color: statusColor }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
        {item.status === 'pending' && (
          <TouchableOpacity
            style={s.removeBtn}
            onPress={() => confirmRevoke(item, false)}
          >
            <Ionicons name="close-circle-outline" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => {
    const alreadySent = outgoing.some(
      (r) => r.contact?.id === item.id || r.contact_id === item.id
    );
    const isContact = accepted.some(
      (r) => r.requester?.id === item.id || r.contact?.id === item.id
    );
    return (
      <View style={s.contactRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.contactInfo}>
          <Text style={s.contactName}>{item.full_name}</Text>
          <Text style={s.contactEmail}>{item.email}</Text>
        </View>
        {isContact ? (
          <View style={s.alreadyBadge}>
            <Ionicons name="checkmark-circle" size={16} color={theme.safe} />
            <Text style={[s.badgeText, { color: theme.safe }]}>Contact</Text>
          </View>
        ) : alreadySent ? (
          <Text style={[s.badgeText, { color: theme.textMuted }]}>Sent</Text>
        ) : (
          <TouchableOpacity
            style={[s.addBtn, { borderColor: theme.primary }]}
            onPress={() => sendMutation.mutate(item.id)}
            disabled={sendMutation.isPending}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="person-add-outline" size={18} color={theme.primary} />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const tabs = [
    { key: 'contacts', label: 'Contacts', icon: 'people', count: accepted.length },
    { key: 'incoming', label: 'Requests', icon: 'mail', count: incoming.length },
    { key: 'outgoing', label: 'Sent', icon: 'paper-plane', count: null },
    { key: 'search', label: 'Find', icon: 'search', count: null },
  ] as const;

  const isLoading = loadingAccepted || loadingIncoming || loadingOutgoing;

  return (
    <SafeScreen backgroundColor={theme.background}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.darkHeader }]}>
        {navigation && (
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <View>
          <Text style={s.headerTitle}>Emergency Contacts</Text>
          <Text style={s.headerSub}>SafeCity users who'll be notified during SOS</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, active && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={active ? theme.primary : theme.textMuted}
              />
              {tab.count !== null && tab.count > 0 && (
                <View style={[s.badge, { backgroundColor: theme.primary }]}>
                  <Text style={s.badgeCount}>{tab.count}</Text>
                </View>
              )}
              <Text style={[s.tabLabel, { color: active ? theme.primary : theme.textMuted }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Input */}
      {activeTab === 'search' && (
        <View style={[s.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={[s.searchInput, { color: theme.textPrimary }]}
            placeholder="Search by name or email..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Lists */}
      {activeTab === 'contacts' && (
        <FlatList
          data={accepted}
          keyExtractor={(i) => i.id}
          renderItem={renderAccepted}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={48} color={theme.textMuted} />
              <Text style={[s.emptyText, { color: theme.textMuted }]}>
                No emergency contacts yet.{'\n'}Use "Find" to search for SafeCity users.
              </Text>
            </View>
          }
          contentContainerStyle={accepted.length === 0 ? s.emptyContainer : undefined}
        />
      )}

      {activeTab === 'incoming' && (
        <FlatList
          data={incoming}
          keyExtractor={(i) => i.id}
          renderItem={renderIncoming}
          refreshControl={<RefreshControl refreshing={loadingIncoming} onRefresh={refetchIncoming} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="mail-open-outline" size={48} color={theme.textMuted} />
              <Text style={[s.emptyText, { color: theme.textMuted }]}>No pending requests</Text>
            </View>
          }
          contentContainerStyle={incoming.length === 0 ? s.emptyContainer : undefined}
        />
      )}

      {activeTab === 'outgoing' && (
        <FlatList
          data={outgoing}
          keyExtractor={(i) => i.id}
          renderItem={renderOutgoing}
          refreshControl={<RefreshControl refreshing={loadingOutgoing} onRefresh={refetchOutgoing} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="paper-plane-outline" size={48} color={theme.textMuted} />
              <Text style={[s.emptyText, { color: theme.textMuted }]}>No outgoing requests</Text>
            </View>
          }
          contentContainerStyle={outgoing.length === 0 ? s.emptyContainer : undefined}
        />
      )}

      {activeTab === 'search' && (
        <FlatList
          data={searchResults}
          keyExtractor={(i) => i.id}
          renderItem={renderSearchResult}
          ListHeaderComponent={
            isSearching ? <ActivityIndicator style={{ margin: 16 }} color={theme.primary} /> : null
          }
          ListEmptyComponent={
            searchQuery.length >= 2 && !isSearching ? (
              <View style={s.empty}>
                <Text style={[s.emptyText, { color: theme.textMuted }]}>No users found</Text>
              </View>
            ) : searchQuery.length < 2 ? (
              <View style={s.empty}>
                <Text style={[s.emptyText, { color: theme.textMuted }]}>
                  Type at least 2 characters to search
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={searchResults.length === 0 ? s.emptyContainer : undefined}
        />
      )}
    </SafeScreen>
  );
};

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
    },
    tabLabel: { fontSize: 11, fontWeight: '600' },
    badge: {
      width: 16, height: 16, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    badgeCount: { fontSize: 9, color: '#fff', fontWeight: '700' },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 15 },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 12,
    },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: theme.primaryMuted,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '700', color: theme.primary },
    contactInfo: { flex: 1 },
    contactName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
    contactEmail: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
    requestMessage: { fontSize: 12, color: theme.textSecondary, fontStyle: 'italic', marginTop: 4 },
    statusText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    acceptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    alreadyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    removeBtn: { padding: 8 },
    addBtn: { padding: 8, borderRadius: 20, borderWidth: 1.5 },
    actionBtns: { flexDirection: 'row', gap: 6 },
    actionBtn: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    empty: { alignItems: 'center', paddingTop: 32, gap: 12 },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
    emptyContainer: { flex: 1 },
  });
