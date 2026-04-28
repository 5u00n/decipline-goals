import React, { Component } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { getDatabaseInstance } from '../config/firebase.js';
import { goalService } from '../services/GoalService.js';
import { useGoalStore, todayKey } from '../store/goalStore.js';
import { lastNDaysFromKey, toDateKey } from '../lib/dateKeys.js';
import { Card } from '../components/ui/Card.jsx';
import { Text } from '../components/ui/Text.jsx';
import { Button } from '../components/ui/Button.jsx';
import { CheckboxRow } from '../components/ui/CheckboxRow.jsx';
import { ContributionActivity } from '../components/ContributionActivity.jsx';
import { TemplatePickerModal } from '../modals/TemplatePickerModal.jsx';
import { AddOneOffBottomModal } from '../modals/AddOneOffBottomModal.jsx';
import { PersonalTemplateEditorModal } from '../modals/PersonalTemplateEditorModal.jsx';

const DAY_STRIP = 7;
const SUMMARY_WINDOW = 7;

/**
 * @param {string} key
 */
function dayChipLabel(key) {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

/**
 * Compute compact 7-day stats from a `daySummaries` map.
 *
 * @param {Record<string, { totalCount?: number, completedCount?: number, allDone?: boolean }>} summaries
 */
function computeHomeSummary(summaries) {
  const keys = lastNDaysFromKey(todayKey(), SUMMARY_WINDOW);
  let totalSum = 0;
  let doneSum = 0;
  let fullDays = 0;
  for (const k of keys) {
    const s = summaries?.[k];
    const total = s?.totalCount ?? 0;
    const done = s?.completedCount ?? 0;
    totalSum += total;
    doneSum += done;
    if (total > 0 && (s?.allDone || done === total)) {
      fullDays += 1;
    }
  }
  const avgPct =
    totalSum > 0 ? Math.round((doneSum / totalSum) * 100) : 0;

  let streak = 0;
  let cursor = todayKey();
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

  return { avgPct, streak, fullDays };
}

export class HomeView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      dateKey: todayKey(),
      dayTasks: null,
      daySummary: null,
      summaries: {},
      templates: null,
      activeTemplateId: 'simple_daily',
      template: null,
      showPicker: false,
      showAddModal: false,
      showEditor: false,
      editorMode: 'create',
      editorInitial: null,
      userId: getAuth().currentUser?.uid ?? '',
      customAddLabel: '',
    };
    this._unsubsAll = [];
    this._unsubsDay = [];
  }

  componentDidMount() {
    this._bootstrap();
  }

  componentWillUnmount() {
    for (const u of this._unsubsAll) {
      if (typeof u === 'function') {
        u();
      }
    }
    for (const u of this._unsubsDay) {
      if (typeof u === 'function') {
        u();
      }
    }
  }

  _bootstrap = async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    this.setState({ userId: uid });
    const db = getDatabaseInstance();
    const maps = await goalService.getTemplatesMap(uid);
    this.setState({ templates: maps });
    useGoalStore.getState().setTemplates(maps);

    const active = await goalService.getActiveTemplateId(uid);
    this.setState({ activeTemplateId: active });
    const tpl = await goalService.getTemplateById(active, uid);
    this.setState({ template: tpl });

    const dk = this.state.dateKey;
    await goalService.ensureDayForTemplate(uid, dk, active);

    this._subSummaries(uid, db);
    this._subDay(uid, dk, db);
  };

  _subSummaries = (uid, db) => {
    const u = onValue(ref(db, `users/${uid}/daySummaries`), (snap) => {
      this.setState({
        summaries: snap.exists() && snap.val() ? snap.val() : {},
      });
    });
    this._unsubsAll.push(u);
  };

  _subDay = (uid, dateKey, db) => {
    for (const u of this._unsubsDay) {
      if (typeof u === 'function') {
        u();
      }
    }
    this._unsubsDay = [];
    const u1 = onValue(ref(db, `users/${uid}/daily/${dateKey}/tasks`), (snap) => {
      this.setState({
        dayTasks: snap.exists() && snap.val() ? snap.val() : null,
      });
    });
    const u2 = onValue(
      ref(db, `users/${uid}/daySummaries/${dateKey}`),
      (snap) => {
        this.setState({
          daySummary: snap.exists() && snap.val() ? snap.val() : null,
        });
      }
    );
    this._unsubsDay.push(u1, u2);
  };

  /**
   * @param {string} newKey
   */
  onChangeDate = async (newKey) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    this.setState({ dateKey: newKey });
    const db = getDatabaseInstance();
    const { activeTemplateId } = this.state;
    await goalService.ensureDayForTemplate(uid, newKey, activeTemplateId);
    this._subDay(uid, newKey, db);
  };

  /**
   * @param {string} taskId
   * @param {boolean} next
   * @param {string} [labelHint] For RTDB upsert when the task row is missing under daily/…/tasks.
   */
  onToggle = async (taskId, next, labelHint) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    const { dateKey, activeTemplateId } = this.state;
    await goalService.setTaskDone(uid, dateKey, taskId, next, {
      activeTemplateId,
      labelHint,
    });
  };

  onOpenPicker = () => this.setState({ showPicker: true });
  onClosePicker = () => this.setState({ showPicker: false });

  onOpenAddModal = () => this.setState({ showAddModal: true });
  onCloseAddModal = () => this.setState({ showAddModal: false });

  onSelectTemplate = async (id) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    await goalService.setActiveTemplate(uid, id);
    const tpl = await goalService.getTemplateById(id, uid);
    this.setState({ activeTemplateId: id, template: tpl, showPicker: false });
    const { dateKey } = this.state;
    await goalService.ensureDayForTemplate(uid, dateKey, id);
  };

  onCreatePersonalTemplate = () => {
    this.setState({
      showPicker: false,
      showEditor: true,
      editorMode: 'create',
      editorInitial: null,
    });
  };

  onEditPersonalTemplate = (id) => {
    const t = this.state.templates?.[id];
    if (!t) {
      return;
    }
    this.setState({
      showPicker: false,
      showEditor: true,
      editorMode: 'edit',
      editorInitial: t,
    });
  };

  onCloseEditor = () => {
    this.setState({ showEditor: false, editorInitial: null });
  };

  _refreshTemplates = async (uid) => {
    const maps = await goalService.getTemplatesMap(uid);
    this.setState({ templates: maps });
    useGoalStore.getState().setTemplates(maps);
    return maps;
  };

  onSavePersonalTemplate = async (template) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    const savedId = await goalService.savePersonalTemplate(uid, template);
    if (!savedId) {
      throw new Error('Could not save: please add a title and at least one task.');
    }
    const maps = await this._refreshTemplates(uid);
    let nextActive = this.state.activeTemplateId;
    let nextTemplate = this.state.template;
    if (this.state.activeTemplateId === savedId) {
      nextTemplate = maps[savedId] ?? nextTemplate;
    }
    this.setState({
      showEditor: false,
      editorInitial: null,
      activeTemplateId: nextActive,
      template: nextTemplate,
    });
  };

  onDeletePersonalTemplate = async (id) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid || !id) {
      return;
    }
    await goalService.deletePersonalTemplate(uid, id);
    const maps = await this._refreshTemplates(uid);
    const wasActive = this.state.activeTemplateId === id;
    if (wasActive) {
      const fallback = 'simple_daily';
      await goalService.setActiveTemplate(uid, fallback);
      const tpl = await goalService.getTemplateById(fallback, uid);
      this.setState({
        activeTemplateId: fallback,
        template: tpl,
        showEditor: false,
        editorInitial: null,
      });
      await goalService.ensureDayForTemplate(uid, this.state.dateKey, fallback);
      return;
    }
    this.setState({
      showEditor: false,
      editorInitial: null,
      templates: maps,
    });
  };

  onDeleteFromPicker = async (id) => {
    await this.onDeletePersonalTemplate(id);
  };

  onAddCustomTask = async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    const { dateKey, customAddLabel } = this.state;
    const id = await goalService.addCustomTask(uid, dateKey, {
      label: customAddLabel,
      category: 'other',
    });
    if (id) {
      this.setState({ customAddLabel: '', showAddModal: false });
    }
  };

  onRemoveCustomTask = async (taskId) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    const { dateKey } = this.state;
    await goalService.removeCustomTask(uid, dateKey, taskId);
  };

  /**
   * @param {import('../types/goalModel.js').DailyTaskState} v
   */
  _isCustom = (v) => v?.sourceTemplateId === 'custom';

  render() {
    const {
      dateKey,
      dayTasks,
      daySummary,
      summaries,
      template,
      templates,
      activeTemplateId,
      showPicker,
      showAddModal,
      showEditor,
      editorMode,
      editorInitial,
    } = this.state;
    const { onSignOut, role, onOpenAdmin, onOpenAnalytics } = this.props;

    const days = lastNDaysFromKey(todayKey(), DAY_STRIP);
    const homeSummary = computeHomeSummary(this.state.summaries);
    const customEntries = dayTasks
      ? Object.entries(dayTasks).filter(([, v]) => this._isCustom(v))
      : [];
    const total = daySummary?.totalCount ?? 0;
    const done = daySummary?.completedCount ?? 0;
    const allDayDone = total > 0 && (daySummary?.allDone || done === total);
    const highlight = allDayDone ? 'full' : done > 0 ? 'partial' : 'none';

    const addDateHint = `${dayChipLabel(dateKey)} · ${dateKey}`;

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
        <View className="shrink-0 border-b border-border px-3 pb-2 pt-2">
          <View className="mb-2 flex-row items-center justify-between">
            <View className="shrink pr-1">
              <Text className="text-lg font-semibold">Discipline Goals</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Under the day strip: choose plan, add todo, then scroll for checklist.
              </Text>
              {role ? (
                <>
                  <Text
                    className={`mt-0.5 text-xs ${
                      role === 'admin'
                        ? 'font-medium text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {role === 'admin' ? 'Account: admin' : 'Account: user'}
                  </Text>
                  {role === 'user' ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      Admin tools are for organizer accounts. Ask an admin to promote you, or set
                      your role in Firebase (see README).
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              {onOpenAnalytics ? (
                <Button
                  label="Analytics"
                  variant="outline"
                  onPress={onOpenAnalytics}
                />
              ) : null}
              {role === 'admin' && onOpenAdmin ? (
                <Button
                  label="Admin"
                  variant="outline"
                  onPress={onOpenAdmin}
                />
              ) : null}
              <Button label="Out" variant="ghost" onPress={onSignOut} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2 py-1">
              {days.map((k) => {
                const s = summaries?.[k];
                const t = s?.totalCount ?? 0;
                const c = s?.completedCount ?? 0;
                const full = t > 0 && c === t;
                const active = k === dateKey;
                return (
                  <Pressable
                    key={k}
                    onPress={() => this.onChangeDate(k)}
                    className={`rounded-md border px-3 py-2 ${
                      active
                        ? 'border-primary bg-primary'
                        : full
                          ? 'border-success bg-success/20'
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
                      {dayChipLabel(k)}
                    </Text>
                    {t > 0 ? (
                      <Text className="text-xs text-muted-foreground">
                        {c}/{t}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Card className="mb-2 mt-2 border-border">
            <View className="flex-row items-center justify-between">
              <View className="min-w-0 flex-1 pr-2">
                <Text className="text-xs uppercase text-muted-foreground">
                  Active plan
                </Text>
                <Text className="mt-0.5 text-base font-semibold text-foreground">
                  {template?.title ?? activeTemplateId}
                </Text>
                {template?.description ? (
                  <Text
                    className="mt-0.5 text-xs text-muted-foreground"
                    numberOfLines={2}
                  >
                    {template.description}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row flex-wrap justify-end gap-2">
                {activeTemplateId &&
                typeof activeTemplateId === 'string' &&
                activeTemplateId.startsWith('personal_') ? (
                  <>
                    <Button
                      label="Edit"
                      variant="outline"
                      onPress={() => this.onEditPersonalTemplate(activeTemplateId)}
                    />
                    <Button
                      label="Delete"
                      variant="outline"
                      onPress={() => this.onDeletePersonalTemplate(activeTemplateId)}
                    />
                  </>
                ) : null}
                <Button
                  label="Change"
                  variant="outline"
                  onPress={this.onOpenPicker}
                />
              </View>
            </View>
          </Card>

          <Card className="mb-2 border-border">
            <Text className="mb-2 text-xs uppercase text-muted-foreground">
              Add
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <View className="min-w-[30%] flex-1">
                <Button
                  label="+ Add plan"
                  onPress={this.onOpenPicker}
                />
                <Text className="mt-1 text-[10px] text-muted-foreground">
                  Pick a routine template
                </Text>
              </View>
              <View className="min-w-[30%] flex-1">
                <Button
                  label="+ Add todo"
                  onPress={this.onOpenAddModal}
                />
                <Text className="mt-1 text-[10px] text-muted-foreground">
                  One-off for {dayChipLabel(dateKey)}
                </Text>
              </View>
              <View className="min-w-[30%] flex-1">
                <Button
                  label="+ New plan template"
                  onPress={this.onCreatePersonalTemplate}
                />
                <Text className="mt-1 text-[10px] text-muted-foreground">
                  Build your own template
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <ScrollView
          className="min-h-0 flex-1 px-3 pt-3"
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <Pressable
            onPress={onOpenAnalytics}
            disabled={!onOpenAnalytics}
            className="mb-3"
          >
            <Card className="border-border">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs uppercase text-muted-foreground">
                  Last 7 days
                </Text>
                {onOpenAnalytics ? (
                  <Text className="text-xs text-primary">See more →</Text>
                ) : null}
              </View>
              <View className="mt-2 flex-row">
                <View className="flex-1">
                  <Text className="text-xl font-semibold">
                    {homeSummary.avgPct}%
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Avg done
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-semibold">
                    {homeSummary.streak}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Day streak
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-semibold">
                    {homeSummary.fullDays}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Full days
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>

          <ContributionActivity
            summaries={summaries}
            endKey={todayKey()}
            selectedDateKey={dateKey}
            onSelectDate={this.onChangeDate}
          />

          {daySummary && (daySummary.totalCount ?? 0) > 0 ? (
            <Card
              className={`mb-3 ${
                allDayDone
                  ? 'border-success bg-success/15'
                  : 'border-border'
              }`}
            >
              <Text className="mb-1 font-medium">
                {allDayDone ? 'All goals done for this day' : "Today's progress"}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {done} of {daySummary.totalCount} completed
              </Text>
            </Card>
          ) : null}

          {template
            ? (template.sections ?? []).map((section) => (
                <View key={section.id} className="mb-4">
                  <Text className="mb-2 text-base font-semibold text-foreground">
                    {section.title}
                  </Text>
                  {(section.tasks ?? []).map((task) => {
                    const st = dayTasks?.[task.id];
                    const done = !!st?.done;
                    return (
                      <CheckboxRow
                        key={task.id}
                        label={st?.label ?? task.label}
                        done={done}
                        highlight={highlight}
                        onToggle={(n) =>
                          this.onToggle(task.id, n, st?.label ?? task.label)
                        }
                      />
                    );
                  })}
                </View>
              ))
            : null}

          {dayTasks && customEntries.length > 0 ? (
            <View className="mb-4">
              <Text className="mb-2 text-base font-semibold text-foreground">
                Custom (this day)
              </Text>
              {customEntries.map(([taskId, st]) => (
                <View key={taskId} className="flex-row items-start">
                  <View className="min-w-0 flex-1">
                    <CheckboxRow
                      label={st?.label ?? taskId}
                      done={!!st?.done}
                      highlight={highlight}
                      onToggle={(n) =>
                        this.onToggle(taskId, n, st?.label ?? '')
                      }
                    />
                  </View>
                  <Pressable
                    onPress={() => this.onRemoveCustomTask(taskId)}
                    accessibilityLabel="Remove custom task"
                    className="ml-1 rounded p-1"
                  >
                    <Text className="text-sm text-destructive">×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={this.onOpenAddModal}
            className="mb-6 flex-row items-center justify-between rounded-md border border-dashed border-border p-3"
          >
            <View>
              <Text className="text-sm font-medium text-foreground">Quick add (this day)</Text>
              <Text className="text-xs text-muted-foreground">
                Tap to add a one-off task for {dayChipLabel(dateKey)}
              </Text>
            </View>
            <Text className="text-2xl text-primary">+</Text>
          </Pressable>

          {!dayTasks && template ? (
            <Text className="text-muted-foreground">Loading day…</Text>
          ) : null}
        </ScrollView>
        </View>

        <Pressable
          onPress={this.onOpenAddModal}
          accessibilityLabel="Add one-off task for this day"
          className="absolute bottom-4 right-4 z-10 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-md"
        >
          <Text className="text-2xl text-primary-foreground">+</Text>
        </Pressable>

        <AddOneOffBottomModal
          visible={showAddModal}
          onClose={this.onCloseAddModal}
          label={this.state.customAddLabel}
          onChangeLabel={(t) => this.setState({ customAddLabel: t })}
          onAdd={this.onAddCustomTask}
          onChangeRoutine={this.onOpenPicker}
          dateHint={addDateHint}
        />

        <TemplatePickerModal
          visible={showPicker}
          onClose={this.onClosePicker}
          templates={templates ?? {}}
          activeId={activeTemplateId}
          onSelect={this.onSelectTemplate}
          onCreateNew={this.onCreatePersonalTemplate}
          onEdit={this.onEditPersonalTemplate}
          onDelete={this.onDeleteFromPicker}
        />

        <PersonalTemplateEditorModal
          visible={showEditor}
          mode={editorMode}
          initialTemplate={editorInitial}
          onClose={this.onCloseEditor}
          onSave={this.onSavePersonalTemplate}
          onDelete={this.onDeletePersonalTemplate}
        />
      </SafeAreaView>
    );
  }
}
