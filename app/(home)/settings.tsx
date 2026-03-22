import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Href, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EtherealBackdrop } from '@/components/ethereal-screen';
import { EtherealColors, EtherealSurface } from '@/constants/ethereal-theme';
import { Fonts } from '@/constants/theme';
import { setNeedsOnboardingFlag } from '@/lib/onboarding-flag';
import { postJson, putJson } from '@/lib/api';
import { useEngagement } from '@/contexts/EngagementContext';

const BG = '#07060E';

type ActionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'default' | 'danger';
};

function ActionRow({
  icon, title, description, onPress, disabled, loading, tone = 'default',
}: ActionRowProps) {
  const iconColor  = tone === 'danger' ? EtherealColors.error  : EtherealColors.primary;
  const titleColor = tone === 'danger' ? EtherealColors.error  : EtherealColors.textPrimary;
  const iconBg     = tone === 'danger' ? 'rgba(255, 142, 163, 0.12)' : EtherealColors.primarySoft;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionRow,
        pressed && !disabled && styles.actionRowPressed,
        disabled && styles.actionRowDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
        {loading
          ? <ActivityIndicator size="small" color={iconColor} />
          : <Ionicons name={icon} size={18} color={iconColor} />
        }
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: titleColor }]}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={EtherealColors.textMuted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut, setActive } = useClerk();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { engagement, level, refresh } = useEngagement();

  const [isSigningOut,        setIsSigningOut]        = useState(false);
  const [isPrimingOnboarding, setIsPrimingOnboarding] = useState(false);
  const [statusMessage,       setStatusMessage]       = useState<string | null>(null);
  const [statusTone,          setStatusTone]          = useState<'success' | 'error'>('success');
  const [timezoneInput,       setTimezoneInput]       = useState(engagement?.timezone ?? '');
  const [birthdayInput,       setBirthdayInput]       = useState(engagement?.birthday ?? '');
  const [cityInput,           setCityInput]           = useState(engagement?.city ?? '');
  const [inviteCode,          setInviteCode]          = useState('');
  const [joinCode,            setJoinCode]            = useState('');

  const getHeaders = useCallback(async () => {
    try {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }, [getToken]);

  const emailAddress =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    'Signed-in account';

  const handleBackHome       = () => router.replace('/(home)' as Href);
  const handleReplayOnboarding = () => router.push('/(home)/onboarding' as Href);

  const handlePrimeOnboarding = async () => {
    setStatusMessage(null);
    setIsPrimingOnboarding(true);
    try {
      await setNeedsOnboardingFlag(true);
      setStatusTone('success');
      setStatusMessage('Onboarding has been queued for the next sign-in.');
    } catch (error) {
      console.error('Failed to save onboarding preference:', error);
      setStatusTone('error');
      setStatusMessage('Unable to save that preference right now. Please try again.');
    } finally {
      setIsPrimingOnboarding(false);
    }
  };

  const performSignOut = async () => {
    setStatusMessage(null);
    setIsSigningOut(true);
    try {
      await signOut({ redirectUrl: undefined });
      await setActive({ session: null });
      router.replace('/(auth)/sign-in' as Href);
    } catch (error) {
      console.error('Logout failed:', error);
      setStatusTone('error');
      setStatusMessage('Logout failed. Please try again.');
      setIsSigningOut(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Log out', 'Do you want to sign out of Vera on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: performSignOut },
    ]);
  };

  const handleSaveEngagement = async () => {
    try {
      const headers = await getHeaders();
      await putJson('/engagement/settings', {
        timezone: timezoneInput || undefined,
        birthday: birthdayInput || undefined,
        city:     cityInput     || undefined,
      }, headers);
      setStatusTone('success');
      setStatusMessage('Settings saved.');
      refresh();
    } catch {
      setStatusTone('error');
      setStatusMessage('Failed to save settings.');
    }
  };

  const handleCreateInvite = async () => {
    try {
      const headers = await getHeaders();
      const res = await postJson<{ invite_code: string }>('/companion/invite', {}, headers);
      setInviteCode(res.invite_code);
    } catch {
      Alert.alert('Error', 'Could not create invite.');
    }
  };

  const handleJoinCompanion = async () => {
    if (!joinCode.trim()) return;
    try {
      const headers = await getHeaders();
      await postJson('/companion/join', { invite_code: joinCode.trim() }, headers);
      setStatusTone('success');
      setStatusMessage('Companion linked!');
      setJoinCode('');
    } catch {
      setStatusTone('error');
      setStatusMessage('Invalid or expired invite code.');
    }
  };

  const handleOpenShare = () => router.push('/(home)/share' as Href);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <EtherealBackdrop />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={handleBackHome}>
              <Ionicons name="arrow-back" size={18} color={EtherealColors.textSecondary} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Settings</Text>
              <Text style={styles.title}>Account & controls</Text>
            </View>
          </View>

          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <Ionicons name="person-outline" size={22} color={EtherealColors.primary} />
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileTitle}>{user?.fullName || 'Vera account'}</Text>
              <Text style={styles.profileSubtitle}>{emailAddress}</Text>
            </View>
          </View>

          {/* Status banner */}
          {statusMessage ? (
            <View style={[
              styles.messageBox,
              statusTone === 'error' ? styles.messageBoxError : styles.messageBoxSuccess,
            ]}>
              <Text style={[
                styles.messageText,
                { color: statusTone === 'error' ? EtherealColors.error : EtherealColors.success },
              ]}>
                {statusMessage}
              </Text>
            </View>
          ) : null}

          {/* Workspace */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Workspace</Text>
            <ActionRow
              icon="chatbubble-ellipses-outline"
              title="Back to conversation"
              description="Return to the main voice screen."
              onPress={handleBackHome}
            />
            <View style={styles.divider} />
            <ActionRow
              icon="refresh-outline"
              title="Run onboarding again"
              description="Open onboarding now and update your context."
              onPress={handleReplayOnboarding}
            />
            <View style={styles.divider} />
            <ActionRow
              icon="sparkles-outline"
              title="Show onboarding next sign-in"
              description="Save onboarding to appear automatically after you sign in again."
              onPress={handlePrimeOnboarding}
              disabled={isPrimingOnboarding}
              loading={isPrimingOnboarding}
            />
          </View>

          {/* Personalization */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Personalization</Text>
            {level > 0 && (
              <View style={styles.levelRow}>
                <Text style={styles.levelLabel}>Relationship Level</Text>
                <Text style={styles.levelValue}>Level {level}</Text>
              </View>
            )}
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Timezone</Text>
              <TextInput
                style={styles.input}
                value={timezoneInput}
                onChangeText={setTimezoneInput}
                placeholder="e.g. America/New_York"
                placeholderTextColor={EtherealColors.textMuted}
                keyboardAppearance="dark"
              />
            </View>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Birthday</Text>
              <TextInput
                style={styles.input}
                value={birthdayInput}
                onChangeText={setBirthdayInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={EtherealColors.textMuted}
                keyboardAppearance="dark"
              />
            </View>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.input}
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="e.g. New York"
                placeholderTextColor={EtherealColors.textMuted}
                keyboardAppearance="dark"
              />
            </View>
            <Pressable style={styles.saveBtn} onPress={handleSaveEngagement}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </Pressable>
          </View>

          {/* Social */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Social</Text>
            <ActionRow
              icon="share-outline"
              title="Share a moment"
              description="Create a beautiful card from a conversation quote."
              onPress={handleOpenShare}
            />
            <View style={styles.divider} />
            <ActionRow
              icon="people-outline"
              title="Invite a companion"
              description="Share Vera with a partner or close friend."
              onPress={handleCreateInvite}
            />
            {inviteCode ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Your invite code</Text>
                <Text style={styles.codeValue}>{inviteCode}</Text>
              </View>
            ) : null}
            <View style={styles.joinRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="Enter invite code"
                placeholderTextColor={EtherealColors.textMuted}
                autoCapitalize="characters"
                keyboardAppearance="dark"
              />
              <Pressable style={styles.joinBtn} onPress={handleJoinCompanion}>
                <Text style={styles.joinBtnText}>Join</Text>
              </Pressable>
            </View>
          </View>

          {/* Session */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Session</Text>
            <ActionRow
              icon="log-out-outline"
              title="Log out"
              description="Sign out securely and return to the auth screens."
              onPress={handleSignOut}
              disabled={isSigningOut}
              loading={isSigningOut}
              tone="danger"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  backButton: {
    backgroundColor: EtherealColors.surfaceStrong,
    borderWidth: 1,
    borderColor: EtherealColors.outline,
    width: 48,
    height: 48,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: EtherealColors.primary,
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: EtherealColors.textPrimary,
    fontSize: 26,
    fontFamily: Fonts.heading,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  profileCard: {
    ...EtherealSurface.cardRaised,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: EtherealColors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCopy: {
    flex: 1,
    gap: 3,
  },
  profileTitle: {
    color: EtherealColors.textPrimary,
    fontSize: 17,
    fontFamily: Fonts.bodyBold,
  },
  profileSubtitle: {
    color: EtherealColors.textMuted,
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  messageBox: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageBoxSuccess: {
    backgroundColor: 'rgba(125, 211, 168, 0.1)',
    borderColor: 'rgba(125, 211, 168, 0.2)',
  },
  messageBoxError: {
    backgroundColor: 'rgba(167, 1, 56, 0.18)',
    borderColor: 'rgba(255, 142, 163, 0.2)',
  },
  messageText: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    lineHeight: 18,
  },
  sectionCard: {
    ...EtherealSurface.card,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 2,
  },
  sectionLabel: {
    color: EtherealColors.textMuted,
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: EtherealColors.outlineSoft,
    marginVertical: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  actionRowPressed: {
    opacity: 0.75,
  },
  actionRowDisabled: {
    opacity: 0.5,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  actionDescription: {
    color: EtherealColors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.body,
    lineHeight: 17,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  levelLabel: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    color: EtherealColors.textSecondary,
  },
  levelValue: {
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
    color: EtherealColors.primary,
  },
  inputRow: {
    gap: 6,
    paddingVertical: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: EtherealColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: EtherealColors.inputBackground,
    borderWidth: 1,
    borderColor: EtherealColors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: Fonts.body,
    color: EtherealColors.textPrimary,
  },
  saveBtn: {
    backgroundColor: EtherealColors.primary,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: EtherealColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnText: {
    color: '#07060E',
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
  },
  codeBox: {
    backgroundColor: EtherealColors.primarySoft,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(160, 146, 255, 0.2)',
  },
  codeLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodyMedium,
    color: EtherealColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 22,
    fontFamily: Fonts.bodyBold,
    color: EtherealColors.primary,
    letterSpacing: 3,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 6,
  },
  joinBtn: {
    backgroundColor: EtherealColors.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 11,
    shadowColor: EtherealColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  joinBtnText: {
    color: '#07060E',
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
  },
});
