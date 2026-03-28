import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, Wallet, Bell, LogOut, Pencil, Check, X, ChevronRight } from 'lucide-react-native';
import { colors, fonts, spacing, radius } from '../theme/colors';
import { insforge } from '../services/insforge';
import { useAuth } from '../context/AuthContext';

interface UserProfile {
  display_name: string | null;
  email: string;
  budget: number;
}

export const ProfileScreen = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    insforge.database
      .from('users')
      .select('display_name, email, budget')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[Profile] fetch error:', error);
        if (data) setProfile(data);
      });
  }, [user]);

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  function startEditing() {
    setNameInput(displayName);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  async function saveName() {
    const name = nameInput.trim();
    if (!name || !user) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await insforge.database
      .from('users')
      .update({ display_name: name })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      console.error('[Profile] update name error:', error);
      setSaveError(error.message);
    } else {
      setProfile(prev => prev ? { ...prev, display_name: name } : prev);
      setEditing(false);
    }
  }

  const displayEmail = profile?.email ?? user?.email ?? '—';
  const displayName = profile?.display_name ?? displayEmail.split('@')[0];

  const initials = displayName
    ? displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Profile</Text>

        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{displayEmail}</Text>
        </View>

        {/* Info rows */}
        <View style={styles.section}>
          {/* Editable name row */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <User size={16} color={colors.mutedForeground} />
              <Text style={styles.rowLabel}>Name</Text>
            </View>
            {editing ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  placeholderTextColor={colors.mutedForeground}
                />
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
                ) : (
                  <>
                    <TouchableOpacity onPress={saveName} style={styles.iconAction}>
                      <Check size={16} color={colors.dealGreen} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelEditing} style={styles.iconAction}>
                      <X size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <TouchableOpacity style={styles.editTrigger} onPress={startEditing}>
                <Text style={styles.rowValue}>{displayName}</Text>
                <Pencil size={13} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}
          </View>
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

          <Row icon={<Mail size={16} color={colors.mutedForeground} />} label="Email" value={displayEmail} />
          <Row icon={<Wallet size={16} color={colors.mutedForeground} />} label="Wallet Balance" value={profile ? `$${profile.budget.toFixed(2)}` : '—'} highlight />
        </View>

        {/* Settings rows */}
        <View style={styles.section}>
          <Row icon={<Bell size={16} color={colors.mutedForeground} />} label="Notifications" value="On" chevron />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={16} color={colors.primary} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

function Row({ icon, label, value, highlight, chevron }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  chevron?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        {icon}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, highlight && { color: colors.dealGreen, fontFamily: fonts.sansBold }]}>
          {value}
        </Text>
        {chevron && <ChevronRight size={14} color={colors.mutedForeground} style={{ marginLeft: 4 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl },
  heading: { fontFamily: fonts.sansBold, fontSize: 24, color: colors.foreground, marginBottom: spacing.xl },

  avatarSection: { alignItems: 'center', marginBottom: spacing.xxl },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  initials: { fontFamily: fonts.sansBold, fontSize: 26, color: '#fff' },
  name: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.foreground },
  email: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },

  section: {
    backgroundColor: colors.card, borderRadius: radius.card,
    marginBottom: spacing.md, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.foreground },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontFamily: fonts.sansRegular, fontSize: 14, color: colors.mutedForeground },

  editTrigger: { flexDirection: 'row', alignItems: 'center' },
  editRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  nameInput: {
    fontFamily: fonts.sansRegular, fontSize: 14,
    color: colors.foreground,
    borderBottomWidth: 1, borderBottomColor: colors.primary,
    paddingVertical: 2, paddingHorizontal: 4,
    minWidth: 120, textAlign: 'right',
  },
  iconAction: { padding: 6 },
  saveError: {
    fontFamily: fonts.sansRegular, fontSize: 12, color: '#ff6b6b',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 14,
    backgroundColor: colors.card, borderRadius: radius.card,
    marginTop: spacing.sm,
  },
  signOutText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.primary },
});
