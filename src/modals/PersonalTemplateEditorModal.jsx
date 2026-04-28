import React, { Component } from 'react';
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../components/ui/Text.jsx';
import { Button } from '../components/ui/Button.jsx';

const CATEGORIES = [
  'exercise',
  'diet',
  'water',
  'skin',
  'work',
  'other',
];

const SLOTS = ['morning', 'day', 'evening', 'all_day'];

let _localId = 0;
function localId(prefix) {
  _localId += 1;
  return `${prefix}_${Date.now()}_${_localId}`;
}

function blankSection() {
  return {
    _key: localId('sec'),
    title: '',
    slot: 'all_day',
    tasks: [blankTask()],
  };
}

function blankTask() {
  return {
    _key: localId('task'),
    label: '',
    category: 'other',
  };
}

/**
 * Convert an incoming GoalTemplate into editable form state with stable local
 * keys so React lists work correctly while editing.
 *
 * @param {import('../types/goalModel.js').GoalTemplate | null | undefined} t
 */
function toFormState(t) {
  if (!t) {
    return {
      title: '',
      description: '',
      sections: [blankSection()],
    };
  }
  return {
    title: t.title ?? '',
    description: t.description ?? '',
    sections: (t.sections ?? []).map((sec) => ({
      _key: localId('sec'),
      title: sec.title ?? '',
      slot: sec.slot ?? 'all_day',
      tasks: (sec.tasks ?? []).map((task) => ({
        _key: localId('task'),
        label: task.label ?? '',
        category: task.category ?? 'other',
      })),
    })),
  };
}

/**
 * Editor for a single personal template.
 *
 * @typedef {{
 *   visible: boolean;
 *   mode: 'create' | 'edit';
 *   initialTemplate?: import('../types/goalModel.js').GoalTemplate | null;
 *   onClose: () => void;
 *   onSave: (template: import('../types/goalModel.js').GoalTemplate) => Promise<void> | void;
 *   onDelete?: (id: string) => Promise<void> | void;
 * }} PersonalTemplateEditorModalProps
 */
export class PersonalTemplateEditorModal extends Component {
  /** @param {PersonalTemplateEditorModalProps} props */
  constructor(props) {
    super(props);
    this.state = {
      ...toFormState(props.initialTemplate),
      saving: false,
      error: null,
    };
  }

  componentDidUpdate(prevProps) {
    const opening = !prevProps.visible && this.props.visible;
    const changed =
      prevProps.initialTemplate?.id !== this.props.initialTemplate?.id;
    if (opening || changed) {
      this.setState({
        ...toFormState(this.props.initialTemplate),
        saving: false,
        error: null,
      });
    }
  }

  _setTitle = (title) => this.setState({ title });
  _setDescription = (description) => this.setState({ description });

  _addSection = () => {
    this.setState((s) => ({ sections: [...s.sections, blankSection()] }));
  };

  _removeSection = (idx) => {
    this.setState((s) => {
      const next = s.sections.slice();
      next.splice(idx, 1);
      return { sections: next.length > 0 ? next : [blankSection()] };
    });
  };

  _updateSection = (idx, patch) => {
    this.setState((s) => {
      const next = s.sections.slice();
      next[idx] = { ...next[idx], ...patch };
      return { sections: next };
    });
  };

  _addTask = (sIdx) => {
    this.setState((s) => {
      const next = s.sections.slice();
      next[sIdx] = {
        ...next[sIdx],
        tasks: [...next[sIdx].tasks, blankTask()],
      };
      return { sections: next };
    });
  };

  _removeTask = (sIdx, tIdx) => {
    this.setState((s) => {
      const next = s.sections.slice();
      const tasks = next[sIdx].tasks.slice();
      tasks.splice(tIdx, 1);
      next[sIdx] = {
        ...next[sIdx],
        tasks: tasks.length > 0 ? tasks : [blankTask()],
      };
      return { sections: next };
    });
  };

  _updateTask = (sIdx, tIdx, patch) => {
    this.setState((s) => {
      const next = s.sections.slice();
      const tasks = next[sIdx].tasks.slice();
      tasks[tIdx] = { ...tasks[tIdx], ...patch };
      next[sIdx] = { ...next[sIdx], tasks };
      return { sections: next };
    });
  };

  _onSave = async () => {
    const { title, description, sections } = this.state;
    const { onSave, initialTemplate } = this.props;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      this.setState({ error: 'Please enter a title for your template.' });
      return;
    }
    const cleanedSections = sections
      .map((sec) => ({
        title: sec.title.trim(),
        slot: sec.slot,
        tasks: sec.tasks
          .map((t) => ({
            label: t.label.trim(),
            category: t.category,
          }))
          .filter((t) => t.label.length > 0),
      }))
      .filter((sec) => sec.title.length > 0 && sec.tasks.length > 0);

    if (cleanedSections.length === 0) {
      this.setState({
        error:
          'Add at least one section with a title and one task with a label.',
      });
      return;
    }

    /** @type {import('../types/goalModel.js').GoalTemplate} */
    const template = {
      id: initialTemplate?.id ?? '',
      title: trimmedTitle,
      description: description.trim() || undefined,
      sections: cleanedSections,
    };
    if (template.description === undefined) {
      delete template.description;
    }

    this.setState({ saving: true, error: null });
    try {
      await onSave(template);
    } catch (e) {
      this.setState({
        saving: false,
        error: e?.message ?? 'Could not save template.',
      });
      return;
    }
    this.setState({ saving: false });
  };

  _onDelete = async () => {
    const { onDelete, initialTemplate } = this.props;
    if (!onDelete || !initialTemplate?.id) {
      return;
    }
    this.setState({ saving: true, error: null });
    try {
      await onDelete(initialTemplate.id);
    } catch (e) {
      this.setState({
        saving: false,
        error: e?.message ?? 'Could not delete template.',
      });
    }
  };

  render() {
    const { visible, onClose, mode, onDelete, initialTemplate } = this.props;
    const { title, description, sections, saving, error } = this.state;
    const isEdit = mode === 'edit';

    return (
      <Modal
        visible={!!visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View className="flex-1 justify-end bg-black/40">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View className="max-h-[92%] rounded-t-2xl bg-card p-4">
              <View className="mb-3 items-center">
                <View className="h-1.5 w-10 rounded-full bg-border" />
              </View>

              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-lg font-semibold">
                  {isEdit ? 'Edit my template' : 'Create my template'}
                </Text>
                <Pressable
                  onPress={onClose}
                  accessibilityLabel="Close editor"
                  className="rounded-md px-2 py-1"
                >
                  <Text className="text-base text-muted-foreground">×</Text>
                </Pressable>
              </View>

              {error ? (
                <View className="mb-2 rounded-md border border-destructive/50 bg-destructive/10 p-2">
                  <Text className="text-xs text-destructive">{error}</Text>
                </View>
              ) : null}

              <ScrollView
                className="mb-3"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                <Text className="mb-1 text-xs font-medium text-muted-foreground">
                  Title
                </Text>
                <TextInput
                  value={title}
                  onChangeText={this._setTitle}
                  placeholder="e.g. Suren's daily plan"
                  placeholderTextColor="hsl(240 3.8% 60%)"
                  className="mb-3 rounded-md border border-border bg-card px-3 py-2 text-foreground"
                  style={{ minHeight: 44 }}
                />

                <Text className="mb-1 text-xs font-medium text-muted-foreground">
                  Description (optional)
                </Text>
                <TextInput
                  value={description}
                  onChangeText={this._setDescription}
                  placeholder="Short note about this plan"
                  placeholderTextColor="hsl(240 3.8% 60%)"
                  multiline
                  className="mb-4 rounded-md border border-border bg-card px-3 py-2 text-foreground"
                  style={{ minHeight: 44 }}
                />

                {sections.map((sec, sIdx) => (
                  <View
                    key={sec._key}
                    className="mb-4 rounded-md border border-border p-3"
                  >
                    <View className="mb-2 flex-row items-center justify-between">
                      <Text className="text-sm font-semibold">
                        Section {sIdx + 1}
                      </Text>
                      <Pressable
                        onPress={() => this._removeSection(sIdx)}
                        accessibilityLabel={`Remove section ${sIdx + 1}`}
                        className="rounded-md px-2 py-1"
                      >
                        <Text className="text-xs text-destructive">
                          Remove section
                        </Text>
                      </Pressable>
                    </View>

                    <Text className="mb-1 text-xs font-medium text-muted-foreground">
                      Section title
                    </Text>
                    <TextInput
                      value={sec.title}
                      onChangeText={(v) =>
                        this._updateSection(sIdx, { title: v })
                      }
                      placeholder="e.g. Morning, Diet, Work"
                      placeholderTextColor="hsl(240 3.8% 60%)"
                      className="mb-2 rounded-md border border-border bg-card px-3 py-2 text-foreground"
                      style={{ minHeight: 44 }}
                    />

                    <Text className="mb-1 text-xs font-medium text-muted-foreground">
                      Slot
                    </Text>
                    <View className="mb-3 flex-row flex-wrap gap-1">
                      {SLOTS.map((slot) => {
                        const active = sec.slot === slot;
                        return (
                          <Pressable
                            key={slot}
                            onPress={() =>
                              this._updateSection(sIdx, { slot })
                            }
                            className={`rounded-md border px-2 py-1 ${
                              active
                                ? 'border-primary bg-primary'
                                : 'border-border bg-card'
                            }`}
                          >
                            <Text
                              className={`text-xs ${
                                active
                                  ? 'text-primary-foreground'
                                  : 'text-foreground'
                              }`}
                            >
                              {slot}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text className="mb-1 text-xs font-medium text-muted-foreground">
                      Tasks
                    </Text>
                    {sec.tasks.map((task, tIdx) => (
                      <View
                        key={task._key}
                        className="mb-2 rounded-md border border-border bg-background p-2"
                      >
                        <TextInput
                          value={task.label}
                          onChangeText={(v) =>
                            this._updateTask(sIdx, tIdx, { label: v })
                          }
                          placeholder="e.g. 30 min walk"
                          placeholderTextColor="hsl(240 3.8% 60%)"
                          className="mb-2 rounded-md border border-border bg-card px-3 py-2 text-foreground"
                          style={{ minHeight: 44 }}
                        />
                        <View className="flex-row flex-wrap items-center gap-1">
                          {CATEGORIES.map((cat) => {
                            const active = task.category === cat;
                            return (
                              <Pressable
                                key={cat}
                                onPress={() =>
                                  this._updateTask(sIdx, tIdx, {
                                    category: cat,
                                  })
                                }
                                className={`rounded-md border px-2 py-1 ${
                                  active
                                    ? 'border-primary bg-primary'
                                    : 'border-border bg-card'
                                }`}
                              >
                                <Text
                                  className={`text-xs ${
                                    active
                                      ? 'text-primary-foreground'
                                      : 'text-foreground'
                                  }`}
                                >
                                  {cat}
                                </Text>
                              </Pressable>
                            );
                          })}
                          <Pressable
                            onPress={() => this._removeTask(sIdx, tIdx)}
                            accessibilityLabel="Remove task"
                            className="ml-auto rounded-md px-2 py-1"
                          >
                            <Text className="text-xs text-destructive">
                              Remove
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}

                    <Pressable
                      onPress={() => this._addTask(sIdx)}
                      className="mt-1 rounded-md border border-dashed border-border p-2"
                    >
                      <Text className="text-xs text-foreground">+ Add task</Text>
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  onPress={this._addSection}
                  className="mb-2 rounded-md border border-dashed border-border p-3"
                >
                  <Text className="text-sm font-medium text-foreground">
                    + Add section
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Group tasks (e.g. Morning, Diet)
                  </Text>
                </Pressable>
              </ScrollView>

              <View className="flex-row gap-2">
                <Button
                  label={saving ? 'Saving…' : 'Save'}
                  onPress={this._onSave}
                  disabled={saving}
                  className="flex-1"
                />
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={onClose}
                  disabled={saving}
                />
              </View>

              {isEdit && onDelete && initialTemplate?.id ? (
                <View className="mt-2">
                  <Button
                    label="Delete this template"
                    variant="ghost"
                    onPress={this._onDelete}
                    disabled={saving}
                    className="border border-destructive/50"
                  />
                </View>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }
}
