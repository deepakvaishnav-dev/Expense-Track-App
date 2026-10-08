import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Svg, Path } from 'react-native-svg';

interface DatePickerModalProps {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(
    new Date(selectedDate || new Date())
  );
  const [tempSelectedDate, setTempSelectedDate] = useState<Date>(
    new Date(selectedDate || new Date())
  );

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const chosen = new Date(year, month, day);
    setTempSelectedDate(chosen);
  };

  const handleConfirm = () => {
    onSelectDate(tempSelectedDate);
    onClose();
  };

  const handleSelectQuick = (type: 'today' | 'yesterday') => {
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    setTempSelectedDate(d);
    setCurrentMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const isSelected = (day: number) => {
    return (
      tempSelectedDate.getDate() === day &&
      tempSelectedDate.getMonth() === month &&
      tempSelectedDate.getFullYear() === year
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  // Build grid days
  const calendarCells = [];
  // Empty offset slots
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-center items-center px-5 bg-black/60">
        <View className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-100">
          
          {/* Header Month / Year & Arrows */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={handlePrevMonth}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M15 19l-7-7 7-7" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            <View className="items-center">
              <Text className="text-gray-900 text-lg font-black tracking-tight">
                {MONTH_NAMES[month]} {year}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleNextMonth}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M9 5l7 7-7 7" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Quick Select Chips */}
          <View className="flex-row gap-2 mb-4 justify-center">
            <TouchableOpacity
              onPress={() => handleSelectQuick('today')}
              className="px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200"
            >
              <Text className="text-blue-600 font-bold text-xs">Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSelectQuick('yesterday')}
              className="px-3.5 py-1.5 rounded-full bg-gray-100 border border-gray-200"
            >
              <Text className="text-gray-700 font-bold text-xs">Yesterday</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday Labels Header */}
          <View className="flex-row justify-between mb-2">
            {WEEK_DAYS.map((wd, idx) => (
              <View key={idx} className="w-[13%] items-center">
                <Text className="text-gray-400 font-extrabold text-xs">{wd}</Text>
              </View>
            ))}
          </View>

          {/* Days Grid */}
          <View className="flex-row flex-wrap justify-between">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <View key={idx} className="w-[13%] h-9 mb-1.5" />;
              }

              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleSelectDay(day)}
                  activeOpacity={0.7}
                  className={`w-[13%] h-9 mb-1.5 rounded-full items-center justify-center ${
                    selected
                      ? 'bg-blue-600 shadow-md'
                      : today
                      ? 'bg-blue-50 border border-blue-300'
                      : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selected
                        ? 'text-white font-black'
                        : today
                        ? 'text-blue-600 font-black'
                        : 'text-gray-800 font-bold'
                    }`}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected Date Summary & Action Buttons */}
          <View className="mt-4 pt-4 border-t border-gray-100">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">Chosen Date</Text>
              <Text className="text-blue-600 font-black text-sm">
                {tempSelectedDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 py-3 bg-gray-100 rounded-2xl items-center justify-center border border-gray-200"
              >
                <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                className="flex-1 py-3 bg-blue-600 rounded-2xl items-center justify-center shadow-md"
              >
                <Text className="text-white font-black text-sm">Apply Date</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </View>
    </Modal>
  );
};
