// Import bootstrap asynchronously to avoid eager consumption error
// This allows Module Federation to initialize shared modules first
import('./bootstrap').catch(err => console.error('Error loading bootstrap:', err));
