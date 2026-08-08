import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '../../context/ThemeContext';

interface StepItem {
  num: number;
  label: string;
}

interface AppStepperProps {
  steps: StepItem[];
  currentStep: number;
}

export const AppStepper: React.FC<AppStepperProps> = ({ steps, currentStep }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {steps.map((step, idx) => {
        const isDone = currentStep > step.num;
        const isActive = currentStep === step.num;

        return (
          <React.Fragment key={step.num}>
            <View style={styles.stepColumn}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: isActive || isDone ? colors.primary : colors.secondarySurface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.circleText,
                    {
                      color: isActive || isDone ? colors.goldButtonText : colors.muted,
                    },
                  ]}
                >
                  {step.num}
                </Text>
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive || isDone ? colors.primary : colors.muted,
                  },
                ]}
              >
                {step.label}
              </Text>
            </View>

            {idx < steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  {
                    backgroundColor: isDone ? colors.primary : colors.secondarySurface,
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepColumn: {
    alignItems: 'center',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  circleText: {
    fontSize: 12,
    fontWeight: '900',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    marginTop: -16,
  },
});
