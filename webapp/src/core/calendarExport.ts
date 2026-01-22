/**
 * Pure functions for calendar format generation.
 * Generates iCal (.ics) files and Google Calendar URLs.
 */

import type { LearningModule, ScheduledReview } from './spacedRepetition';
import { getReviewLabel } from './spacedRepetition';

/**
 * Formats a date for iCal format (YYYYMMDDTHHMMSSZ).
 * Event time is 9:00 AM in user's local time, expressed in UTC.
 */
const formatICSDate = (date: Date): string => {
  const eventDate = new Date(date);
  eventDate.setHours(9, 0, 0, 0);
  return eventDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

/**
 * Formats a date for iCal format with 1 hour added (end time).
 */
const formatICSDateEnd = (date: Date): string => {
  const eventDate = new Date(date);
  eventDate.setHours(10, 0, 0, 0);
  return eventDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

/**
 * Escapes text for iCal format.
 */
const escapeICSText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

/**
 * Generates the description for a calendar event.
 */
const generateEventDescription = (
  review: ScheduledReview,
  module: LearningModule
): string => {
  const lines: string[] = [];

  if (review.isInitialLearning) {
    lines.push(`Learn Chapter ${module.chapter}: ${module.title}`);
  } else {
    lines.push(`Review ${review.reviewNumber} of 6 for Chapter ${module.chapter}`);
  }

  lines.push('');
  lines.push('Concepts to review:');
  module.concepts.forEach((concept) => {
    lines.push(`• ${concept}`);
  });

  if (module.reviewQuestions.length > 0) {
    lines.push('');
    lines.push('Review questions:');
    module.reviewQuestions.forEach((question, i) => {
      lines.push(`${i + 1}. ${question}`);
    });
  }

  lines.push('');
  lines.push(`Tutorial: tutorial.html${module.tutorialAnchor}`);

  return lines.join('\n');
};

/**
 * Generates the event title.
 */
const generateEventTitle = (
  review: ScheduledReview,
  module: LearningModule
): string => {
  const label = getReviewLabel(review);
  return `${label}: ${module.title}`;
};

/**
 * Generates a single iCal event.
 */
export const generateICSEvent = (
  review: ScheduledReview,
  module: LearningModule
): string => {
  const title = generateEventTitle(review, module);
  const description = generateEventDescription(review, module);
  const uid = `${review.moduleId}-r${review.reviewNumber}-${review.date.getTime()}@tvwriter-explorer`;

  return [
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(review.date)}`,
    `DTEND:${formatICSDateEnd(review.date)}`,
    `SUMMARY:${escapeICSText(title)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `UID:${uid}`,
    'END:VEVENT',
  ].join('\r\n');
};

/**
 * Generates a complete iCal file content for multiple reviews.
 */
export const generateICSFile = (
  reviews: readonly ScheduledReview[],
  modules: readonly LearningModule[]
): string => {
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  const events = reviews
    .map((review) => {
      const module = moduleMap.get(review.moduleId);
      if (!module) return null;
      return generateICSEvent(review, module);
    })
    .filter((event): event is string => event !== null);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TV Writer Explorer//Learning Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
};

/**
 * Generates a Google Calendar URL for a single event.
 */
export const generateGoogleCalendarURL = (
  review: ScheduledReview,
  module: LearningModule
): string => {
  const title = generateEventTitle(review, module);
  const description = generateEventDescription(review, module);

  const startDate = new Date(review.date);
  startDate.setHours(9, 0, 0, 0);

  const endDate = new Date(review.date);
  endDate.setHours(10, 0, 0, 0);

  // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
  const formatGoogleDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
    details: description,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Triggers a download of the ICS file in the browser.
 */
export const downloadICSFile = (
  content: string,
  filename: string = 'learning-schedule.ics'
): void => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
