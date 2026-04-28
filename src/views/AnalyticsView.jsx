import React, { Component } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { get, onValue, ref } from 'firebase/database';
import { getDatabaseInstance } from '../config/firebase.js';
import { Card } from '../components/ui/Card.jsx';
import { Text } from '../components/ui/Text.jsx';
import { Button } from '../components/ui/Button.jsx';
import {
  lastNDayKeysChronological,
  toDateKey,
} from '../lib/dateKeys.js';

const WINDOWS = [
  { id: 7, label: '7 days' },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
];

const CATEGORY_ORDER = [
  'exercise',
  'diet',
  'water',
  'skin',
  'work',
  'other',
];

function todayKey() {
  return toDateKey(new Date());
}

function pct(done, total) {
  if (!total || total <= 0) {
    return 0;
  }
  return Math.round((done / total) * 100);
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function dayLabel(key) {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

/**
 * Trigger a CSV download on web; on native fall back to RN's Share API.
 *
 * @param {string} filename
 * @param {string} csv
 */
async function exportCsv(filename, csv) {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    } catch (e) {
      // fall through to Share
    }
  }
  try {
    await Share.share({
      title: filename,
      message: csv,
    });
  } catch {
    // user dismissed
  }
}

export class AnalyticsView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      windowDays: 7,
      summaries: {},
      loadingReports: false,
      reportsForKey: null,
      categoryReports: null,
      exporting: false,
      exportError: null,
    };
    this._unsubSummaries = null;
  }

  componentDidMount() {
    this._subscribeSummaries();
  }

  componentDidUpdate(_prev, prevState) {
    if (prevState.windowDays !== this.state.windowDays) {
      this._loadCategoryReports();
    }
  }

  componentWillUnmount() {
    if (typeof this._unsubSummaries === 'function') {
      this._unsubSummaries();
      this._unsubSummaries = null;
    }
  }

  _subscribeSummaries = () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    const db = getDatabaseInstance();
    this._unsubSummaries = onValue(
      ref(db, `users/${uid}/daySummaries`),
      (snap) => {
        const summaries =
          snap.exists() && snap.val() ? snap.val() : {};
        this.setState({ summaries }, () => {
          this._loadCategoryReports();
        });
      }
    );
  };

  _windowKeys = () => {
    return lastNDayKeysChronological(todayKey(), this.state.windowDays);
  };

  _loadCategoryReports = async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    const keys = this._windowKeys();
    const cacheKey = `${this.state.windowDays}:${keys[0]}:${keys[keys.length - 1]}`;
    if (this.state.reportsForKey === cacheKey && !this.state.loadingReports) {
      return;
    }
    this.setState({ loadingReports: true });
    const db = getDatabaseInstance();
    try {
      const snaps = await Promise.all(
        keys.map((k) => get(ref(db, `users/${uid}/daily/${k}/tasks`)))
      );
      /** @type {Record<string, { total: number, completed: number }>} */
      const byCat = {};
      for (const cat of CATEGORY_ORDER) {
        byCat[cat] = { total: 0, completed: 0 };
      }
      for (const snap of snaps) {
        if (!snap.exists() || !snap.val()) {
          continue;
        }
        const tasks = snap.val();
        for (const id of Object.keys(tasks)) {
          const t = tasks[id];
          const cat = CATEGORY_ORDER.includes(t?.category)
            ? t.category
            : 'other';
          byCat[cat].total += 1;
          if (t?.done) {
            byCat[cat].completed += 1;
          }
        }
      }
      this.setState({
        loadingReports: false,
        reportsForKey: cacheKey,
        categoryReports: byCat,
      });
    } catch (e) {
      this.setState({
        loadingReports: false,
        categoryReports: null,
      });
    }
  };

  _onSelectWindow = (n) => {
    this.setState({ windowDays: n });
  };

  _computeStats = () => {
    const { summaries, windowDays } = this.state;
    const keys = this._windowKeys();
    let totalSum = 0;
    let doneSum = 0;
    let allDoneDays = 0;
    let daysWithData = 0;
    const seriesPct = [];
    const seriesAbs = [];
    for (const k of keys) {
      const s = summaries?.[k];
      const total = s?.totalCount ?? 0;
      const done = s?.completedCount ?? 0;
      totalSum += total;
      doneSum += done;
      if (total > 0) {
        daysWithData += 1;
        if (s?.allDone || done === total) {
          allDoneDays += 1;
        }
      }
      seriesPct.push({ key: k, pct: pct(done, total), total, done });
      seriesAbs.push(done);
    }

    const avgPct = pct(doneSum, totalSum);

    const today = todayKey();
    let streak = 0;
    let cursor = today;
    for (let i = 0; i < 365; i++) {
      const s = summaries?.[cursor];
      const total = s?.totalCount ?? 0;
      const done = s?.completedCount ?? 0;
      const isFull = total > 0 && (s?.allDone || done === total);
      if (!isFull) {
        break;
      }
      streak += 1;
      const [y, m, d] = cursor.split('-').map((n) => parseInt(n, 10));
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - 1);
      cursor = toDateKey(dt);
    }

    let best7 = 0;
    if (seriesAbs.length >= 1) {
      const w = Math.min(7, seriesAbs.length);
      let cur = 0;
      for (let i = 0; i < w; i++) {
        cur += seriesAbs[i];
      }
      best7 = cur;
      for (let i = w; i < seriesAbs.length; i++) {
        cur += seriesAbs[i] - seriesAbs[i - w];
        if (cur > best7) {
          best7 = cur;
        }
      }
    }

    const last7 = seriesPct.slice(-7);
    const last7Total = last7.reduce((acc, x) => acc + x.total, 0);
    const last7Done = last7.reduce((acc, x) => acc + x.done, 0);
    const last7Pct = pct(last7Done, last7Total);
    const last7AllDone = last7.filter(
      (x) => x.total > 0 && x.done === x.total
    ).length;

    return {
      keys,
      avgPct,
      streak,
      best7,
      seriesPct,
      daysWithData,
      allDoneDays,
      last7Pct,
      last7AllDone,
      windowDays,
    };
  };

  _exportCsv = async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    this.setState({ exporting: true, exportError: null });
    const db = getDatabaseInstance();
    const keys = this._windowKeys();
    try {
      const summarySnaps = await Promise.all(
        keys.map((k) => get(ref(db, `users/${uid}/daySummaries/${k}`)))
      );
      const taskSnaps = await Promise.all(
        keys.map((k) => get(ref(db, `users/${uid}/daily/${k}/tasks`)))
      );

      const lines = [];
      lines.push('section,date,total,completed,allDone,percent,taskId,label,category,done,doneAt');
      keys.forEach((k, i) => {
        const sSnap = summarySnaps[i];
        const s = sSnap.exists() ? sSnap.val() : null;
        const total = s?.totalCount ?? 0;
        const done = s?.completedCount ?? 0;
        const allDone = !!(s?.allDone || (total > 0 && done === total));
        lines.push(
          [
            csvEscape('day'),
            csvEscape(k),
            csvEscape(total),
            csvEscape(done),
            csvEscape(allDone ? 'true' : 'false'),
            csvEscape(pct(done, total)),
            '',
            '',
            '',
            '',
            '',
          ].join(',')
        );
      });
      keys.forEach((k, i) => {
        const tSnap = taskSnaps[i];
        if (!tSnap.exists() || !tSnap.val()) {
          return;
        }
        const tasks = tSnap.val();
        for (const taskId of Object.keys(tasks)) {
          const t = tasks[taskId];
          lines.push(
            [
              csvEscape('task'),
              csvEscape(k),
              '',
              '',
              '',
              '',
              csvEscape(taskId),
              csvEscape(t?.label ?? ''),
              csvEscape(t?.category ?? ''),
              csvEscape(t?.done ? 'true' : 'false'),
              csvEscape(t?.doneAt ?? ''),
            ].join(',')
          );
        }
      });

      const filename = `discipline-goals-${this.state.windowDays}d-${todayKey()}.csv`;
      await exportCsv(filename, lines.join('\n'));
      this.setState({ exporting: false });
    } catch (e) {
      this.setState({
        exporting: false,
        exportError: e?.message ?? 'Could not export.',
      });
    }
  };

  render() {
    const stats = this._computeStats();
    const {
      keys,
      avgPct,
      streak,
      best7,
      seriesPct,
      daysWithData,
      allDoneDays,
      last7Pct,
      last7AllDone,
      windowDays,
    } = stats;
    const { categoryReports, loadingReports, exporting, exportError } =
      this.state;

    const maxPct = 100;
    const chartHeight = 96;

    const { onBack } = this.props;

    return (
      <SafeAreaView
        className="relative flex-1 bg-background"
        style={{ flex: 1, minHeight: 0 }}
        edges={['left', 'right', 'top']}
      >
        <View
          className="flex min-h-0 flex-1 flex-col"
          style={{ flex: 1, minHeight: 0 }}
        >
          <View className="shrink-0 border-b border-border px-3 py-2">
            <View className="flex-row items-center justify-between">
              {onBack ? (
                <Button label="Back" variant="ghost" onPress={onBack} />
              ) : (
                <View style={{ width: 72 }} />
              )}
              <Text className="text-lg font-semibold">Analytics</Text>
              <View style={{ width: 72 }} />
            </View>
          </View>
        <ScrollView
          className="min-h-0 flex-1 px-3 pt-3"
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <Text className="mb-3 text-xs text-muted-foreground">
            Progress and reports for your selected window.
          </Text>

          <View className="mb-3 flex-row gap-2">
            {WINDOWS.map((w) => {
              const active = w.id === windowDays;
              return (
                <Pressable
                  key={w.id}
                  onPress={() => this._onSelectWindow(w.id)}
                  className={`rounded-md border px-3 py-2 ${
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

          <View className="mb-3 flex-row flex-wrap gap-2">
            <Card className="min-w-[45%] flex-1">
              <Text className="text-xs text-muted-foreground">
                Avg completion
              </Text>
              <Text className="mt-1 text-2xl font-semibold">{avgPct}%</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                {daysWithData} of {keys.length} days had data
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1">
              <Text className="text-xs text-muted-foreground">Streak</Text>
              <Text className="mt-1 text-2xl font-semibold">
                {streak} {streak === 1 ? 'day' : 'days'}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Consecutive fully-complete days from today
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1">
              <Text className="text-xs text-muted-foreground">
                Best 7-day total
              </Text>
              <Text className="mt-1 text-2xl font-semibold">{best7}</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Most tasks completed in any 7-day window
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1">
              <Text className="text-xs text-muted-foreground">
                Full days
              </Text>
              <Text className="mt-1 text-2xl font-semibold">{allDoneDays}</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Days where every task was done
              </Text>
            </Card>
          </View>

          <Card className="mb-3">
            <Text className="mb-2 font-medium">Daily completion rate</Text>
            <View
              className="flex-row items-end gap-1"
              style={{ height: chartHeight }}
            >
              {seriesPct.map((p) => {
                const h = Math.max(
                  2,
                  Math.round((p.pct / maxPct) * chartHeight)
                );
                const full = p.total > 0 && p.done === p.total;
                return (
                  <View
                    key={p.key}
                    className="flex-1 items-center justify-end"
                  >
                    <View
                      className={
                        full
                          ? 'w-full rounded-t bg-success'
                          : p.pct > 0
                            ? 'w-full rounded-t bg-primary'
                            : 'w-full rounded-t bg-muted'
                      }
                      style={{ height: h }}
                    />
                  </View>
                );
              })}
            </View>
            <View className="mt-1 flex-row justify-between">
              <Text className="text-[10px] text-muted-foreground">
                {keys[0] ? dayLabel(keys[0]) : ''}
              </Text>
              <Text className="text-[10px] text-muted-foreground">
                {keys[keys.length - 1]
                  ? dayLabel(keys[keys.length - 1])
                  : ''}
              </Text>
            </View>
          </Card>

          <Card className="mb-3">
            <Text className="mb-1 font-medium">Week in review</Text>
            <Text className="text-sm text-muted-foreground">
              Last 7 days: {last7Pct}% average completion · {last7AllDone}{' '}
              {last7AllDone === 1 ? 'full day' : 'full days'}.
            </Text>
          </Card>

          <Card className="mb-3">
            <Text className="mb-2 font-medium">Reports by category</Text>
            {loadingReports && !categoryReports ? (
              <Text className="text-sm text-muted-foreground">Loading…</Text>
            ) : !categoryReports ? (
              <Text className="text-sm text-muted-foreground">
                No data for this window.
              </Text>
            ) : (
              <View>
                {CATEGORY_ORDER.map((cat) => {
                  const r = categoryReports[cat] ?? { total: 0, completed: 0 };
                  if (r.total === 0) {
                    return null;
                  }
                  const p = pct(r.completed, r.total);
                  return (
                    <View
                      key={cat}
                      className="mb-2 flex-row items-center justify-between"
                    >
                      <View className="shrink pr-2">
                        <Text className="font-medium capitalize">{cat}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {r.completed} of {r.total} done
                        </Text>
                      </View>
                      <View className="w-32">
                        <View className="h-2 w-full rounded-full bg-muted">
                          <View
                            className={
                              p === 100 ? 'h-2 rounded-full bg-success' : 'h-2 rounded-full bg-primary'
                            }
                            style={{ width: `${p}%` }}
                          />
                        </View>
                        <Text className="mt-0.5 text-right text-xs text-muted-foreground">
                          {p}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {Object.values(categoryReports).every((r) => r.total === 0) ? (
                  <Text className="text-sm text-muted-foreground">
                    No tasks recorded in this window yet.
                  </Text>
                ) : null}
              </View>
            )}
          </Card>

          <Card className="mb-3">
            <Text className="mb-2 font-medium">Export CSV</Text>
            <Text className="mb-2 text-xs text-muted-foreground">
              Includes a per-day summary row and one row per task for the
              selected window.
            </Text>
            <Button
              label={exporting ? 'Exporting…' : `Export ${windowDays}-day CSV`}
              onPress={this._exportCsv}
              disabled={exporting}
            />
            {exportError ? (
              <Text className="mt-2 text-xs text-destructive">
                {exportError}
              </Text>
            ) : null}
          </Card>
        </ScrollView>
        </View>
      </SafeAreaView>
    );
  }
}
