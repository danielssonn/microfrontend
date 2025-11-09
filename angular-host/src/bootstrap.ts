import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

console.log('[Bootstrap] Starting Angular application...');

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .then(() => {
    console.log('[Bootstrap] Angular application bootstrapped successfully!');
  })
  .catch((err) => {
    console.error('[Bootstrap] Bootstrap error:', err);
    console.error('[Bootstrap] Error stack:', err.stack);
  });
