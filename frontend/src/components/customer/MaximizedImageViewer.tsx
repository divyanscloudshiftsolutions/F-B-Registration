import React from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AppIcon } from '../common/AppIcon';

interface MaximizedImageViewerProps {
  visible: boolean;
  imageUrl: string | null;
  title?: string | null;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const MaximizedImageViewer: React.FC<MaximizedImageViewerProps> = ({
  visible,
  imageUrl,
  title,
  onClose,
}) => {
  const { colors, isDark } = useTheme();

  if (!visible || !imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/85 items-center justify-center p-4">
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                width: SCREEN_WIDTH - 32,
                maxWidth: 400,
                aspectRatio: 1,
              }}
              className="rounded-3xl overflow-hidden relative items-center justify-center shadow-2xl"
            >
              {/* Blurred background image fill */}
              <Image
                source={{ uri: imageUrl }}
                blurRadius={20}
                className="absolute inset-0 w-full h-full opacity-30"
                resizeMode="cover"
              />

              {/* Sharp foreground image */}
              <Image
                source={{ uri: imageUrl }}
                className="w-full h-full p-4"
                resizeMode="contain"
              />

              {/* Close Button */}
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                style={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="absolute top-3.5 right-3.5 p-2 rounded-full z-20 shadow-md"
              >
                <AppIcon name="x" size={18} color={colors.textPrimary} />
              </TouchableOpacity>

              {/* Title if present */}
              {title && (
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)',
                  }}
                  className="absolute bottom-3 left-3 right-3 py-2 px-3 rounded-xl z-20"
                >
                  <Text
                    style={{ color: colors.textPrimary }}
                    className="text-xs font-bold text-center"
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
