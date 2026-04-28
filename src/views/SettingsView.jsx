import React, { Component } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { getDatabaseInstance } from '../config/firebase.js';
import { goalService } from '../services/GoalService.js';
import { useGoalStore, todayKey } from '../store/goalStore.js';
import { Card } from '../components/ui/Card.jsx';
import { Text } from '../components/ui/Text.jsx';
import { Button } from '../components/ui/Button.jsx';
import { TemplatePickerModal } from '../modals/TemplatePickerModal.jsx';
import { AddOneOffBottomModal } from '../modals/AddOneOffBottomModal.jsx';
import { PersonalTemplateEditorModal } from '../modals/PersonalTemplateEditorModal.jsx';

/**
 * @param {string} key
 */
function dayChipLabel(key) {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

export class SettingsView extends Component {
  constructor(props) {
    super(props);
    const dk = props.route?.params?.dateKey ?? todayKey();
    this.state = {
      dateKeyForAdd: dk,
      templates: null,
      activeTemplateId: 'simple_daily',
      template: null,
      showPicker: false,
      showAddModal: false,
      showEditor: false,
      editorMode: 'create',
      editorInitial: null,
      customAddLabel: '',
    };
  }

  componentDidMount() {
    this._bootstrap();
  }

  _bootstrap = async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    const maps = await goalService.getTemplatesMap(uid);
    this.setState({ templates: maps });
    useGoalStore.getState().setTemplates(maps);

    const active = await goalService.getActiveTemplateId(uid);
    const tpl = await goalService.getTemplateById(active, uid);
    this.setState({ activeTemplateId: active, template: tpl });

    const { dateKeyForAdd } = this.state;
    await goalService.ensureDayForTemplate(uid, dateKeyForAdd, active);
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
    const { dateKeyForAdd } = this.state;
    await goalService.ensureDayForTemplate(uid, dateKeyForAdd, id);
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
      await goalService.ensureDayForTemplate(uid, this.state.dateKeyForAdd, fallback);
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
    const { dateKeyForAdd, customAddLabel } = this.state;
    const tid = await goalService.addCustomTask(uid, dateKeyForAdd, {
      label: customAddLabel,
      category: 'other',
    });
    if (tid) {
      this.setState({ customAddLabel: '', showAddModal: false });
    }
  };

  render() {
    const {
      dateKeyForAdd,
      templates,
      template,
      activeTemplateId,
      showPicker,
      showAddModal,
      showEditor,
      editorMode,
      editorInitial,
    } = this.state;
    const { onBack } = this.props;

    const addDateHint = `${dayChipLabel(dateKeyForAdd)} · ${dateKeyForAdd}`;

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
              <Text className="text-lg font-semibold">Settings</Text>
              <View style={{ width: 72 }} />
            </View>
          </View>

          <ScrollView
            className="min-h-0 flex-1 px-3 pt-3"
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <Text className="mb-3 text-xs text-muted-foreground">
              Active plan and quick actions. One-off tasks are added for the day shown below
              (from Home when you open Settings).
            </Text>

            <Card className="mb-3 border-border">
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
                      numberOfLines={4}
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
                  <Button label="+ Add plan" onPress={this.onOpenPicker} />
                  <Text className="mt-1 text-[10px] text-muted-foreground">
                    Pick a routine template
                  </Text>
                </View>
                <View className="min-w-[30%] flex-1">
                  <Button label="+ Add todo" onPress={this.onOpenAddModal} />
                  <Text className="mt-1 text-[10px] text-muted-foreground">
                    One-off for {dayChipLabel(dateKeyForAdd)}
                  </Text>
                </View>
                <View className="min-w-[30%] flex-1">
                  <Button
                    label="+ New plan"
                    onPress={this.onCreatePersonalTemplate}
                  />
                  <Text className="mt-1 text-[10px] text-muted-foreground">
                    Build your own template
                  </Text>
                </View>
              </View>
            </Card>
          </ScrollView>
        </View>

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
