import { View } from 'react-native';
import { cn } from '../../lib/cn.js';

/**
 * @param {import('react').ComponentProps<typeof View> & { className?: string, children: import('react').ReactNode }} props
 */
export function Card({ className, children, ...rest }) {
  return (
    <View
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-sm',
        className
      )}
      {...rest}
    >
      {children}
    </View>
  );
}
