import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
  type LayoutRectangle,
} from 'react-native';
import { Colors } from '../theme/colors';

interface DropZoneProps {
  id: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  isActive?: boolean;
  onItemDropped?: (draggableId: string, dropZoneId: string) => void;
  acceptId?: string;
  highlightColor?: string;
}

export default function DropZone({
  id,
  children,
  style,
  isActive = false,
  onItemDropped,
  acceptId,
  highlightColor = Colors.dropZoneBorderActive,
}: DropZoneProps) {
  const layoutRef = useRef<LayoutRectangle>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    event.target.measureInWindow((x, y, width, height) => {
      layoutRef.current = { x, y, width, height };
      try {
        const { registerDropZone, unregisterDropZone } = require('./Draggable');
        unregisterDropZone(id);
        registerDropZone({ id, layout: layoutRef.current });
      } catch {
        // Draggable module not available
      }
    });
  }, [id]);

  const handleLayoutUpdate = useCallback(() => {
    try {
      const { registerDropZone, unregisterDropZone } = require('./Draggable');
      unregisterDropZone(id);
      registerDropZone({ id, layout: layoutRef.current });
    } catch {
      // Draggable module not available
    }
  }, [id]);

  useEffect(() => {
    return () => {
      try {
        const { unregisterDropZone } = require('./Draggable');
        unregisterDropZone(id);
      } catch {
        // Draggable module not available
      }
    };
  }, [id]);

  useEffect(() => {
    handleLayoutUpdate();
  }, [isActive, handleLayoutUpdate]);

  const containerStyle = useMemo(
    () => [
      styles.container,
      isActive && {
        backgroundColor: highlightColor + '15',
        borderColor: highlightColor,
        borderStyle: 'solid',
      },
      isActive && styles.activeContainer,
      acceptId && styles.acceptSpecific,
      style,
    ],
    [isActive, highlightColor, acceptId, style]
  );

  const borderStyle = useMemo(
    () => [
      styles.dashedBorder,
      isActive && styles.activeDashedBorder,
    ],
    [isActive]
  );

  return (
    <View
      style={containerStyle}
      onLayout={onLayout}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Drop zone ${id}${acceptId ? ` for item ${acceptId}` : ''}`}
      accessibilityHint={
        isActive
          ? 'Release to drop item here'
          : 'This is a drop target area'
      }
      accessibilityState={{
        selected: isActive,
        disabled: false,
      }}
    >
      {!isActive && <View style={borderStyle} pointerEvents="none" />}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 80,
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.dropZoneBorder,
    backgroundColor: Colors.dropZoneInactive,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  activeContainer: {
    transform: [{ scale: 1.03 }],
  },
  acceptSpecific: {
    borderWidth: 2,
    borderColor: Colors.borderDashed,
    borderStyle: 'dashed',
  },
  dashedBorder: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dropZoneBorder,
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  activeDashedBorder: {
    opacity: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    zIndex: 1,
  },
});
