import React, { Component } from 'react';
import {
  Modal,
  View,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../components/ui/Text.jsx';
import { Button } from '../components/ui/Button.jsx';

/**
 * Bottom-sheet modal to add a one-off task for the currently selected day.
 *
 * @typedef {{
 *   visible: boolean;
 *   onClose: () => void;
 *   label: string;
 *   onChangeLabel: (next: string) => void;
 *   onAdd: () => void;
 *   onChangeRoutine: () => void;
 *   dateHint?: string;
 * }} AddOneOffBottomModalProps
 */
export class AddOneOffBottomModal extends Component {
  /**
   * @param {AddOneOffBottomModalProps} props
   */
  constructor(props) {
    super(props);
  }

  _onSubmit = () => {
    const { onAdd, label } = this.props;
    if (typeof label === 'string' && label.trim().length === 0) {
      return;
    }
    onAdd();
  };

  render() {
    const {
      visible,
      onClose,
      label,
      onChangeLabel,
      onChangeRoutine,
      dateHint,
    } = this.props;

    const trimmed = (label ?? '').trim();
    const canAdd = trimmed.length > 0;

    return (
      <Modal
        visible={!!visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close add task sheet"
          className="flex-1 justify-end bg-black/40"
        >
          <Pressable onPress={() => {}} className="w-full">
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View className="rounded-t-2xl bg-card p-4">
                <View className="mb-3 items-center">
                  <View className="h-1.5 w-10 rounded-full bg-border" />
                </View>

                <Text className="text-lg font-semibold">Quick add</Text>
                {dateHint ? (
                  <Text className="mt-0.5 text-xs text-muted-foreground">
                    Adding to {dateHint}
                  </Text>
                ) : null}

                <Text className="mt-3 mb-1 text-xs font-medium text-muted-foreground">
                  Task
                </Text>
                <TextInput
                  value={label ?? ''}
                  onChangeText={onChangeLabel}
                  placeholder="e.g. 30 min walk, finish chapter 3, …"
                  placeholderTextColor="hsl(240 3.8% 60%)"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={this._onSubmit}
                  className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                  style={{ minHeight: 44 }}
                />

                <View className="mt-4 flex-row gap-2">
                  <Button
                    label={canAdd ? 'Add' : 'Type a task to add'}
                    onPress={this._onSubmit}
                    disabled={!canAdd}
                    className="flex-1"
                  />
                  <Button
                    label="Close"
                    variant="outline"
                    onPress={onClose}
                  />
                </View>

                <Pressable
                  onPress={onChangeRoutine}
                  className="mt-4 rounded-md border border-dashed border-border p-3"
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-medium text-foreground">
                    Change routine (template)
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Pick a different built-in or personal plan
                  </Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }
}
