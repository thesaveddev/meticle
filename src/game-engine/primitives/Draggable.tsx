import React, { useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  PanResponderGestureState,
  GestureResponderEvent,
  LayoutChangeEvent,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
  type LayoutRectangle,
} from 'react-native';
import { Colors } from '../theme/colors';

interface DraggableProps {
  id: string;
  children: React.ReactNode;
  onDragStart?: (id: string) => void;
  onDragEnd?: (id: string) => void;
  onDrop?: (draggableId: string, dropZoneId: string) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  snapBack?: boolean;
}

interface DropZoneLayout {
  id: string;
  layout: LayoutRectangle;
}

const accessibleDropZones: DropZoneLayout[] = [];

export function registerDropZone(zone: DropZoneLayout): void {
  const index = accessibleDropZones.findIndex((z) => z.id === zone.id);
  if (index >= 0) {
    accessibleDropZones[index] = zone;
  } else {
    accessibleDropZones.push(zone);
  }
}

export function unregisterDropZone(id: string): void {
  const index = accessibleDropZones.findIndex((z) => z.id === id);
  if (index >= 0) {
    accessibleDropZones.splice(index, 1);
  }
}

function findDropZoneAtPosition(
  pageX: number,
  pageY: number
): DropZoneLayout | null {
  for (let i = accessibleDropZones.length - 1; i >= 0; i--) {
    const zone = accessibleDropZones[i];
    const { x, y, width, height } = zone.layout;
    const rightEdge = x + width;
    const bottomEdge = y + height;
    if (pageX >= x && pageX <= rightEdge && pageY >= y && pageY <= bottomEdge) {
      return zone;
    }
  }
  return null;
}

export default function Draggable({
  id,
  children,
  onDragStart,
  onDragEnd,
  onDrop,
  style,
  disabled = false,
  snapBack = true,
}: DraggableProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0)).current;
  const componentLayout = useRef<LayoutRectangle>({ x: 0, y: 0, width: 0, height: 0 });
  const isDragging = useRef(false);
  const initialPosition = useRef({ x: 0, y: 0 });

  const resetPosition = useCallback(() => {
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        friction: 7,
        tension: 60,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }),
      Animated.timing(shadowOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pan, scale, shadowOpacity]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (disabled) return false;
          return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
        },
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          isDragging.current = true;
          initialPosition.current = { x: 0, y: 0 };

          Animated.parallel([
            Animated.spring(scale, {
              toValue: 1.08,
              useNativeDriver: true,
              friction: 8,
              tension: 50,
            }),
            Animated.timing(shadowOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();

          onDragStart?.(id);
          AccessibilityInfo.announceForAccessibility(`Dragging item ${id}`);
        },
        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: (
          evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          isDragging.current = false;

          if (!snapBack) {
            pan.setValue({ x: 0, y: 0 });
            Animated.parallel([
              Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
              }),
              Animated.timing(shadowOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();
            onDragEnd?.(id);
            return;
          }

          const { moveX, moveY } = gestureState;
          const dropZone = findDropZoneAtPosition(moveX, moveY);

          if (dropZone) {
            Animated.parallel([
              Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
                friction: 7,
              }),
              Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
              }),
              Animated.timing(shadowOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
              onDrop?.(id, dropZone.id);
            });
            AccessibilityInfo.announceForAccessibility(
              `Dropped item ${id} on ${dropZone.id}`
            );
          } else {
            resetPosition();
            AccessibilityInfo.announceForAccessibility(`Item ${id} returned`);
          }

          onDragEnd?.(id);
        },
        onPanResponderTerminate: () => {
          isDragging.current = false;
          resetPosition();
          onDragEnd?.(id);
        },
      }),
    [disabled, pan, scale, shadowOpacity, id, onDragStart, onDragEnd, onDrop, snapBack, resetPosition]
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    event.target.measureInWindow((x, y, width, height) => {
      componentLayout.current = { x, y, width, height };
    });
  }, []);

  const animatedStyle = useMemo(
    () => ({
      transform: [
        { translateX: pan.x },
        { translateY: pan.y },
        { scale: scale },
      ],
      shadowOpacity: shadowOpacity,
      opacity: disabled ? 0.5 : 1,
    }),
    [pan.x, pan.y, scale, shadowOpacity, disabled]
  );

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        animatedStyle as StyleProp<ViewStyle>,
      ]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Draggable item ${id}`}
      accessibilityHint={
        disabled
          ? 'This item is not draggable right now'
          : 'Double tap and hold to drag this item'
      }
      accessibilityState={{ disabled }}
      importantForAccessibility={'yes'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
    shadowColor: Colors.shadowDrag,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
});
