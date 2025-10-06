import { showToast } from './ui.js';

export type LocaleId = 'en' | 'he';

export type LocaleStrings = {
  id: LocaleId;
  dir: 'ltr' | 'rtl';
  [key: string]: string;
};

const locales: Record<LocaleId, LocaleStrings> = {
  en: {
    id: 'en',
    dir: 'ltr',
    banner:
      'Official statement: We support artists demanding ethical accountability worldwide. TuneUp lets you curate your library—your way.',
    cta_connect: 'Connect with Spotify (preview first)',
    cta_connected: 'Connected to Spotify',
    cta_open_wizard: 'Open wizard',
    cta_github: 'View on GitHub',
    hero_title: 'TuneUp: Refresh your Spotify library',
    hero_sub:
      'A user-controlled response to the public “No Music For Genocide” petition. Clean follows, liked songs, and saved albums — always with a plan preview first. Open-source, free, and safe (runs in your browser).',
    does_title: 'What it does',
    does_list:
      'Unfollow selected artists • Remove liked tracks • Remove saved albums • Match modes: Any artist / Strict primary • Label-aware cleanup (albums & tracks by album label).',
    list_title: 'List sources',
    list_body:
      'Default: public “No Music For Genocide” list (versioned). Or: paste, upload, or link your own. Resolve ambiguous names before applying. Forward-compatible with additional lists.',
    faq_title: 'FAQ',
    faq_why:
      'Why this exists? To let listeners align collections with their values in response to public petitions—safely and transparently.',
    faq_undo: 'Undo? Spotify has no bulk-undo API; we export a full report before changes.',
    faq_affil: 'Affiliation? Not affiliated with Spotify; uses the official Web API.',
    footer_legal_1: 'TuneUp is not affiliated with or endorsed by Spotify.',
    footer_legal_2: 'Provided “as is” under the MIT License, with no warranties.',
    footer_legal_3: 'Artist list source: No Music For Genocide (public petition).',
    pill_transparent: 'Transparent',
    pill_secure: 'Private & Secure',
    pill_control: "You're in Control",
    how_transparent_t: 'Transparent',
    how_transparent_d: '100% open-source; review the code before you act.',
    how_secure_t: 'Private & Secure',
    how_secure_d: 'OAuth (PKCE), no servers, no data stored.',
    how_control_t: "You're in Control",
    how_control_d: 'Always preview the plan, then apply.',
    wizard_title: 'TuneUp',
    step_source_title: 'Select Source',
    step_resolve_title: 'Match Artists',
    step_dryrun_title: 'Plan Preview',
    step_apply_title: 'Apply Changes',
    step_report_title: 'Export Report',
    wizard_intro: 'Step-by-step cleanup wizard.',
    source_intro: 'Choose a list to target artists and labels.',
    source_default_label: 'No Music For Genocide (default)',
    source_paste_label: 'Paste list',
    source_file_label: 'Upload file',
    source_url_label: 'Load from URL',
    source_load_btn: 'Load list',
    source_loading: 'Loading…',
    source_loaded_counts: 'Loaded {artists} artists · {labels} labels',
    source_counts_label: 'Artists: {artists} • Labels: {labels}',
    source_version_label: 'Version: {version}',
    source_next_btn: 'Next: Resolve',
    resolve_intro: 'TuneUp matches petition entries to Spotify artists for you.',
    resolve_start_btn: 'Match automatically',
    resolve_review_btn: 'Review remaining matches',
    resolve_resolved_count: 'Resolved {resolved} of {total}',
    resolve_unresolved_notice: 'Some entries still need attention.',
    resolve_next_disabled: 'Review matches or generate a plan preview first.',
    resolve_next_btn: 'Next: Plan Preview',
    resolve_back_btn: 'Back to sources',
    resolve_following_badge: 'Following you',
    dryrun_intro: 'Review what TuneUp will change before you apply it.',
    dryrun_option_any: 'Any-match mode (default)',
    dryrun_option_strict: 'Strict primary artist only',
    dryrun_option_albums: 'Include saved albums',
    dryrun_option_labels: 'Include label-based cleanup',
    dryrun_run_btn: 'Generate preview',
    dryrun_summary_title: 'Preview summary',
    dryrun_summary_artists: 'Artists to unfollow',
    dryrun_summary_tracks: 'Liked tracks to remove',
    dryrun_summary_albums: 'Saved albums to remove',
    dryrun_next_btn: 'Next: Apply changes',
    generate_preview_prompt: 'Generate a plan preview to see what changes will be made.',
    plan_artists_empty: 'No artists will be unfollowed.',
    plan_tracks_empty: 'No liked tracks will be removed.',
    plan_tracks_note:
      'These tracks belong to petitioned artists you follow or match the selected labels.',
    plan_albums_empty: 'No saved albums will be removed.',
    plan_label_reason: 'Label matches: {labels}',
    plan_label_prefix: 'Matches:',
    plan_label_badge: 'Label',
    apply_intro: 'Apply the plan in three phases.',
    apply_start_btn: 'Apply changes',
    apply_status_wait: 'Rate limit hit. Retrying in {seconds}s…',
    apply_done: 'All steps completed.',
    apply_phase_unfollow: 'Unfollowing artists',
    apply_phase_tracks: 'Removing liked tracks',
    apply_phase_albums: 'Removing saved albums',
    apply_overall_progress: 'Overall progress',
    apply_overall_counts: 'Processed {done} of {total} items',
    apply_phase_status_pending: 'Queued',
    apply_phase_status_active: 'In progress',
    apply_phase_status_complete: 'Done',
    apply_phase_status_skipped: 'Skipped',
    apply_phase_status_stalled: 'Needs attention',
    apply_phase_counts: 'Processed {done} of {total}',
    apply_phase_empty: 'Nothing queued for this step.',
    apply_phase_retries: 'Retries so far: {count}',
    report_intro: 'Export a report before you leave.',
    report_json_btn: 'Download JSON report',
    report_csv_btn: 'Download CSV summary',
    report_restart_btn: 'Back to start',
    wizard_back: 'Back',
    wizard_continue: 'Continue',
  },
  he: {
    id: 'he',
    dir: 'rtl',
    banner:
      'הצהרה רשמית: אנו תומכים במוזיקאים שקוראים לאחריות מוסרית. TuneUp נותן לכם לאסוף את הספרייה — בדרך שלכם.',
    cta_connect: 'התחברו ל-Spotify (תמיד תצוגה מוקדמת קודם)',
    cta_connected: 'מחובר ל-Spotify',
    cta_open_wizard: 'פתיחת האשף',
    cta_github: 'צפו ב-GitHub',
    hero_title: 'TuneUp: רעננו את ספריית ה-Spotify שלכם',
    hero_sub:
      'תגובה בשליטת המשתמש לעצומת “No Music For Genocide”. ניקוי מעקבים, שירים אהובים ואלבומים שמורים — תמיד עם תצוגה מוקדמת לפני ההחלה. קוד פתוח, חופשי, ופועל בדפדפן.',
    does_title: 'מה הכלי עושה',
    does_list:
      'הסרת מעקב אחרי אמנים נבחרים • מחיקת שירים שאהבתם • מחיקת אלבומים שמורים • מצבי התאמה: כל אמן / ראשי בלבד • ניקוי מבוסס לייבלים (אלבומים ושירים לפי לייבל האלבום).',
    list_title: 'מקורות רשימות',
    list_body:
      'ברירת מחדל: רשימת No Music For Genocide הציבורית (עם גרסה). אפשר גם להדביק/להעלות/לקשר רשימה משלך. יש חלון בחירה לשמות עמומים לפני פעולה. מוכן מראש לרשימות נוספות.',
    faq_title: 'שאלות נפוצות',
    faq_why:
      'למה הכלי קיים? כדי לאפשר למאזינים ליישר קו עם הערכים שלהם כתגובה לעצומות ציבוריות — בבטיחות ושקיפות.',
    faq_undo: 'Undo? אין API להחזרה גורפת; מייצאים דוח מלא לפני פעולה.',
    faq_affil: 'שייכות? אין קשר ל-Spotify; שימוש ב-Web API הרשמי בלבד.',
    footer_legal_1: 'אין קשר או תמיכה רשמית מצד Spotify.',
    footer_legal_2: 'מוענק כפי שהוא (“As-Is”) תחת רישיון MIT, ללא אחריות.',
    footer_legal_3: 'מקור הרשימה: No Music For Genocide (עצומה ציבורית).',
    pill_transparent: 'שקיפות מלאה',
    pill_secure: 'פרטי ומאובטח',
    pill_control: 'השליטה בידיים שלכם',
    how_transparent_t: 'שקיפות מלאה',
    how_transparent_d: '100% קוד פתוח; בדקו את הקוד לפני שאתם פועלים.',
    how_secure_t: 'פרטי ומאובטח',
    how_secure_d: 'OAuth (PKCE), ללא שרתים, ללא שמירת נתונים.',
    how_control_t: 'השליטה בידיים שלכם',
    how_control_d: 'תמיד תצוגה מוקדמת לפני היישום.',
    wizard_title: 'TuneUp',
    step_source_title: 'בחרו מקור',
    step_resolve_title: 'התאמת אמנים',
    step_dryrun_title: 'תצוגת תוכנית',
    step_apply_title: 'החילו שינויים',
    step_report_title: 'ייצוא דוח',
    wizard_intro: 'אשף ניקוי צעד-אחר-צעד.',
    source_intro: 'בחרו רשימה כדי למקד אמנים ולייבלים.',
    source_default_label: 'No Music For Genocide (ברירת מחדל)',
    source_paste_label: 'הדביקו רשימה',
    source_file_label: 'העלו קובץ',
    source_url_label: 'טענו מ-URL',
    source_load_btn: 'טען רשימה',
    source_loading: 'טוען…',
    source_loaded_counts: 'נטענו {artists} אמנים · {labels} לייבלים',
    source_counts_label: 'אמנים: {artists} • לייבלים: {labels}',
    source_version_label: 'גרסה: {version}',
    source_next_btn: 'הבא: התאמת אמנים',
    resolve_intro: 'TuneUp מתאימה את רשימת העצומה לאמני Spotify בשבילכם.',
    resolve_start_btn: 'התאמה אוטומטית',
    resolve_review_btn: 'בדקו התאמות שנותרו',
    resolve_resolved_count: 'נפתרו {resolved} מתוך {total}',
    resolve_unresolved_notice: 'נותרו רשומות שדורשות בחירה ידנית.',
    resolve_next_disabled: 'השלימו התאמות או צרו תצוגה מוקדמת תחילה.',
    resolve_next_btn: 'הבא: תצוגת תוכנית',
    resolve_back_btn: 'חזרה למקורות',
    resolve_following_badge: 'במעקב שלך',
    dryrun_intro: 'צפו בתוצאות לפני החלת השינויים בפועל.',
    dryrun_option_any: 'מצב התאמה חופשי (ברירת מחדל)',
    dryrun_option_strict: 'התאם רק לאמן הראשי',
    dryrun_option_albums: 'הכלל אלבומים שמורים',
    dryrun_option_labels: 'הכלל ניקוי מבוסס לייבלים',
    dryrun_run_btn: 'צור תצוגה מוקדמת',
    dryrun_summary_title: 'סיכום תצוגה מוקדמת',
    dryrun_summary_artists: 'אמנים להסרה מהמעקב',
    dryrun_summary_tracks: 'שירים אהובים להסרה',
    dryrun_summary_albums: 'אלבומים שמורים להסרה',
    dryrun_next_btn: 'הבא: החלת שינויים',
    plan_artists_empty: 'אין אמנים להסרה מהמעקב.',
    plan_tracks_empty: 'אין שירים אהובים להסרה.',
    plan_tracks_note: 'השירים שייכים לאמנים שאתם כבר עוקבים אחריהם או ללייבלים שנבחרו.',
    plan_albums_empty: 'אין אלבומים שמורים להסרה.',
    plan_label_reason: 'התאמות לייבל: {labels}',
    plan_label_prefix: 'התאמות:',
    plan_label_badge: 'לייבל',
    apply_intro: 'החילו את התכנית בשלושה שלבים.',
    apply_start_btn: 'החילו שינויים',
    apply_status_wait: 'הוגבלה התדירות. ניסיון חוזר בעוד {seconds} שניות…',
    apply_done: 'כל השלבים הושלמו.',
    apply_phase_unfollow: 'הסרת מעקב אחר אמנים',
    apply_phase_tracks: 'הסרת שירים אהובים',
    apply_phase_albums: 'הסרת אלבומים שמורים',
    apply_overall_progress: 'התקדמות כוללת',
    apply_overall_counts: 'טופלו {done} מתוך {total} פריטים',
    apply_phase_status_pending: 'בתור',
    apply_phase_status_active: 'מתבצע',
    apply_phase_status_complete: 'הושלם',
    apply_phase_status_skipped: 'לא נדרש',
    apply_phase_status_stalled: 'דורש בדיקה',
    apply_phase_counts: 'טופלו {done} מתוך {total}',
    apply_phase_empty: 'אין פריטים בשלב הזה.',
    apply_phase_retries: 'ניסיונות חוזרים: {count}',
    report_intro: 'ייצאו דוח לפני הסיום.',
    report_json_btn: 'הורידו דוח JSON',
    report_csv_btn: 'הורידו סיכום CSV',
    report_restart_btn: 'חזרה להתחלה',
    wizard_back: 'חזרה',
    wizard_continue: 'המשך',
  },
};

const LANG_PARAM = 'lang';
const STORAGE_KEY = 'tuneup_lang';
const listeners = new Set<(lang: LocaleId) => void>();

let currentLang = detectInitialLang();

function detectInitialLang(): LocaleId {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get(LANG_PARAM) as LocaleId | null;
  if (fromQuery && locales[fromQuery]) {
    return fromQuery;
  }
  const stored = localStorage.getItem(STORAGE_KEY) as LocaleId | null;
  if (stored && locales[stored]) {
    return stored;
  }
  const [primary] = (navigator.language || 'en').split('-');
  return (locales[primary as LocaleId] ? primary : 'en') as LocaleId;
}

function persistLang(lang: LocaleId): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (err) {
    console.warn('Unable to persist language', err);
  }
}

function applyDocumentAttrs(lang: LocaleId): void {
  const locale = locales[lang];
  document.documentElement.setAttribute('dir', locale.dir);
  document.documentElement.setAttribute('lang', locale.id);
}

export function initI18n(): void {
  applyDocumentAttrs(currentLang);
}

export function setLang(lang: LocaleId, options: { updateUrl?: boolean } = {}): void {
  if (!locales[lang]) return;
  if (lang === currentLang) return;
  currentLang = lang;
  persistLang(lang);
  applyDocumentAttrs(lang);

  if (options.updateUrl !== false) {
    const url = new URL(location.href);
    if (lang === 'en') {
      url.searchParams.delete(LANG_PARAM);
    } else {
      url.searchParams.set(LANG_PARAM, lang);
    }
    history.replaceState({}, '', url.toString());
  }

  listeners.forEach(cb => cb(currentLang));
}

export function getLang(): LocaleId {
  return currentLang;
}

export function getStrings(): LocaleStrings {
  return locales[currentLang];
}

export function onLangChange(cb: (lang: LocaleId) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function t(key: string, params?: Record<string, string | number>): string {
  const strings = getStrings();
  let value = strings[key] ?? key;
  if (params && typeof value === 'string') {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      value = value.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
    });
  }
  return value;
}

export function bindLanguageToggles(container: Element): void {
  const links = container.querySelectorAll('[data-lang]');
  links.forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const lang = (link as HTMLAnchorElement).dataset.lang as LocaleId | undefined;
      if (lang) {
        setLang(lang);
        showToast(`Language switched to ${lang === 'en' ? 'English' : 'עברית'}`, 'info');
      }
    });
  });
}

export function formatNumber(value: number): string {
  try {
    const locale = currentLang === 'he' ? 'he-IL' : 'en-US';
    return new Intl.NumberFormat(locale).format(value);
  } catch (err) {
    console.warn('Intl formatting failed', err);
    return String(value);
  }
}
