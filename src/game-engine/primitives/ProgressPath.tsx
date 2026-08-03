import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors } from '../theme/colors';

interface ProgressPathProps {
  totalSteps: number;
  currentStep: number;
  completedSteps: number[];
  labels?: string[];
  style?: StyleProp<ViewStyle>;
}

interface StepState {
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isUpcoming: boolean;
}

export default function ProgressPath({
  totalSteps,
  currentStep,
  completedSteps,
  labels,
  style,
}: ProgressPathProps) {
  const steps: StepState[] = useMemo(() => {
    const result: StepState[] = [];
    for (let i = 0; i < totalSteps; i++) {
      result.push({
        index: i,
        isCompleted: completedSteps.includes(i),
        isCurrent: i === currentStep && !completedSteps.includes(i),
        isUpcoming: !completedSteps.includes(i) && i !== currentStep,
      });
    }
    return result;
  }, [totalSteps, currentStep, completedSteps]);

  if (totalSteps < 1) return null;

  return (
    <View style={[styles.container, style]} accessibilityLabel="Progress path">
      <View style={styles.track}>
        {steps.map((step, idx) => (
          <React.Fragment key={`step-${step.index}`}>
            <View style={styles.stepColumn}>
              <View
                style={[
                  styles.circle,
                  step.isCompleted && styles.completedCircle,
                  step.isCurrent && styles.currentCircle,
                  step.isUpcoming && styles.upcomingCircle,
                ]}
                accessible={true}
                accessibilityLabel={`Step ${step.index + 1} of ${totalSteps}${
                  step.isCompleted
                    ? ', completed'
                    : step.isCurrent
                    ? ', current step'
                    : ', upcoming'
                }`}
                accessibilityRole="text"
              >
                {step.isCompleted ? (
                  <Text style={styles.completedIcon}>&#10003;</Text>
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      step.isCurrent && styles.currentStepNumber,
                      step.isUpcoming && styles.upcomingStepNumber,
                    ]}
                  >
                    {step.index + 1}
                  </Text>
                )}
              </View>
              {labels && labels[step.index] && (
                <Text
                  style={[
                    styles.label,
                    step.isCompleted && styles.completedLabel,
                    step.isCurrent && styles.currentLabel,
                    step.isUpcoming && styles.upcomingLabel,
                  ]}
                  numberOfLines={2}
                >
                  {labels[step.index]}
                </Text>
              )}
            </View>
            {idx < totalSteps - 1 && (
              <View
                style={[
                  styles.connector,
                  step.isCompleted && styles.completedConnector,
                ]}
                accessible={false}
              >
                <View
                  style={[
                    styles.connectorFill,
                    step.isCompleted && styles.connectorFillComplete,
                  ]}
                />
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 36;
const CONNECTOR_HEIGHT = 4;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepColumn: {
    alignItems: 'center',
    width: 64,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    backgroundColor: Colors.surface,
  },
  completedCircle: {
    backgroundColor: Colors.progressComplete,
    borderColor: Colors.progressCompleteBorder,
  },
  currentCircle: {
    backgroundColor: Colors.progressCurrent,
    borderColor: Colors.progressCurrentBorder,
  },
  upcomingCircle: {
    backgroundColor: Colors.surface,
    borderColor: Colors.progressUpcomingBorder,
  },
  completedIcon: {
    fontSize: 16,
    color: Colors.textOnDark,
    fontWeight: 'bold',
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  currentStepNumber: {
    color: Colors.text,
    fontWeight: '800',
  },
  upcomingStepNumber: {
    color: Colors.textLight,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 60,
  },
  completedLabel: {
    color: Colors.success,
  },
  currentLabel: {
    color: Colors.warningDark,
    fontWeight: '700',
  },
  upcomingLabel: {
    color: Colors.textLight,
  },
  connector: {
    height: CONNECTOR_HEIGHT,
    borderRadius: CONNECTOR_HEIGHT / 2,
    backgroundColor: Colors.progressUpcoming,
    marginTop: CIRCLE_SIZE / 2 - CONNECTOR_HEIGHT / 2,
    marginHorizontal: -4,
    flex: 1,
    minWidth: 28,
    maxWidth: 40,
    overflow: 'hidden',
  },
  connectorFill: {
    height: '100%',
    borderRadius: CONNECTOR_HEIGHT / 2,
    backgroundColor: Colors.progressUpcoming,
    width: '0%',
  },
  connectorFillComplete: {
    width: '100%',
    backgroundColor: Colors.progressComplete,
  },
  completedConnector: {
    backgroundColor: Colors.progressComplete,
  },
});
