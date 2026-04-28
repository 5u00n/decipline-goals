import { Text as RNText } from 'react-native';
import { cn } from '../../lib/cn.js';

/**
 * @param {Omit<import('react-native').TextProps, 'className'> & { className?: string, children: import('react').ReactNode }} props
 */
export function Text({ className, style, children, ...rest }) {
  return (
    <RNText
      className={cn('text-foreground', className)}
      style={style}
      {...rest}
    >
      {children}
    </RNText>
  );
}
