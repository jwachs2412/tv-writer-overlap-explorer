/**
 * Pure functions for spaced repetition learning schedule calculation.
 * Based on SM-2 algorithm intervals.
 */

export interface LearningModule {
  readonly id: string;
  readonly title: string;
  readonly chapter: number;
  readonly concepts: readonly string[];
  readonly reviewQuestions: readonly string[];
  readonly tutorialAnchor: string;
}

export interface ScheduledReview {
  readonly moduleId: string;
  readonly date: Date;
  readonly reviewNumber: number; // 1-6
  readonly isInitialLearning: boolean;
}

export interface LearningSchedule {
  readonly startDate: Date;
  readonly modules: readonly LearningModule[];
  readonly reviews: readonly ScheduledReview[];
}

// SM-2 based review intervals in days
const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] as const;

/**
 * Returns the hardcoded tutorial modules based on tutorial.html content.
 */
export const getTutorialModules = (): readonly LearningModule[] => [
  {
    id: 'ch1-scraper',
    title: 'Web Scraper',
    chapter: 1,
    concepts: [
      'requests library',
      'BeautifulSoup parsing',
      'JSON file handling',
      'Rate limiting with sleep()',
    ],
    reviewQuestions: [
      'What is the purpose of rate limiting when scraping websites?',
      'How does BeautifulSoup find elements by CSS selector?',
      'Why do we save scraped data to JSON files?',
    ],
    tutorialAnchor: '#chapter-1-web-scraper',
  },
  {
    id: 'ch2-database',
    title: 'Database',
    chapter: 2,
    concepts: [
      'SQLite database',
      'Creating tables with SQL',
      'Junction tables for many-to-many relationships',
      'SQL queries and joins',
    ],
    reviewQuestions: [
      'What is a junction table and when do you need one?',
      'How do you query data that spans multiple tables?',
      'What are the benefits of using a database over JSON files?',
    ],
    tutorialAnchor: '#chapter-2-database',
  },
  {
    id: 'ch3-api',
    title: 'API Server',
    chapter: 3,
    concepts: [
      'HTTP server with Python',
      'JSON API responses',
      'CORS headers for web access',
    ],
    reviewQuestions: [
      'What is CORS and why is it needed for web APIs?',
      'How do you return JSON data from a Python HTTP handler?',
    ],
    tutorialAnchor: '#chapter-3-api',
  },
  {
    id: 'ch4-frontend',
    title: 'Frontend',
    chapter: 4,
    concepts: [
      'React components',
      'TypeScript types and interfaces',
      'Vite build tool',
      'useState and useEffect hooks',
      'Props and component composition',
    ],
    reviewQuestions: [
      'What is the difference between useState and useEffect?',
      'How do TypeScript interfaces help catch bugs?',
      'When should you split code into separate components?',
    ],
    tutorialAnchor: '#chapter-4-frontend',
  },
  {
    id: 'ch5-testing',
    title: 'Testing',
    chapter: 5,
    concepts: [
      'Unit testing with Vitest',
      'Pure function testing',
      'Test assertions and expectations',
    ],
    reviewQuestions: [
      'What makes a function easy to test?',
      'How do you structure tests using describe and it blocks?',
    ],
    tutorialAnchor: '#chapter-5-testing',
  },
  {
    id: 'ch6-deploy',
    title: 'Deployment',
    chapter: 6,
    concepts: [
      'Production builds',
      'GitHub Pages hosting',
      'Static site deployment',
    ],
    reviewQuestions: [],
    tutorialAnchor: '#chapter-6-deploy',
  },
];

/**
 * Adds days to a date, returning a new Date object.
 */
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Generates a full learning schedule with initial learning days and spaced reviews.
 */
export const generateSchedule = (
  startDate: Date,
  modules: readonly LearningModule[] = getTutorialModules()
): LearningSchedule => {
  const reviews: ScheduledReview[] = [];

  modules.forEach((module, index) => {
    const learningDay = index; // Day 0, 1, 2, etc.
    const learningDate = addDays(startDate, learningDay);

    // Add initial learning event
    reviews.push({
      moduleId: module.id,
      date: learningDate,
      reviewNumber: 0,
      isInitialLearning: true,
    });

    // Add spaced review events
    REVIEW_INTERVALS.forEach((interval, reviewIndex) => {
      reviews.push({
        moduleId: module.id,
        date: addDays(learningDate, interval),
        reviewNumber: reviewIndex + 1,
        isInitialLearning: false,
      });
    });
  });

  // Sort reviews by date
  reviews.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    startDate,
    modules,
    reviews,
  };
};

/**
 * Checks if two dates are the same calendar day.
 */
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

/**
 * Gets all reviews scheduled for a specific date.
 */
export const getReviewsForDate = (
  schedule: LearningSchedule,
  date: Date
): readonly ScheduledReview[] => {
  return schedule.reviews.filter((review) => isSameDay(review.date, date));
};

/**
 * Gets the module by ID from the schedule.
 */
export const getModuleById = (
  schedule: LearningSchedule,
  moduleId: string
): LearningModule | undefined => {
  return schedule.modules.find((m) => m.id === moduleId);
};

/**
 * Gets the date range that the schedule covers.
 */
export const getScheduleDateRange = (
  schedule: LearningSchedule
): { start: Date; end: Date } => {
  if (schedule.reviews.length === 0) {
    return { start: schedule.startDate, end: schedule.startDate };
  }

  const dates = schedule.reviews.map((r) => r.date.getTime());
  return {
    start: new Date(Math.min(...dates)),
    end: new Date(Math.max(...dates)),
  };
};

/**
 * Generates an array of dates for calendar grid display.
 * Returns 6 weeks (42 days) starting from the beginning of the start date's week.
 */
export const generateCalendarDays = (startDate: Date): readonly Date[] => {
  const days: Date[] = [];

  // Find the first day of the week containing startDate
  const firstDayOfGrid = new Date(startDate);
  firstDayOfGrid.setDate(firstDayOfGrid.getDate() - firstDayOfGrid.getDay());

  // Generate 6 weeks of days
  for (let i = 0; i < 42; i++) {
    days.push(addDays(firstDayOfGrid, i));
  }

  return days;
};

/**
 * Formats a date for display (e.g., "Jan 22").
 */
export const formatDateShort = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Formats a date for display with year (e.g., "January 22, 2026").
 */
export const formatDateLong = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Gets the review label (e.g., "Review 1" or "Learn").
 */
export const getReviewLabel = (review: ScheduledReview): string => {
  if (review.isInitialLearning) {
    return 'Learn';
  }
  return `Review ${review.reviewNumber}`;
};
