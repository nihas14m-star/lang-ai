/**
 * Lang AI Home Screen - Daily mission, level, streak, and activity hub.
 */

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Progress } from '../components/ui/Progress';
import { Chip } from '../components/ui/Chip';
import { Banner } from '../components/ui/Banner';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { Illustration } from '../components/ui/Illustration';
import { Badge } from '../components/ui/Badge';
import { useAppStore, selectLevelSummary } from '../state/store';
import { useTheme } from '../core/ThemeContext';
import { Spacing, Typography } from '../core/design';
import { CEFR_DISCLAIMER } from '../../../shared/src/cefr';
import { progressToNextLevel } from '../../../shared/src/scoring';
import type { MissionActivity } from '../../../shared/src/mission';

const ACTIVITY_ROUTES: Record<MissionActivity['kind'], string> = {
  vocabulary_review: '/review',
  mistake_review: '/review',
  grammar_drill: '/grammar',
  speaking: '/speaking',
  conversation: '/conversation',
  listening: '/listening',
  writing: '/writing',
};

export default function Home() {
  const router = useRouter();
  const { colors, spacing, typography, shadows, radius, animations } = useTheme();
  const { profile, mission, missionCompleted, streak, connection, ready, vocabCount } = useAppStore();
  const refreshMission = useAppStore((s) => s.refreshMission);
  const checkConnection = useAppStore((s) => s.checkConnection);
  const summary = selectLevelSummary(profile);

  useFocusEffect(
    React.useCallback(() => {
      void refreshMission();
      void checkConnection();
    }, [refreshMission, checkConnection]),
  );

  React.useEffect(() => {
    if (ready && !profile) {
      router.replace('/onboarding');
    }
  }, [ready, profile, router]);

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ ...Typography.bodyMedium, color: '#525252' }}>Setting up Lang AI.</Text>
      </View>
    );
  }

  const dueBadge = vocabCount > 0;
  const minutesDone = mission
    ? mission.activities
        .filter((_, i) => missionCompleted.includes(i.toString()))
        .reduce((a, x) => a + x.minutes, 0)
    : 0;
  const missionProgress = mission && mission.totalMinutes > 0 ? minutesDone / mission.totalMinutes : 0;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Connection status banners */}
      {connection === 'offline' && (
        <Banner tone="warn" style={styles.banner}>
          <Text>Offline - practice continues with built-in exercises. Connect to unlock your AI tutor.</Text>
        </Banner>
      )}
      {connection === 'degraded' && (
        <Banner tone="info" style={styles.banner}>
          <Text>Running in offline mode - using built-in rule-based tutor. Set NVIDIA_API_KEY on the backend for full AI feedback.</Text>
        </Banner>
      )}

      {/* Greeting & Level Card */}
      <View style={styles.greetingSection}>
        <View style={styles.greetingContent}>
          <View style={styles.greetingText}>
            <Text style={[Typography.headlineLarge, { color: '#1A1A1A' }]}>
              Good morning, {profile.name || 'there'} (sun)
            </Text>
            <Text style={{ ...Typography.bodyMedium, color: '#525252', marginTop: 4 }}>
              Ready to improve your English today?
            </Text>
          </View>
          <Avatar
            name={profile.name || 'User'}
            size="lg"
            status={connection === 'online' ? 'online' : connection === 'degraded' ? 'away' : 'offline'}
            statusPosition="bottom-right"
          />
        </View>
      </View>

      {/* Level & Streak Card */}
      <Card variant="elevated" style={styles.levelCard}>
        <View style={styles.levelRow}>
          <View style={styles.levelItem}>
            <Text style={styles.levelLabel}>Estimated Level</Text>
            <View style={styles.levelValueRow}>
              <Text style={{ ...Typography.displayMedium, color: '#2D7D32' }}>
                {summary?.level ?? '-'}
              </Text>
              <View style={styles.levelBadge}>
                <Text style={{ ...Typography.overline, color: '#2D7D32', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  {summary?.confidence ?? 'low'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.levelItem}>
            <Text style={styles.levelLabel}>Streak</Text>
            <Text style={{ ...Typography.displayMedium, color: '#D4A843' }}>{streak} (fire)</Text>
          </View>
          <View style={styles.levelItem}>
            <Text style={styles.levelLabel}>Today</Text>
            <Text style={{ ...Typography.displayMedium, color: '#2D7D32' }}>{minutesDone}/{mission?.totalMinutes || 15} min</Text>
          </View>
        </View>
        
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>Progress to next level</Text>
          <Progress
            value={progressToNextLevel(profile.skillScores, profile.cefrLevel as any)}
            size="md"
            showLabel
            animated
          />
          <Text style={[Typography.caption, { color: '#A3A3A3', fontStyle: 'italic', marginTop: 8 }]}>
            {CEFR_DISCLAIMER}
          </Text>
        </View>
      </Card>

      {/* Today's Mission */}
      <SectionHeader
        title="Today's Practice"
        action={
          mission && (
            <Chip
              label={`${minutesDone}/${mission.totalMinutes || 15} min`}
              variant={minutesDone >= (mission.totalMinutes || 0) ? 'success' : 'default'}
              size="sm"
            />
          )
        }
      />
      {mission?.focusNote && (
        <Text style={{ ...Typography.bodySmall, color: '#2D7D32', marginBottom: 12, fontStyle: 'italic' }}>
          (bulb) {mission.focusNote}
        </Text>
      )}
      
      {mission?.activities.map((activity, index) => {
        const done = missionCompleted.includes(index.toString());
        const cardStyle = StyleSheet.flatten(done ? [styles.activityCard, { opacity: 0.7 }] : [styles.activityCard]) || styles.activityCard;
        return (
          <Card
            key={`${activity.kind}-${index}`}
            variant={done ? 'filled' : 'elevated'}
            onPress={() => {
              const route = ACTIVITY_ROUTES[activity.kind];
              if (route) router.push(route as never);
            }}
            accessibilityLabel={`Start ${activity.title}`}
            style={cardStyle}
          >
            <View style={styles.activityRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityTitle}>
                    {done ? 'done ' : ''}{activity.title}
                  </Text>
                  {done && (
                    <Badge variant="good" size="sm" dot>
                      Completed
                    </Badge>
                  )}
                </View>
                <Text style={styles.activityDesc}>{activity.description}</Text>
              </View>
              <Chip label={`${activity.minutes} min`} variant={done ? 'success' : 'default'} size="sm" />
            </View>
          </Card>
        );
      })}

      {/* Activity Hub */}
      <SectionHeader title="Practice Anything" subtitle="Choose an activity to practice" />
      
      <View style={styles.hubGrid}>
        {[
          { route: '/conversation', title: 'Conversation', desc: 'Scenarios with your tutor', icon: 'chat' },
          { route: '/speaking', title: 'Speaking', desc: 'Fluency + feedback', icon: 'mic' },
          { route: '/grammar', title: 'Grammar', desc: 'Targeted drills', icon: 'edit' },
          { route: '/vocabulary', title: 'Vocabulary', desc: dueBadge ? 'New words saved' : 'Your words', icon: 'book' },
          { route: '/review', title: 'Review', desc: 'Spaced repetition', icon: 'repeat' },
          { route: '/listening', title: 'Listening', desc: 'Train your ear', icon: 'headphones' },
          { route: '/writing', title: 'Writing', desc: 'Get line-by-line feedback', icon: 'write' },
          { route: '/interview', title: 'Interview', desc: 'Mock interviews', icon: 'briefcase' },
          { route: '/pronunciation', title: 'Pronunciation', desc: 'Practice tricky words', icon: 'speak' },
          { route: '/diagnostic', title: 'Assessment', desc: 'Re-check your level', icon: 'target' },
          { route: '/progress', title: 'Progress', desc: 'Scores & history', icon: 'chart' },
          { route: '/profile', title: 'Profile', desc: 'Settings & privacy', icon: 'settings' },
        ].map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as never)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={styles.hubCard}
          >
            <View style={styles.hubIcon}>
              <Text style={styles.hubIconText}>{item.icon}</Text>
            </View>
            <Text style={styles.hubTitle}>{item.title}</Text>
            <Text style={styles.hubDesc}>{item.desc}</Text>
          </Pressable>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={{ ...Typography.caption, color: '#A3A3A3' }}>
          Lang AI - Speak better. Every day.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 48,
    paddingHorizontal: 20,
  },
  banner: {
    marginBottom: 16,
    marginHorizontal: -20,
    borderRadius: 0,
  },
  greetingSection: {
    marginBottom: 24,
  },
  greetingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  greetingText: {
    flex: 1,
  },
  levelCard: {
    marginBottom: 24,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelItem: {
    alignItems: 'center',
    flex: 1,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A3A3A3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'SpaceMono_500Medium',
    marginBottom: 4,
  },
  levelValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  progressSection: {
    marginTop: 16,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#525252',
    fontFamily: 'SpaceMono_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  activityCard: {
    marginBottom: 12,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    fontFamily: 'Urbanist_500Medium',
    includeFontPadding: false,
  },
  activityDesc: {
    fontSize: 14,
    color: '#525252',
    fontFamily: 'Urbanist_400Regular',
    includeFontPadding: false,
    lineHeight: 20,
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  hubCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E4DC',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  hubIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F5F2EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  hubIconText: {
    fontSize: 24,
    lineHeight: 24,
  },
  hubTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'Urbanist_600SemiBold',
    includeFontPadding: false,
    textAlign: 'center',
  },
  hubDesc: {
    fontSize: 11,
    color: '#A3A3A3',
    fontFamily: 'Urbanist_400Regular',
    includeFontPadding: false,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});

