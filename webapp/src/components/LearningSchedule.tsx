/**
 * Learning schedule component with calendar grid, spaced repetition reviews,
 * and calendar export functionality.
 */

import { useState, useMemo } from 'react';
import {
  generateSchedule,
  generateCalendarDays,
  getReviewsForDate,
  getModuleById,
  formatDateShort,
  formatDateLong,
  getReviewLabel,
  type LearningSchedule as LearningScheduleType,
  type ScheduledReview,
} from '../core/spacedRepetition';
import {
  generateICSFile,
  generateGoogleCalendarURL,
  downloadICSFile,
} from '../core/calendarExport';
import './LearningSchedule.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Formats a date as YYYY-MM-DD for the date input.
 */
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses a YYYY-MM-DD string to a Date.
 */
const parseDateInput = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const LearningSchedule = () => {
  const [startDate, setStartDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  // Generate the schedule based on start date
  const schedule: LearningScheduleType = useMemo(
    () => generateSchedule(startDate),
    [startDate]
  );

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );
    return generateCalendarDays(firstOfMonth);
  }, [calendarMonth]);

  // Get reviews for selected date
  const selectedReviews = useMemo(() => {
    if (!selectedDate) return [];
    return getReviewsForDate(schedule, selectedDate);
  }, [schedule, selectedDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = parseDateInput(e.target.value);
    setStartDate(newDate);
    setCalendarMonth(newDate);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() - 1);
      return newMonth;
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + 1);
      return newMonth;
    });
  };

  const handleDownloadICS = () => {
    const icsContent = generateICSFile(schedule.reviews, schedule.modules);
    downloadICSFile(icsContent);
  };

  const handleAddToGoogle = (review: ScheduledReview) => {
    const module = getModuleById(schedule, review.moduleId);
    if (module) {
      const url = generateGoogleCalendarURL(review, module);
      window.open(url, '_blank');
    }
  };

  const getReviewCountForDate = (date: Date): number => {
    return getReviewsForDate(schedule, date).length;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === calendarMonth.getMonth();
  };

  const monthYearLabel = calendarMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="learning-schedule">
      <h2>Learning Schedule</h2>
      <p className="description">
        Master the tutorial content with spaced repetition. Set your start date
        and follow the schedule for optimal retention.
      </p>

      <div className="schedule-controls">
        <label className="start-date-label">
          Start Date:
          <input
            type="date"
            value={formatDateForInput(startDate)}
            onChange={handleStartDateChange}
            className="start-date-input"
          />
        </label>

        <button className="export-btn" onClick={handleDownloadICS}>
          Download iCal (.ics)
        </button>
      </div>

      <div className="schedule-content">
        <div className="calendar-section">
          <div className="calendar-header">
            <button onClick={handlePrevMonth} className="nav-btn">
              &lt;
            </button>
            <span className="month-label">{monthYearLabel}</span>
            <button onClick={handleNextMonth} className="nav-btn">
              &gt;
            </button>
          </div>

          <div className="calendar-grid">
            {WEEKDAYS.map((day) => (
              <div key={day} className="weekday-header">
                {day}
              </div>
            ))}

            {calendarDays.map((date, index) => {
              const reviewCount = getReviewCountForDate(date);
              const hasReviews = reviewCount > 0;

              return (
                <button
                  key={index}
                  className={`calendar-day ${hasReviews ? 'has-reviews' : ''} ${
                    isToday(date) ? 'today' : ''
                  } ${isSelected(date) ? 'selected' : ''} ${
                    !isCurrentMonth(date) ? 'other-month' : ''
                  }`}
                  onClick={() => handleDayClick(date)}
                >
                  <span className="day-number">{date.getDate()}</span>
                  {hasReviews && (
                    <span className="review-count">{reviewCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            <div className="legend-item">
              <span className="legend-dot has-reviews" />
              <span>Has reviews</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot today" />
              <span>Today</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          {selectedDate ? (
            <>
              <h3>{formatDateLong(selectedDate)}</h3>

              {selectedReviews.length === 0 ? (
                <p className="no-reviews">No reviews scheduled for this day.</p>
              ) : (
                <div className="review-list">
                  {selectedReviews.map((review) => {
                    const module = getModuleById(schedule, review.moduleId);
                    if (!module) return null;

                    return (
                      <div
                        key={`${review.moduleId}-${review.reviewNumber}`}
                        className={`review-card ${
                          review.isInitialLearning ? 'initial' : ''
                        }`}
                      >
                        <div className="review-header">
                          <span className="review-label">
                            {getReviewLabel(review)}
                          </span>
                          <span className="chapter-badge">
                            Ch {module.chapter}
                          </span>
                        </div>

                        <h4>{module.title}</h4>

                        <div className="concepts">
                          <strong>Concepts:</strong>
                          <ul>
                            {module.concepts.map((concept, i) => (
                              <li key={i}>{concept}</li>
                            ))}
                          </ul>
                        </div>

                        {module.reviewQuestions.length > 0 && (
                          <div className="questions">
                            <strong>Review Questions:</strong>
                            <ol>
                              {module.reviewQuestions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        <div className="review-actions">
                          <a
                            href={`tutorial.html${module.tutorialAnchor}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tutorial-link"
                          >
                            Open Tutorial Section
                          </a>
                          <button
                            className="google-btn"
                            onClick={() => handleAddToGoogle(review)}
                          >
                            Add to Google Calendar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="select-day-prompt">
              <p>Select a day on the calendar to see scheduled reviews.</p>

              <div className="schedule-summary">
                <h3>Your Learning Path</h3>
                <p>
                  Complete one chapter per day, then reinforce with spaced
                  reviews at intervals of 1, 3, 7, 14, 30, and 60 days.
                </p>

                <div className="module-list">
                  {schedule.modules.map((module, index) => (
                    <div key={module.id} className="module-item">
                      <span className="day-label">
                        {formatDateShort(
                          new Date(
                            startDate.getTime() + index * 24 * 60 * 60 * 1000
                          )
                        )}
                      </span>
                      <span className="module-title">
                        Ch {module.chapter}: {module.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
