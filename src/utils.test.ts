import { suggestCategory } from './lib/utils';

describe('Utility Functions', () => {
  describe('suggestCategory', () => {
    test('should suggest Math for math related titles', () => {
      expect(suggestCategory('Math Homework', '')).toBe('Math');
      expect(suggestCategory('Calculus Quiz', '')).toBe('Math');
    });

    test('should suggest Coding for programming related titles', () => {
      expect(suggestCategory('React Project', '')).toBe('Coding');
      expect(suggestCategory('Python Script', '')).toBe('Coding');
    });

    test('should suggest Exam for test related titles', () => {
      expect(suggestCategory('Final Exam', '')).toBe('Exam');
      expect(suggestCategory('Midterm Test', '')).toBe('Exam');
    });

    test('should suggest Reading for book related titles', () => {
      expect(suggestCategory('Read Chapter 1', '')).toBe('Reading');
      expect(suggestCategory('Write Essay', '')).toBe('Reading');
    });

    test('should suggest General for unknown titles', () => {
      expect(suggestCategory('Buy Milk', '')).toBe('General');
    });
  });
});
