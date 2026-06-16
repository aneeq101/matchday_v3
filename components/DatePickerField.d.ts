import React from 'react';

interface DatePickerFieldProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
}

declare const DatePickerField: React.ComponentType<DatePickerFieldProps>;
export default DatePickerField;
