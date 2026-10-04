import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    Modal,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface CategoryOption {
    id: string;
    name: string;
    icon?: string;
}

interface Props {
    label?: string;
    categories: CategoryOption[];
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    loading?: boolean;
    error?: string;
}

export const CategorySelect: React.FC<Props> = ({
    label,
    categories,
    value,
    onChange,
    placeholder = 'Search and select category...',
    loading = false,
    error,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const selected = categories.find((c) => c.id === value);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
    }, [categories, query]);

    const close = () => {
        setOpen(false);
        setQuery('');
    };

    const handleSelect = (id: string) => {
        onChange(id);
        close();
    };

    return (
        <View style={styles.wrapper}>
            {label ? <Text style={styles.label}>{label}</Text> : null}

            {/* Trigger */}
            <TouchableOpacity
                style={[styles.trigger, error ? styles.triggerError : null, open && styles.triggerActive]}
                onPress={() => setOpen(true)}
                activeOpacity={0.7}
                disabled={loading}
            >
                {loading ? (
                    <View style={styles.triggerContent}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.placeholder}>Loading categories...</Text>
                    </View>
                ) : selected ? (
                    <View style={styles.triggerContent}>
                        <Text style={styles.icon}>{selected.icon}</Text>
                        <Text style={styles.selectedText} numberOfLines={1}>{selected.name}</Text>
                    </View>
                ) : (
                    <Text style={styles.placeholder}>{placeholder}</Text>
                )}
                <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Searchable bottom sheet */}
            <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
                <KeyboardAvoidingView
                    style={styles.overlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <Pressable style={styles.backdrop} onPress={close} />
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Select Category</Text>
                            <TouchableOpacity onPress={close} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchBox}>
                            <Ionicons name="search" size={16} color={Colors.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search categories..."
                                placeholderTextColor={Colors.textMuted}
                                value={query}
                                onChangeText={setQuery}
                                autoCorrect={false}
                                autoCapitalize="none"
                                clearButtonMode="while-editing"
                            />
                            {query.length > 0 && Platform.OS === 'android' ? (
                                <TouchableOpacity onPress={() => setQuery('')}>
                                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        <FlatList
                            data={filtered}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No categories match "{query}"</Text>
                            }
                            renderItem={({ item }) => {
                                const isSelected = item.id === value;
                                return (
                                    <TouchableOpacity
                                        style={[styles.row, isSelected && styles.rowSelected]}
                                        onPress={() => handleSelect(item.id)}
                                        activeOpacity={0.6}
                                    >
                                        <Text style={styles.rowIcon}>{item.icon}</Text>
                                        <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>
                                            {item.name}
                                        </Text>
                                        {isSelected ? (
                                            <Ionicons name="checkmark" size={18} color={Colors.primary} />
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        minHeight: 50,
    },
    triggerActive: { borderColor: Colors.primary },
    triggerError: { borderColor: Colors.error },
    triggerContent: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    icon: { fontSize: 18 },
    selectedText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500', flex: 1 },
    placeholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
    errorText: { fontSize: 12, color: Colors.error, marginTop: 4 },

    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 24,
        height: '70%',
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
    closeBtn: { padding: 6, backgroundColor: Colors.background, borderRadius: 16 },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
        marginBottom: 8,
    },
    searchInput: { flex: 1, fontSize: 15, color: Colors.textPrimary, paddingVertical: 0 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    rowSelected: { backgroundColor: Colors.primaryLight },
    rowIcon: { fontSize: 20, width: 28, textAlign: 'center' },
    rowText: { flex: 1, fontSize: 15, color: Colors.textPrimary },
    rowTextSelected: { fontWeight: '700', color: Colors.primaryDark },
    emptyText: { textAlign: 'center', color: Colors.textMuted, paddingVertical: 24, fontSize: 14 },
});