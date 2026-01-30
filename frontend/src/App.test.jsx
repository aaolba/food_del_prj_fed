import { describe, it, expect } from 'vitest';

describe('App Component', () => {
  it('should pass a simple test', () => {
    expect(true).toBe(true);
  });

  it('should validate basic math', () => {
    const sum = 2 + 2;
    expect(sum).toBe(4);
  });

  it('should check string equality', () => {
    const appName = 'Food Delivery';
    expect(appName).toContain('Food');
  });
});
