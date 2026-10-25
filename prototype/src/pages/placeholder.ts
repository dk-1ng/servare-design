import { initI18n, languageTag, t } from '../i18n/index.ts';

await initI18n();
const locale = document.querySelector('[data-role="locale"]');
if (locale) locale.textContent = t('placeholder_locale', languageTag());
document.documentElement.dataset['ready'] = 'true';
