import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, Wallet, Bell, LogOut, ChevronRight } from 'lucide-react-native';
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

  const displayEmail = profile?.email ?? user?.email ?? '—';
  const displayName = profile?.display_name ?? displayEmail.split('@')[0];

  const initials = displayName
    ? displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
          <Row icon={<User size={16} color={colors.mutedForeground} />} label="Name" value={displayName} />
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

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 14,
    backgroundColor: colors.card, borderRadius: radius.card,
    marginTop: spacing.sm,
  },
  signOutText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.primary },
});
