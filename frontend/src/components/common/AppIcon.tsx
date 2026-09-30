import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  ClipboardCheck,
  Wine,
  Map,
  BarChart3,
  Calendar,
  User,
  Phone,
  Mail,
  Users,
  Bell,
  Sun,
  Moon,
  Camera,
  Scan,
  CreditCard,
  Zap,
  RefreshCw,
  X,
  Check,
  ArrowRight,
  ChevronRight,
  Plus,
  Minus,
  AlertTriangle,
  Info,
  Shield,
  Lock,
  Clock,
  Circle,
  HelpCircle,
  Home,
  RotateCcw,
  PhoneCall,
  ClipboardList,
  Receipt,
  Trash2,
  UtensilsCrossed,
  ShoppingBag,
  ShoppingCart,
  Flame,
  ChefHat,
  CheckCircle2,
  Sparkles,
  KeyRound,
  Ticket,
  Search,
  Filter,
  LogOut,
  CalendarCheck,
  LayoutGrid,
  ShieldAlert,
  LayoutDashboard,
  LucideIcon,
} from 'lucide-react-native';

interface AppIconProps {
  name: string;
  color?: string;
  size?: number;
  label?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({ 
  name, 
  color, 
  size = 20, 
  label 
}) => {
  const { colors } = useTheme();
  const activeColor = color || colors.text;
  const key = (name || '').toLowerCase().trim();

  const iconMap: Record<string, LucideIcon> = {
    'checkin': ClipboardCheck,
    'clipboard': ClipboardCheck,
    'clipboard-check': ClipboardCheck,
    'bartender': Wine,
    'beer': Wine,
    'wine': Wine,
    'glass': Wine,
    'cup': Wine,
    'cocktail': Wine,
    'tables': Map,
    'map': Map,
    'admin': BarChart3,
    'chart': BarChart3,
    'barchart3': BarChart3,
    'attendance': Calendar,
    'calendar': Calendar,
    'user': User,
    'person': User,
    'phone': Phone,
    'mail': Mail,
    'users': Users,
    'bell': Bell,
    'sun': Sun,
    'moon': Moon,
    'camera': Camera,
    'scan': Scan,
    'qr': Scan,
    'credit-card': CreditCard,
    'card': CreditCard,
    'nfc': Zap,
    'zap': Zap,
    'refresh': RefreshCw,
    'refresh-cw': RefreshCw,
    'x': X,
    'close': X,
    'check': Check,
    'arrow-right': ArrowRight,
    'chevron-right': ChevronRight,
    'plus': Plus,
    'minus': Minus,
    'alert-circle': AlertTriangle,
    'alert-triangle': AlertTriangle,
    'alert': AlertTriangle,
    'info': Info,
    'shield': Shield,
    'lock': Lock,
    'clock': Clock,
    'circle': Circle,
    'home': Home,
    'rotate-ccw': RotateCcw,
    'phone-call': PhoneCall,
    'clipboard-list': ClipboardList,
    'receipt': Receipt,
    'trash-2': Trash2,
    'trash': Trash2,
    'utensils-crossed': UtensilsCrossed,
    'utensils': UtensilsCrossed,
    'shopping-bag': ShoppingBag,
    'shopping-cart': ShoppingCart,
    'flame': Flame,
    'chef-hat': ChefHat,
    'check-circle-2': CheckCircle2,
    'sparkles': Sparkles,
    'key-round': KeyRound,
    'ticket': Ticket,
    'search': Search,
    'filter': Filter,
    'log-out': LogOut,
    'calendar-check': CalendarCheck,
    'layout-grid': LayoutGrid,
    'shield-alert': ShieldAlert,
    'layout-dashboard': LayoutDashboard,
  };

  const SelectedIcon = iconMap[key] || HelpCircle || Circle;

  if (!SelectedIcon) {
    return null;
  }

  return (
    <SelectedIcon 
      size={size} 
      color={activeColor} 
      accessibilityLabel={label || name}
    />
  );
};
