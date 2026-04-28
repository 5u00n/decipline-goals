import React, { Component } from 'react';
import { View, ScrollView, RefreshControl, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminService } from '../services/AdminService.js';
import { goalService } from '../services/GoalService.js';
import { Text } from '../components/ui/Text.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import {
  lastNDayKeysChronological,
  toDateKey,
} from '../lib/dateKeys.js';

const ANALYTICS_WINDOWS = [
  { id: 7, label: '7 days' },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
];

function todayKey() {
  return toDateKey(new Date());
}

/**
 * Aggregate system-wide analytics from a list of users (each with `daySummaries`).
 *
 * @param {Array<{ daySummaries?: Record<string, { totalCount: number, completedCount: number, allDone: boolean }> }>} users
 * @param {number} windowDays
 */
function computeSystemAnalytics(users, windowDays) {
  const keys = lastNDayKeysChronological(todayKey(), windowDays);
  const today = todayKey();
  const windowSet = new Set(keys);
  let totalSum = 0;
  let doneSum = 0;
  let fullDays = 0;
  let activeToday = 0;
  let activeInWindow = 0;
  for (const u of users) {
    const summaries = u.daySummaries ?? {};
    let userActiveInWindow = false;
    const todaySum = summaries[today];
    if (todaySum && (todaySum.totalCount ?? 0) > 0) {
      activeToday += 1;
    }
    for (const k of Object.keys(summaries)) {
      if (!windowSet.has(k)) {
        continue;
      }
      const s = summaries[k];
      const total = s?.totalCount ?? 0;
      const done = s?.completedCount ?? 0;
      if (total > 0) {
        userActiveInWindow = true;
      }
      totalSum += total;
      doneSum += done;
      if (total > 0 && (s?.allDone || done === total)) {
        fullDays += 1;
      }
    }
    if (userActiveInWindow) {
      activeInWindow += 1;
    }
  }
  const avgPct =
    totalSum > 0 ? Math.round((doneSum / totalSum) * 100) : 0;
  return {
    avgPct,
    fullDays,
    activeToday,
    activeInWindow,
    totalCompleted: doneSum,
  };
}

function formatJoined(ms) {
  if (ms == null) {
    return '—';
  }
  try {
    return new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

function truncate(str, max) {
  if (!str) {
    return '';
  }
  if (str.length <= max) {
    return str;
  }
  return `${str.slice(0, max - 1)}…`;
}

function sortAdminUsers(list) {
  return [...list].sort((a, b) => {
    const adminA = a.role === 'admin' ? 0 : 1;
    const adminB = b.role === 'admin' ? 0 : 1;
    if (adminA !== adminB) {
      return adminA - adminB;
    }
    const ta = a.createdAt ?? 0;
    const tb = b.createdAt ?? 0;
    return tb - ta;
  });
}

export class AdminDashboardView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      users: [],
      templates: null,
      bootstrapUid: null,
      busy: false,
      error: null,
      reseeded: null,
      userQuery: '',
      analyticsWindowDays: 7,
    };
  }

  componentDidMount() {
    if (this.props.role !== 'admin' && this.props.navigation) {
      this.props.navigation.navigate('Home');
      return;
    }
    this.refresh();
  }

  componentDidUpdate(prev) {
    if (prev.role === 'admin' && this.props.role !== 'admin' && this.props.navigation) {
      this.props.navigation.navigate('Home');
    }
  }

  refresh = async () => {
    this.setState({ busy: true, error: null });
    try {
      const [users, templates, bootstrapUid] = await Promise.all([
        adminService.listUsers(),
        goalService.getTemplatesMap(),
        adminService.getBootstrapAdminUid(),
      ]);
      this.setState({ users, templates, bootstrapUid, busy: false });
    } catch (e) {
      this.setState({ error: e?.message ?? String(e), busy: false });
    }
  };

  reseed = async () => {
    this.setState({ busy: true, error: null, reseeded: null });
    try {
      const n = await adminService.reseedGoalLibrary();
      this.setState({ reseeded: n });
      await this.refresh();
    } catch (e) {
      this.setState({ error: e?.message ?? String(e), busy: false });
    }
  };

  setRole = async (userId, role) => {
    if (role === 'user') {
      const { users } = this.state;
      const target = users.find((u) => u.id === userId);
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (target?.role === 'admin' && adminCount <= 1) {
        this.setState({ error: 'Cannot demote the only admin.' });
        return;
      }
    }
    this.setState({ busy: true, error: null });
    try {
      await adminService.setUserRole(userId, role);
      await this.refresh();
    } catch (e) {
      this.setState({ error: e?.message ?? String(e), busy: false });
    }
  };

  render() {
    const { onBack, role } = this.props;
    const {
      users,
      templates,
      bootstrapUid,
      busy,
      error,
      reseeded,
      userQuery,
      analyticsWindowDays,
    } = this.state;
    if (role !== 'admin') {
      return <View className="flex-1 bg-background" />;
    }

    const adminCount = users.filter((u) => u.role === 'admin').length;
    const canDemoteAnyAdmin = adminCount > 1;
    const systemAnalytics = computeSystemAnalytics(users, analyticsWindowDays);
    const templateEntries =
      templates == null
        ? []
        : Object.entries(templates).sort(([, a], [, b]) =>
            (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' })
          );
    const templateCount = templates == null ? null : templateEntries.length;

    const q = userQuery.trim().toLowerCase();
    const sorted = sortAdminUsers(users);
    const filtered = q
      ? sorted.filter(
          (u) =>
            u.id.toLowerCase().includes(q) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            (u.displayName && u.displayName.toLowerCase().includes(q))
        )
      : sorted;

    const overviewLoading = busy && users.length === 0 && templates == null;

    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="border-b border-border px-3 py-2">
          <View className="flex-row items-center justify-between">
            <Button label="Back" variant="ghost" onPress={onBack} />
            <Text className="text-lg font-semibold">Admin</Text>
            <View style={{ width: 72 }} />
          </View>
        </View>
        <ScrollView
          className="flex-1 px-3 pt-3"
          refreshControl={<RefreshControl refreshing={busy} onRefresh={this.refresh} />}
        >
          <Card className="mb-3">
            <Text className="mb-2 font-medium">Overview</Text>
            {overviewLoading ? (
              <Text className="text-sm text-muted-foreground">Loading…</Text>
            ) : (
              <>
                <Text className="text-sm text-foreground">
                  {users.length} user{users.length === 1 ? '' : 's'} · {adminCount} admin
                  {adminCount === 1 ? '' : 's'} · {users.length - adminCount} non-admin
                  {users.length - adminCount === 1 ? '' : 's'}
                </Text>
                <Text className="mt-1 text-sm text-foreground">
                  {templateCount == null
                    ? 'Goal templates: …'
                    : `Goal templates: ${templateCount} (defaults + database)`}
                </Text>
                {bootstrapUid ? (
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Bootstrap admin UID: {bootstrapUid}
                  </Text>
                ) : null}
              </>
            )}
          </Card>

          <Card className="mb-3">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-medium">
                User analytics ({analyticsWindowDays}d)
              </Text>
            </View>
            <View className="mb-3 flex-row gap-2">
              {ANALYTICS_WINDOWS.map((w) => {
                const active = w.id === analyticsWindowDays;
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => this.setState({ analyticsWindowDays: w.id })}
                    className={`rounded-md border px-3 py-1.5 ${
                      active
                        ? 'border-primary bg-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={
                        active
                          ? 'text-primary-foreground'
                          : 'text-foreground'
                      }
                    >
                      {w.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {overviewLoading ? (
              <Text className="text-sm text-muted-foreground">Loading…</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                <View className="min-w-[45%] flex-1 rounded-md border border-border bg-card p-3">
                  <Text className="text-xs text-muted-foreground">
                    Active today
                  </Text>
                  <Text className="mt-1 text-2xl font-semibold">
                    {systemAnalytics.activeToday}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    of {users.length} user{users.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <View className="min-w-[45%] flex-1 rounded-md border border-border bg-card p-3">
                  <Text className="text-xs text-muted-foreground">
                    Active in window
                  </Text>
                  <Text className="mt-1 text-2xl font-semibold">
                    {systemAnalytics.activeInWindow}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Users with any task data
                  </Text>
                </View>
                <View className="min-w-[45%] flex-1 rounded-md border border-border bg-card p-3">
                  <Text className="text-xs text-muted-foreground">
                    Avg completion
                  </Text>
                  <Text className="mt-1 text-2xl font-semibold">
                    {systemAnalytics.avgPct}%
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Across all users in window
                  </Text>
                </View>
                <View className="min-w-[45%] flex-1 rounded-md border border-border bg-card p-3">
                  <Text className="text-xs text-muted-foreground">
                    Full days
                  </Text>
                  <Text className="mt-1 text-2xl font-semibold">
                    {systemAnalytics.fullDays}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Total all-done days in window
                  </Text>
                </View>
                <View className="min-w-[45%] flex-1 rounded-md border border-border bg-card p-3">
                  <Text className="text-xs text-muted-foreground">
                    Tasks completed
                  </Text>
                  <Text className="mt-1 text-2xl font-semibold">
                    {systemAnalytics.totalCompleted}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Sum across users in window
                  </Text>
                </View>
              </View>
            )}
          </Card>

          <Card className="mb-3">
            <Text className="mb-1 font-medium">Goal library</Text>
            <Text className="mb-2 text-sm text-muted-foreground">
              Re-seed `goalLibrary/templates` from the bundled default JSON. Safe to run
              multiple times; it overwrites template definitions.
            </Text>
            <Button label="Re-seed goal library" onPress={this.reseed} disabled={busy} />
            {reseeded != null ? (
              <Text className="mt-2 text-sm text-foreground">Seeded {reseeded} templates.</Text>
            ) : null}
            {templateEntries.length > 0 ? (
              <View className="mt-3 border-t border-border pt-3">
                <Text className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Current templates
                </Text>
                {templateEntries.map(([tid, t]) => (
                  <View key={tid} className="mb-2 border-b border-border pb-2 last:mb-0 last:border-0">
                    <Text className="text-sm font-medium text-foreground">
                      {t.title ?? tid}{' '}
                      <Text className="font-normal text-muted-foreground">({tid})</Text>
                    </Text>
                    {t.description ? (
                      <Text className="mt-0.5 text-xs text-muted-foreground">
                        {truncate(t.description, 120)}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : templates != null && templateEntries.length === 0 ? (
              <Text className="mt-2 text-sm text-muted-foreground">No templates in library.</Text>
            ) : null}
          </Card>

          {error ? <Text className="mb-2 text-destructive">{error}</Text> : null}

          <Text className="mb-2 font-medium">Users</Text>
          <TextInput
            className="mb-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Search by name, email, or id"
            placeholderTextColor="hsl(240 4% 46%)"
            value={userQuery}
            onChangeText={(text) => this.setState({ userQuery: text })}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          {filtered.map((u) => (
            <View
              key={u.id}
              className="mb-3 border-b border-border pb-3 last:mb-0 last:border-0"
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1">
                  <Text className="font-medium text-foreground">
                    {u.displayName || u.email || u.id}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {u.email || '—'} — role: {u.role}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Joined {formatJoined(u.createdAt)}
                    {u.timeZone ? ` · ${u.timeZone}` : ''}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Template: {u.activeTemplateId || 'default'}{' '}
                    · Days with summaries: {u.daysTracked}
                  </Text>
                </View>
                <View className="flex-row flex-wrap justify-end gap-1">
                  {u.role !== 'admin' ? (
                    <Button
                      label="Make admin"
                      variant="outline"
                      onPress={() => this.setRole(u.id, 'admin')}
                      disabled={busy}
                    />
                  ) : null}
                  {u.role === 'admin' ? (
                    <Button
                      label="Demote"
                      variant="ghost"
                      onPress={() => this.setRole(u.id, 'user')}
                      disabled={busy || !canDemoteAnyAdmin}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }
}
