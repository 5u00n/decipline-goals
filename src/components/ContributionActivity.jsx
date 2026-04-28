import React, { useMemo, useRef } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Card } from './ui/Card.jsx';
import { Text } from './ui/Text.jsx';
import { cn } from '../lib/cn.js';
import { buildWeekColumns, weekdayRowLabels } from '../lib/contributionGrid.js';

/** @typedef {Record<string, { totalCount?: number, completedCount?: number, allDone?: boolean }>} SummaryMap */

const DEFAULT_NUM_WEEKS = 14;
const CELL = 11;
const WEEK_GAP = 4;

/**
 * NativeWind tier for contribution level (0–5).
 * @param {number} level
 * @param {boolean} isFuture
 * @returns {string}
 */
function levelClass(level, isFuture) {
  if (isFuture) {
    return 'border border-dashed border-border bg-muted/30';
  }
  if (level <= 0) {
    return 'border border-border bg-muted';
  }
  const tiers = [
    '',
    'border border-success/30 bg-success/20',
    'border border-success/40 bg-success/40',
    'border border-success/50 bg-success/60',
    'border border-success/60 bg-success/80',
    'border border-success bg-success',
  ];
  return tiers[level] ?? tiers[0];
}

/**
 * @param {object} props
 * @param {SummaryMap} props.summaries
 * @param {string} props.endKey Last calendar day in the grid (usually today).
 * @param {string} props.selectedDateKey
 * @param {(key: string) => void} props.onSelectDate
 * @param {number} [props.numWeeks]
 * @param {number} [props.weekStartsOn]
 * @param {string} [props.title]
 */
export function ContributionActivity({
  summaries,
  endKey,
  selectedDateKey,
  onSelectDate,
  numWeeks = DEFAULT_NUM_WEEKS,
  weekStartsOn = 0,
  title = 'Activity',
}) {
  const scrollRef = useRef(/** @type {import('react-native').ScrollView | null} */ (null));

  const { weeks, rowLabels } = useMemo(() => {
    const { weeks: wks, weekStartsOn: ws } = buildWeekColumns({
      endKey,
      numWeeks,
      weekStartsOn,
      summaries,
    });
    return { weeks: wks, rowLabels: weekdayRowLabels(ws) };
  }, [summaries, endKey, numWeeks, weekStartsOn]);

  return (
    <Card className="mb-3 border-border">
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-xs uppercase text-muted-foreground">{title}</Text>
          <Text className="mt-0.5 text-[11px] text-muted-foreground">
            Tap a square to jump to that day.
          </Text>
        </View>
      </View>

      <View className="flex-row items-start">
        <View style={{ paddingTop: 0 }}>
          {rowLabels.map((lbl, i) => (
            <View
              key={`rl-${String(i)}`}
              style={{
                height: CELL + WEEK_GAP,
                justifyContent: 'center',
              }}
              className="pr-2"
            >
              <Text className="w-3 text-center text-[10px] leading-none text-muted-foreground">
                {lbl}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1, minHeight: (CELL + WEEK_GAP) * 7 }}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'flex-start', paddingBottom: 2 }}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          <View className="flex-row" style={{ gap: WEEK_GAP }}>
            {weeks.map((column, wi) => (
              <View key={`wk-${String(wi)}`} className="flex-col" style={{ gap: WEEK_GAP }}>
                {column.map((cell, ri) => {
                  const isSelected =
                    !cell.isFuture && cell.dateKey === selectedDateKey;
                  const inner = (
                    <View
                      className={cn(
                        'rounded-[2px]',
                        levelClass(cell.level, cell.isFuture),
                        isSelected && 'border-2 border-primary'
                      )}
                      style={{ width: CELL, height: CELL }}
                    />
                  );
                  if (cell.isFuture) {
                    return (
                      <View key={`${cell.dateKey}-${String(ri)}`}>{inner}</View>
                    );
                  }
                  return (
                    <Pressable
                      key={`${cell.dateKey}-${String(ri)}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${cell.dateKey}, completion level ${String(cell.level)}`}
                      hitSlop={4}
                      onPress={() => onSelectDate(cell.dateKey)}
                    >
                      {inner}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">Less</Text>
        <View className="flex-row items-center gap-1">
          {[0, 1, 2, 3, 4, 5].map((lv) => (
            <View
              key={`leg-${String(lv)}`}
              className={cn('rounded-[2px]', levelClass(lv, false))}
              style={{ width: 10, height: 10 }}
            />
          ))}
        </View>
        <Text className="text-xs text-muted-foreground">More</Text>
      </View>
    </Card>
  );
}
