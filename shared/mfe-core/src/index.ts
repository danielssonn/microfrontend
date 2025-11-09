/**
 * MFE Core - Abstraction Layer for Micro Frontends
 *
 * This library provides the abstraction layer between the shell and MFEs,
 * enabling framework independence and composition mechanism flexibility.
 */

// Core interfaces
export * from './interfaces';

// Event bus
export * from './event-bus';

// Loaders
export * from './module-federation-loader';

// Utility to generate unique IDs
export function generateId(): string {
  return `mfe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
