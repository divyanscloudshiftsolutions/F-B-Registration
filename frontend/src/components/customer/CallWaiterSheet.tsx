import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  Droplet,
  Utensils,
  Trash2,
  HelpCircle,
  Receipt,
  HandHelping,
  MoreHorizontal,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

export type ServiceRequestType =
  | 'WATER'
  | 'CUTLERY'
  | 'NAPKINS'
  | 'CLEAN_UP'
  | 'ASSISTANCE'
  | 'BILL'
  | 'OTHER';

interface CallWaiterSheetProps {
  open: boolean;
  tokenNumber: string;
  tableId?: string;
  activeRequests?: any[];
  onClose: () => void;
  onRequestSubmitted?: (req: any) => void;
}

const OPTIONS: Array<{
  type: ServiceRequestType;
  label: string;
  desc: string;
  icon: any;
}> = [
  { type: 'WATER', label: 'Drinking Water', desc: 'Glass or pitcher refill', icon: Droplet },
  { type: 'CUTLERY', label: 'Extra Cutlery', desc: 'Forks, spoons, knives', icon: Utensils },
  { type: 'NAPKINS', label: 'Table Napkins', desc: 'Tissue / napkin refill', icon: HandHelping },
  { type: 'CLEAN_UP', label: 'Table Cleanup', desc: 'Spill or table wipe', icon: Trash2 },
  { type: 'ASSISTANCE', label: 'Order Help', desc: 'Ask waiter to take order', icon: HelpCircle },
  { type: 'BILL', label: 'Bill Help', desc: 'Request bill / split advice', icon: Receipt },
  { type: 'OTHER', label: 'Other Request', desc: 'Custom note to floor staff', icon: MoreHorizontal },
];

export const CallWaiterSheet: React.FC<CallWaiterSheetProps> = ({
  open,
  tokenNumber,
  tableId,
  activeRequests = [],
  onClose,
  onRequestSubmitted,
}) => {
  const { colors, isDark } = useTheme();

  const [showOther, setShowOther] = useState(false);
  const [otherNote, setOtherNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittingType, setSubmittingType] = useState<ServiceRequestType | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setShowOther(false);
    setOtherNote('');
    setFeedback(null);
    setSubmittingType(null);
    onClose();
  };

  const handleSubmit = async (type: ServiceRequestType, note?: string) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmittingType(type);
    setFeedback(null);

    try {
      if (type === 'BILL') {
        try {
          await api.requestBill(tokenNumber);
        } catch {}
      }

      const created = await api.createServiceRequest({
        tokenNumber,
        tableId,
        type: type === 'BILL' ? 'BILL_REQUEST' : type,
        note,
      });

      if (created.isDuplicate || created.alreadyActive) {
        setFeedback({
          type: 'info',
          message: created.message || 'You have already requested assistance. Your waiter has been notified.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Request for ${type.replace(/_/g, ' ')} sent! A staff member has been notified.`,
        });
        if (onRequestSubmitted) onRequestSubmitted(created);
      }

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send request. Please try again.',
      });
    } finally {
      setSubmitting(false);
      setSubmittingType(null);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.modal,
              borderTopColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Top Drag Handle */}
          <View style={styles.dragHandleWrapper}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? '#52525B' : '#D1D5DB' }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Call Waiter</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>What can our floor team assist you with?</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Feedback Message */}
            {feedback && (
              <View
                style={[
                  styles.feedbackBanner,
                  {
                    backgroundColor:
                      feedback.type === 'success'
                        ? 'rgba(16,185,129,0.12)'
                        : feedback.type === 'info'
                        ? 'rgba(59,130,246,0.12)'
                        : 'rgba(239,68,68,0.12)',
                    borderColor:
                      feedback.type === 'success'
                        ? 'rgba(16,185,129,0.3)'
                        : feedback.type === 'info'
                        ? 'rgba(59,130,246,0.3)'
                        : 'rgba(239,68,68,0.3)',
                  },
                ]}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 size={16} color="#10B981" />
                ) : feedback.type === 'info' ? (
                  <Clock size={16} color="#3B82F6" />
                ) : (
                  <AlertCircle size={16} color="#EF4444" />
                )}
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color:
                        feedback.type === 'success'
                          ? '#10B981'
                          : feedback.type === 'info'
                          ? '#3B82F6'
                          : '#EF4444',
                    },
                  ]}
                >
                  {feedback.message}
                </Text>
              </View>
            )}

            {/* Active Requests */}
            {activeRequests.length > 0 && (
              <View style={styles.activeSection}>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>
                  ACTIVE REQUESTS ({activeRequests.length})
                </Text>
                <View style={styles.activeList}>
                  {activeRequests.map((r) => (
                    <View
                      key={r.id}
                      style={[
                        styles.activeRow,
                        {
                          backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.activeRowLeft}>
                        <Clock size={14} color={colors.primary} />
                        <Text style={[styles.activeType, { color: colors.text }]}>
                          {r.type.replace(/_/g, ' ')}
                        </Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>
                          {r.status === 'NEW' ? 'Staff Notified' : r.status === 'ACKNOWLEDGED' ? 'Attending' : r.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Options Grid */}
            {!showOther ? (
              <View style={styles.optionsGrid}>
                {OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSubmittingThis = submittingType === opt.type;

                  if (opt.type === 'OTHER') {
                    return (
                      <TouchableOpacity
                        key={opt.type}
                        onPress={() => setShowOther(true)}
                        disabled={submitting}
                        style={[
                          styles.otherCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.optLeft}>
                          <View style={[styles.iconWrapper, { backgroundColor: colors.primaryLight }]}>
                            <Icon size={18} color={colors.primary} />
                          </View>
                          <View>
                            <Text style={[styles.optTitle, { color: colors.text }]}>{opt.label}</Text>
                            <Text style={[styles.optDesc, { color: colors.muted }]}>{opt.desc}</Text>
                          </View>
                        </View>
                        <View style={[styles.notePill, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.notePillText, { color: colors.primary }]}>Add Note</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={opt.type}
                      onPress={() => handleSubmit(opt.type)}
                      disabled={submitting}
                      style={[
                        styles.optCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={[styles.iconWrapper, { backgroundColor: colors.primaryLight }]}>
                        {isSubmittingThis ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Icon size={18} color={colors.primary} />
                        )}
                      </View>
                      <Text style={[styles.optTitle, { color: colors.text }]}>{opt.label}</Text>
                      <Text style={[styles.optDesc, { color: colors.muted }]}>{opt.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.customSection}>
                <Text style={[styles.customTitle, { color: colors.text }]}>Tell us what you need</Text>
                <TextInput
                  value={otherNote}
                  onChangeText={setOtherNote}
                  placeholder="e.g. Please dim the lights, high chair for toddler..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.customInput,
                    {
                      color: colors.text,
                      backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                      borderColor: colors.border,
                    },
                  ]}
                />
                <View style={styles.customBtnRow}>
                  <TouchableOpacity
                    onPress={() => setShowOther(false)}
                    style={[styles.customBackBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.customBackText, { color: colors.text }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={!otherNote.trim() || submitting}
                    onPress={() => handleSubmit('OTHER', otherNote.trim())}
                    style={[
                      styles.customSendBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: !otherNote.trim() || submitting ? 0.5 : 1,
                      },
                    ]}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={colors.primaryButtonText} />
                    ) : (
                      <Text style={[styles.customSendText, { color: colors.primaryButtonText }]}>
                        Send Request
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '80%',
  },
  dragHandleWrapper: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  activeSection: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeList: {
    gap: 6,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  activeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeType: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusPillText: {
    color: '#F59E0B',
    fontSize: 9.5,
    fontWeight: '800',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  optTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  optDesc: {
    fontSize: 10,
  },
  otherCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  optLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  notePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  customSection: {
    gap: 10,
  },
  customTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  customInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 12,
    minHeight: 70,
  },
  customBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customBackBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customSendBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSendText: {
    fontSize: 12,
    fontWeight: '800',
  },
});

export default CallWaiterSheet;
