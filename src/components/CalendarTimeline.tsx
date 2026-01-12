'use client';

import React, { useState } from 'react';
import { Ratesheet } from '@/models/Ratesheet';

interface CalendarTimelineProps {
  ratesheets: Ratesheet[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onRatesheetClick?: (ratesheet: Ratesheet) => void;
  viewMode: 'day' | 'week' | 'month';
}

export default function CalendarTimeline({
  ratesheets,
  selectedDate,
  onDateChange,
  onRatesheetClick,
  viewMode = 'week'
}: CalendarTimelineProps) {
  const [hoveredRatesheet, setHoveredRatesheet] = useState<string | null>(null);

  // Generate time slots (hours) for day view
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push({
        hour,
        label: hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`
      });
    }
    return slots;
  };

  // Generate days for week view
  const generateWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Get ratesheets for a specific time slot
  const getRatesheetsForSlot = (date: Date, hour?: number) => {
    return ratesheets.filter(rs => {
      const slotDate = new Date(date);
      if (hour !== undefined) {
        slotDate.setHours(hour, 0, 0, 0);
      }

      // Check if ratesheet is effective for this date
      if (rs.effectiveFrom > slotDate) return false;
      if (rs.effectiveTo && rs.effectiveTo < slotDate) return false;

      // Check time windows for timing-based ratesheets
      if (rs.type === 'TIMING_BASED' && rs.timeWindows && hour !== undefined) {
        const slotTime = `${hour.toString().padStart(2, '0')}:00`;
        return rs.timeWindows.some(tw => 
          slotTime >= tw.startTime && slotTime < tw.endTime
        );
      }

      return true;
    });
  };

  // Get color for ratesheet based on priority
  const getRatesheetColor = (priority: number, index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-red-500'
    ];
    return colors[index % colors.length];
  };

  // Render Day View
  const renderDayView = () => {
    const timeSlots = generateTimeSlots();

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
        </div>

        {/* Time slots */}
        <div className="flex-1 overflow-y-auto">
          {timeSlots.map(slot => {
            const slotRatesheets = getRatesheetsForSlot(selectedDate, slot.hour);

            return (
              <div 
                key={slot.hour}
                className="flex border-b hover:bg-gray-50 transition-colors"
              >
                {/* Time label */}
                <div className="w-24 p-3 text-sm text-gray-600 font-medium border-r">
                  {slot.label}
                </div>

                {/* Ratesheet layers */}
                <div className="flex-1 relative min-h-[60px] p-2">
                  {slotRatesheets.length === 0 ? (
                    <div className="text-xs text-gray-400 italic">No pricing</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {slotRatesheets.map((rs, idx) => (
                        <div
                          key={rs._id?.toString()}
                          onClick={() => onRatesheetClick?.(rs)}
                          onMouseEnter={() => setHoveredRatesheet(rs._id?.toString() || null)}
                          onMouseLeave={() => setHoveredRatesheet(null)}
                          className={`
                            ${getRatesheetColor(rs.priority, idx)}
                            text-white text-xs px-2 py-1 rounded cursor-pointer
                            transition-all duration-200
                            ${hoveredRatesheet === rs._id?.toString() ? 'scale-105 shadow-lg' : 'hover:scale-105'}
                          `}
                          style={{ 
                            opacity: 0.85,
                            zIndex: rs.priority 
                          }}
                        >
                          <div className="font-semibold">{rs.name}</div>
                          <div className="text-[10px] opacity-90">
                            Priority: {rs.priority} | {rs.type}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Week View
  const renderWeekView = () => {
    const weekDays = generateWeekDays();

    return (
      <div className="flex flex-col h-full">
        {/* Header with days */}
        <div className="grid grid-cols-8 border-b">
          <div className="p-3 border-r text-sm font-medium text-gray-600">Time</div>
          {weekDays.map(day => (
            <div 
              key={day.toISOString()}
              className={`p-3 text-center border-r ${
                day.toDateString() === selectedDate.toDateString() 
                  ? 'bg-blue-50 font-semibold' 
                  : ''
              }`}
            >
              <div className="text-xs text-gray-600">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-lg">{day.getDate()}</div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="flex-1 overflow-y-auto">
          {generateTimeSlots().map(slot => (
            <div key={slot.hour} className="grid grid-cols-8 border-b min-h-[50px]">
              <div className="p-2 border-r text-xs text-gray-600">{slot.label}</div>
              {weekDays.map(day => {
                const slotRatesheets = getRatesheetsForSlot(day, slot.hour);
                
                return (
                  <div 
                    key={day.toISOString()}
                    className="relative p-1 border-r hover:bg-gray-50"
                  >
                    {slotRatesheets.length > 0 && (
                      <div 
                        className={`
                          ${getRatesheetColor(slotRatesheets[0].priority, 0)}
                          text-white text-[10px] px-1 py-0.5 rounded truncate
                        `}
                        title={slotRatesheets.map(rs => rs.name).join(', ')}
                      >
                        {slotRatesheets.length} rate{slotRatesheets.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render Month View
  const renderMonthView = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeks = [];
    let currentWeek = [];
    let currentDate = new Date(startDate);

    while (currentDate <= lastDay || currentWeek.length > 0) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);

      if (currentDate > lastDay && currentWeek.length === 7) {
        weeks.push(currentWeek);
        break;
      }
    }

    return (
      <div className="flex flex-col h-full">
        {/* Month header */}
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">
            {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 border-r">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 border-b min-h-[100px]">
              {week.map(date => {
                const isCurrentMonth = date.getMonth() === month;
                const dayRatesheets = getRatesheetsForSlot(date);

                return (
                  <div
                    key={date.toISOString()}
                    className={`
                      p-2 border-r cursor-pointer hover:bg-gray-50 transition-colors
                      ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''}
                      ${date.toDateString() === selectedDate.toDateString() ? 'ring-2 ring-blue-500 ring-inset' : ''}
                    `}
                    onClick={() => onDateChange(date)}
                  >
                    <div className="text-sm font-medium mb-1">{date.getDate()}</div>
                    {dayRatesheets.length > 0 && (
                      <div className="space-y-1">
                        {dayRatesheets.slice(0, 3).map((rs, idx) => (
                          <div
                            key={rs._id?.toString()}
                            className={`
                              ${getRatesheetColor(rs.priority, idx)}
                              text-white text-[10px] px-1 py-0.5 rounded truncate
                            `}
                          >
                            {rs.name}
                          </div>
                        ))}
                        {dayRatesheets.length > 3 && (
                          <div className="text-[10px] text-gray-600">
                            +{dayRatesheets.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-white rounded-lg shadow-lg">
      {viewMode === 'day' && renderDayView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'month' && renderMonthView()}
    </div>
  );
}
