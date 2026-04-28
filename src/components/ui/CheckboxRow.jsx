import { Pressable, View } from 'react-native';
import { Text } from './Text.jsx';
import { cn } from '../../lib/cn.js';

/**
 * @param {{
 *  label: string;
 *  done: boolean;
 *  onToggle: (next: boolean) => void;
 *  disabled?: boolean;
 *  highlight?: 'full' | 'partial' | 'none';
 *  className?: string;
 * }} props
 */
export function CheckboxRow({
  label,
  done,
  onToggle,
  disabled,
  highlight = 'none',
  className,
}) {
  const boxClass =
    done && highlight === 'full'
      ? 'border-success bg-success'
      : done
        ? 'border-primary bg-primary'
        : 'border-input bg-card';

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      disabled={!!disabled}
      onPress={() => onToggle(!done)}
      className={cn(
        'flex-row items-start gap-3 py-2',
        className
      )}
    >
      <View
        className={cn(
          'mt-0.5 h-5 w-5 items-center justify-center rounded border-2',
          boxClass
        )}
      >
        {done ? (
          <Text
            className={
              highlight === 'full'
                ? 'text-white text-xs font-bold'
                : 'text-primary-foreground text-xs font-bold'
            }
          >
            ✓
          </Text>
        ) : null}
      </View>
      <View className="shrink" style={{ flex: 1 }}>
        <Text
          className={cn(
            'text-foreground',
            done && 'text-muted-foreground line-through',
          )}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
