import { cva } from 'class-variance-authority';
import { Pressable } from 'react-native';
import { Text } from './Text.jsx';
import { cn } from '../../lib/cn.js';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-secondary',
        outline: 'border border-border bg-card',
        ghost: 'bg-transparent',
        link: 'bg-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const textVariants = cva('text-sm font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
      link: 'text-primary',
    },
  },
  defaultVariants: { variant: 'default' },
});

/**
 * @param {{
 *  label: string;
 *  onPress: () => void;
 *  disabled?: boolean;
 *  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link';
 *  className?: string;
 *  compact?: boolean;
 * }} props
 */
export function Button({
  label,
  onPress,
  disabled,
  variant,
  className,
  compact,
}) {
  const v = variant ?? 'default';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!!disabled}
      onPress={onPress}
      className={cn(
        buttonVariants({ variant: v }),
        compact && 'min-h-9 px-3 py-1.5',
        disabled && 'opacity-50',
        className
      )}
    >
      <Text
        className={cn(textVariants({ variant: v }), compact && 'text-xs')}
      >
        {label}
      </Text>
    </Pressable>
  );
}
