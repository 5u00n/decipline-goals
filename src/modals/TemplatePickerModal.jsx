import React, { Component } from 'react';
import { Modal, View, Pressable, ScrollView } from 'react-native';
import { Text } from '../components/ui/Text.jsx';
import { Button } from '../components/ui/Button.jsx';

function isPersonalId(id) {
  return typeof id === 'string' && id.startsWith('personal_');
}

/**
 * @typedef {{
 *   visible: boolean;
 *   onClose: () => void;
 *   templates: Record<string, import('../types/goalModel.js').GoalTemplate>;
 *   activeId: string;
 *   onSelect: (id: string) => void;
 *   onCreateNew?: () => void;
 *   onEdit?: (id: string) => void;
 *   onDelete?: (id: string) => void;
 * }} TemplatePickerModalProps
 */
export class TemplatePickerModal extends Component {
  render() {
    const {
      visible,
      onClose,
      templates,
      activeId,
      onSelect,
      onCreateNew,
      onEdit,
      onDelete,
    } = this.props;
    if (!templates) {
      return null;
    }
    const ids = Object.keys(templates);
    const builtIn = ids.filter((id) => !isPersonalId(id));
    const personal = ids.filter(isPersonalId);

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[85%] rounded-t-2xl bg-card p-4">
            <View className="mb-3 items-center">
              <View className="h-1.5 w-10 rounded-full bg-border" />
            </View>

            <Text className="mb-2 text-lg font-semibold">
              Choose a routine / phase
            </Text>
            <Text className="mb-3 text-sm text-muted-foreground">
              Switching a template only affects new days; existing days keep their
              checklists.
            </Text>

            <ScrollView
              className="mb-2"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {onCreateNew ? (
                <Pressable
                  onPress={onCreateNew}
                  className="mb-3 rounded-md border border-dashed border-border p-3"
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-medium text-foreground">
                    + Create my own template
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Build a personal plan with your own sections and tasks.
                  </Text>
                </Pressable>
              ) : null}

              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                My templates
              </Text>
              {personal.length === 0 ? (
                <View className="mb-4 rounded-md border border-border bg-background p-3">
                  <Text className="text-xs text-muted-foreground">
                    You have no personal templates yet. Tap &quot;Create my own
                    template&quot; above to add one.
                  </Text>
                </View>
              ) : (
                personal.map((id) => {
                  const t = templates[id];
                  const active = id === activeId;
                  return (
                    <View
                      key={id}
                      className={`mb-2 rounded-md border p-3 ${
                        active
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      }`}
                    >
                      <Pressable onPress={() => onSelect(id)}>
                        <Text className="font-medium">{t?.title ?? id}</Text>
                        {t?.description ? (
                          <Text className="text-sm text-muted-foreground">
                            {t.description}
                          </Text>
                        ) : null}
                        {active ? (
                          <Text className="mt-1 text-xs text-primary">
                            Active
                          </Text>
                        ) : null}
                      </Pressable>
                      <View className="mt-2 flex-row gap-2">
                        {onEdit ? (
                          <Pressable
                            onPress={() => onEdit(id)}
                            className="rounded-md border border-border bg-card px-2 py-1"
                            accessibilityRole="button"
                          >
                            <Text className="text-xs text-foreground">Edit</Text>
                          </Pressable>
                        ) : null}
                        {onDelete ? (
                          <Pressable
                            onPress={() => onDelete(id)}
                            className="rounded-md border border-destructive/50 bg-card px-2 py-1"
                            accessibilityRole="button"
                          >
                            <Text className="text-xs text-destructive">
                              Delete
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}

              <Text className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Built-in routines
              </Text>
              {builtIn.map((id) => {
                const t = templates[id];
                const active = id === activeId;
                return (
                  <Pressable
                    key={id}
                    onPress={() => onSelect(id)}
                    className={`mb-2 rounded-md border p-3 ${
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Text className="font-medium">{t?.title ?? id}</Text>
                    {t?.description ? (
                      <Text className="text-sm text-muted-foreground">
                        {t.description}
                      </Text>
                    ) : null}
                    {active ? (
                      <Text className="mt-1 text-xs text-primary">Active</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button label="Close" variant="outline" onPress={onClose} />
          </View>
        </View>
      </Modal>
    );
  }
}
