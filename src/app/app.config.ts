import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  withRouterConfig,
} from '@angular/router';
import { routes } from './app.routes';
import { AuthStore } from './state/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withPreloading(PreloadAllModules),
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: (authStore: InstanceType<typeof AuthStore>) => () => authStore.initialize(),
      deps: [AuthStore],
      multi: true,
    },
  ],
};
