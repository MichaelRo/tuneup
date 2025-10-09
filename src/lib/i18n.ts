import { showToast } from './ui.js';

export type LocaleId = 'en' | 'he';

export type TranslationKey = keyof (typeof locales)['en'];

export type LocaleStrings = {
  id: LocaleId;
  dir: 'ltr' | 'rtl';
  [key: string]: string;
};

const locales: Record<LocaleId, LocaleStrings> = {
  en: {
    id: 'en',
    dir: 'ltr',
    lang_en: 'English',
    lang_he: 'Hebrew',
    banner:
      'Official statement: We support artists demanding ethical accountability worldwide. TuneUp lets you curate your library—your way.',
    cta_switch_account: 'Switch account',
    cta_disconnect: 'Disconnect',
    cta_connect: 'Connect with Spotify (preview first)',
    cta_connected: 'Connected to Spotify',
    cta_open_app: 'Open App',
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
    metric_steps: 'Steps',
    metric_artists: 'Artists',
    metric_labels: 'Labels',
    how_transparent_t: 'Transparent',
    how_transparent_d: '100% open-source; review the code before you act.',
    how_secure_t: 'Private & Secure',
    how_secure_d: 'OAuth (PKCE), no servers, no data stored.',
    how_control_t: "You're in Control",
    how_control_d: 'Always preview the plan, then apply.',
    stepper_title: 'TuneUp',
    step_source_title: 'Select Source',
    step_resolve_title: 'Match Artists',
    step_preview_title: 'Plan Preview',
    step_apply_title: 'Apply Changes',
    step_report_title: 'Export Report',
    stepper_intro: 'Step-by-step cleanup tool.',
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
    resolve_reload_btn: 'Reload List',
    resolve_retry_btn: 'Retry Scan',
    resolve_matched_artists: 'Matched artists',
    resolve_review_modal_title: 'Review artist matches',
    resolve_ambiguity_modal_title: 'Select the correct artist',
    resolve_ambiguity_skip: 'Skip artist',
    resolve_ambiguity_stop: 'Stop',
    resolve_sort_popularity: 'Popularity',
    resolve_banner_connect: 'Connect with Spotify to run the automatic match scan.',
    resolve_banner_autoscan:
      'We’ll auto-scan for exact matches. Most petitions resolve without manual work.',
    resolve_banner_scanning: 'Scanning your queue for exact matches…',
    resolve_banner_paused:
      'Automatic scan is paused. Use the guided review or quick queue to finish matching.',
    resolve_banner_finished_all: 'Scan finished. All artists matched!',
    resolve_banner_finished_skipped: 'Scan finished. {count} entries were skipped.',
    resolve_banner_finished_note:
      'Automatic scan finished. You can reload the list anytime to refresh matches.',
    resolve_artists_need_review: '{count} artist(s) need review',
    resolve_auto_resolved_artists: 'Auto-resolved {count} {label}',
    resolve_skipped_unmatched: 'Skipped {count} unmatched {label}',
    resolve_artists_label: 'artists',
    resolve_artist_label: 'artist',
    resolve_entries_label: 'entries',
    resolve_entry_label: 'entry',
    resolve_followers: 'followers',
    resolve_no_artists: 'No artists to resolve in the current list.',
    resolve_no_matches: 'No automatic matches found. Use guided review.',
    resolve_requeue_success: 'Added {name} back to pending.',
    resolve_skip_success: '{name} marked as skipped.',
    resolve_unmatch_success: 'Queued {name} for another review.',
    resolve_unmatch_button: 'Unmatch',
    resolve_resolved_success: 'Resolved {input} → {name}.',
    resolve_skipped_ambiguous: '{name} skipped for now.',
    resolve_still_ambiguous: 'Still ambiguous: {name}.',
    resolve_review_cancelled: 'Review cancelled. Artist remains in the queue.',
    resolve_fail: 'Failed to resolve artists.',
    resolve_fail_review: 'Unable to review this artist right now.',
    resolve_fail_skip: 'Unable to skip artist right now.',
    resolve_fail_requeue: 'Unable to requeue artist.',
    resolve_connect_first: 'Connect with Spotify to continue.',
    resolve_artists_first: 'Resolve at least one artist first.',
    resolve_all_resolved: 'All artists are already resolved.',
    resolve_view_list: 'View artist list',
    resolve_sort_recent: 'Recent',
    resolve_following_badge: 'Following',
    preview_intro: 'Review what TuneUp will change before you apply it.',
    preview_option_strict: 'Strict primary artist only',
    preview_option_albums: 'Include saved albums',
    preview_option_labels: 'Include label-based cleanup',
    preview_run_btn: 'Generate preview',
    preview_summary_title: 'Preview summary',
    preview_summary_artists: 'Artists to unfollow',
    preview_summary_tracks: 'Liked tracks to remove',
    preview_summary_albums: 'Saved albums to remove',
    preview_next_btn: 'Next: Apply changes',
    preview_preparing: 'Preparing preview…',
    preview_ready: 'Preview ready.',
    preview_fetch_following: 'Fetching followed artists…',
    preview_scan_tracks: 'Scanning liked tracks…',
    preview_scan_albums: 'Scanning saved albums…',
    preview_enrich_albums: 'Gathering album details…',
    preview_artists_or_disable_labels: 'Resolve artists or disable label cleanup.',
    error_insufficient_scope: 'Reconnect to Spotify so TuneUp can read your library.',
    error_preview_failed: 'Unable to generate preview.',
    resolve_artists_or_disable_labels: 'Resolve artists or disable label cleanup.',
    resolve_no_artists_in_list: 'No artists to resolve in the current list.',
    generate_preview_prompt: 'Generate a plan preview to see what changes will be made.',
    plan_artists_empty: 'No artists will be unfollowed.',
    plan_tracks_empty: 'No liked tracks will be removed.',
    plan_tracks_note:
      'These tracks belong to petitioned artists you follow or match the selected labels.',
    plan_albums_empty: 'No saved albums will be removed.',
    plan_label_reason: 'Label matches: {labels}',
    plan_label_prefix: 'Matches:',
    plan_label_badge: 'Label',
    unknown_artist: 'Unknown Artist',
    unknown_initial: '?',
    toast_language_switch: 'Language switched to {lang}',
    toast_disconnected: 'Disconnected from Spotify.',
    toast_load_list_first: 'Load a list first.',
    toast_no_changes_round: 'No changes this round.',
    toast_review_paused: 'Guided review paused. Remaining artists stay in the queue.',
    metric_skipped: 'Skipped',
    metric_pending: 'Pending',
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
    apply_next_btn: 'Next: Report',
    apply_phase_retries: 'Retries so far: {count}',
    report_intro: 'Export a report before you leave.',
    report_json_btn: 'Download JSON report',
    report_csv_btn: 'Download CSV evidence',
    report_restart_btn: 'Back to start',
    report_source: 'Source',
    report_provider: 'Provider',
    report_version: 'Version',
    report_generated: 'Generated',
    report_no_evidence: 'No evidence recorded',
    app_back: 'Back',
    app_ready: 'Ready',
    app_all_matched: 'All matched',
    app_requeue: 'Requeue',
    app_review: 'Review',
    app_skip: 'Skip',
    app_continue: 'Continue',
    close: 'Close',
    error_generic: 'Something went wrong. Please try again.',
    error_load_list: 'Unable to load list. Check console for details.',
    error_auth_failed: 'Failed to complete Spotify authentication.',
    error_auth_connect: 'Could not complete Spotify connection.',
    error_auth_pkce: 'Invalid PKCE state, please try connecting again.',
    error_apply_failed: 'Apply failed.',
  },
  he: {
    id: 'he',
    dir: 'rtl',
    lang_en: 'English',
    lang_he: 'עברית',
    cta_switch_account: 'החלף חשבון',
    cta_disconnect: 'התנתק',
    banner:
      'הצהרה רשמית: אנו תומכים במוזיקאים שקוראים לאחריות מוסרית. TuneUp נותן לכם לאסוף את הספרייה — בדרך שלכם.',
    cta_connect: 'התחברו ל-Spotify (תמיד תצוגה מוקדמת קודם)',
    cta_connected: 'מחובר ל-Spotify',
    cta_open_app: 'פתיחת האפליקציה',
    cta_github: 'צפו ב-GitHub',
    hero_title: 'TuneUp: רענון ספריית ה-Spotify',
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
    metric_steps: 'שלבים',
    metric_artists: 'אמנים',
    metric_labels: 'לייבלים',
    how_transparent_t: 'שקיפות מלאה',
    how_transparent_d: '100% קוד פתוח; בדקו את הקוד לפני שאתם פועלים.',
    how_secure_t: 'פרטי ומאובטח',
    how_secure_d: 'OAuth (PKCE), ללא שרתים, ללא שמירת נתונים.',
    how_control_t: 'השליטה בידיים שלכם',
    how_control_d: 'תמיד תצוגה מוקדמת לפני היישום.',
    stepper_title: 'TuneUp',
    step_source_title: 'בחרו מקור',
    step_resolve_title: 'התאמת אמנים',
    step_preview_title: 'תצוגת תוכנית',
    step_apply_title: 'החילו שינויים',
    step_report_title: 'ייצוא דוח',
    stepper_intro: 'כלי ניקוי, צעד אחר צעד.',
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
    resolve_reload_btn: 'טען רשימה מחדש',
    resolve_retry_btn: 'סרוק שוב',
    resolve_matched_artists: 'אמנים שהותאמו',
    resolve_review_modal_title: 'סקירת התאמות אמנים',
    resolve_ambiguity_modal_title: 'בחרו את האמן הנכון',
    resolve_ambiguity_skip: 'דלגו על אמן זה',
    resolve_ambiguity_stop: 'עצירה',
    resolve_sort_popularity: 'פופולריות',
    resolve_banner_connect: 'התחברו לספוטיפיי כדי להריץ סריקת התאמה אוטומטית.',
    resolve_banner_autoscan:
      'אנו נסרוק אוטומטית להתאמות מדויקות. רוב העצומות נפתרות ללא עבודה ידנית.',
    resolve_banner_scanning: 'סורקים את התור שלכם להתאמות מדויקות...',
    resolve_banner_paused:
      'הסריקה האוטומטית מושהית. השתמשו בסקירה המודרכת או בתור המהיר לסיום ההתאמה.',
    resolve_banner_finished_all: 'הסריקה הסתיימה. כל האמנים הותאמו!',
    resolve_banner_finished_skipped: 'הסריקה הסתיימה. דילגו על {count} רשומות.',
    resolve_banner_finished_note:
      'הסריקה האוטומטית הסתיימה. ניתן לטעון מחדש את הרשימה בכל עת לרענון ההתאמות.',
    resolve_artists_need_review: '{count} אמנים דורשים בדיקה',
    resolve_auto_resolved_artists: 'הותאמו אוטומטית {count} {label}',
    resolve_skipped_unmatched: 'דילגו על {count} {label} שלא הותאמו',
    resolve_artists_label: 'אמנים',
    resolve_artist_label: 'אמן',
    resolve_entries_label: 'רשומות',
    resolve_entry_label: 'רשומה',
    resolve_followers: 'עוקבים',
    resolve_no_artists: 'אין אמנים להתאים ברשימה הנוכחית.',
    resolve_no_matches: 'לא נמצאו התאמות אוטומטיות. השתמשו בסקירה המודרכת.',
    resolve_requeue_success: 'החזיר את {name} לתור ההמתנה.',
    resolve_skip_success: 'דילג על {name}.',
    resolve_unmatch_success: 'העביר את {name} לבדיקה חוזרת.',
    resolve_unmatch_button: 'בטל התאמה',
    resolve_resolved_success: 'הותאם {input} → {name}.',
    resolve_skipped_ambiguous: 'דילג על {name} בינתיים.',
    resolve_still_ambiguous: 'עדיין לא ברור: {name}.',
    resolve_review_cancelled: 'הסקירה בוטלה. האמן נשאר בתור.',
    resolve_fail: 'נכשל בהתאמת אמנים.',
    resolve_fail_review: 'לא ניתן לסקור אמן זה כעת.',
    resolve_fail_skip: 'לא ניתן לדלג על אמן זה כעת.',
    resolve_fail_requeue: 'לא ניתן להחזיר לתור אמן זה.',
    resolve_connect_first: 'יש להתחבר לספוטיפיי כדי להמשיך.',
    resolve_artists_first: 'יש להתאים לפחות אמן אחד תחילה.',
    resolve_all_resolved: 'כל האמנים כבר הותאמו.',
    resolve_view_list: 'הצג רשימת אמנים',
    resolve_sort_recent: 'אחרונים',
    resolve_following_badge: 'במעקב',
    preview_intro: 'צפו בתוצאות לפני החלת השינויים בפועל.',
    preview_option_strict: 'התאם רק לאמן הראשי',
    preview_option_albums: 'הכלל אלבומים שמורים',
    preview_option_labels: 'הכלל ניקוי מבוסס לייבלים',
    preview_run_btn: 'צור תצוגה מוקדמת',
    preview_summary_title: 'סיכום תצוגה מוקדמת',
    preview_summary_artists: 'אמנים להסרה מהמעקב',
    preview_summary_tracks: 'שירים אהובים להסרה',
    preview_summary_albums: 'אלבומים שמורים להסרה',
    preview_next_btn: 'הבא: החלת שינויים',
    preview_preparing: 'מכין תצוגה מקדימה…',
    preview_ready: 'תצוגה מקדימה מוכנה.',
    preview_fetch_following: 'טוען אמנים במעקב…',
    preview_scan_tracks: 'סורק שירים אהובים…',
    preview_scan_albums: 'סורק אלבומים שמורים…',
    preview_enrich_albums: 'אוסף פרטי אלבומים…',
    preview_artists_or_disable_labels: 'התאם אמנים או השבת ניקוי לפי לייבל.',
    error_insufficient_scope: 'התחבר מחדש לספוטיפיי כדי ש-TuneUp יוכל לקרוא את הספרייה שלך.',
    error_preview_failed: 'לא ניתן ליצור תצוגה מקדימה.',
    resolve_artists_or_disable_labels: 'התאם אמנים או השבת ניקוי לפי לייבל.',
    resolve_no_artists_in_list: 'אין אמנים להתאים ברשימה הנוכחית.',
    plan_artists_empty: 'אין אמנים להסרה מהמעקב.',
    generate_preview_prompt: 'יש ליצור תצוגה מקדימה של התוכנית תחילה.',
    plan_tracks_empty: 'אין שירים אהובים להסרה.',
    plan_tracks_note: 'השירים שייכים לאמנים שאתם כבר עוקבים אחריהם או ללייבלים שנבחרו.',
    plan_albums_empty: 'אין אלבומים שמורים להסרה.',
    plan_label_reason: 'התאמות לייבל: {labels}',
    plan_label_prefix: 'התאמות:',
    plan_label_badge: 'לייבל',
    unknown_artist: 'אמן לא ידוע',
    unknown_initial: '?',
    toast_language_switch: 'השפה שונתה ל-{lang}',
    toast_disconnected: 'התנתקתם מספוטיפיי.',
    toast_load_list_first: 'יש לטעון רשימה תחילה.',
    toast_no_changes_round: 'אין שינויים בסבב זה.',
    toast_review_paused: 'הסקירה המודרכת הושהתה. האמנים הנותרים נשארים בתור.',
    metric_skipped: 'דילוגים',
    metric_pending: 'ממתינים',
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
    apply_next_btn: 'הבא: דוח',
    apply_phase_retries: 'ניסיונות חוזרים: {count}',
    report_intro: 'ייצאו דוח לפני הסיום.',
    report_json_btn: 'הורידו דוח JSON',
    report_csv_btn: 'הורידו סיכום CSV',
    report_restart_btn: 'חזרה להתחלה',
    report_source: 'מקור',
    report_provider: 'ספק',
    report_version: 'גרסה',
    report_generated: 'נוצר ב',
    report_no_evidence: 'לא תועדו ראיות',
    wizard_back: 'חזרה',
    app_ready: 'מוכן',
    app_all_matched: 'הכל הותאם',
    app_requeue: 'החזר לתור',
    app_review: 'בדוק',
    app_skip: 'דלג',
    app_continue: 'המשך',
    close: 'סגירה',
    error_generic: 'משהו השתבש. אנא נסו שוב.',
    error_load_list: 'לא ניתן לטעון את הרשימה. בדקו את הקונסול לפרטים.',
    error_auth_failed: 'האימות עם ספוטיפיי נכשל.',
    error_auth_connect: 'לא ניתן להשלים את החיבור לספוטיפיי.',
    error_auth_pkce: 'מצב PKCE לא תקין, אנא נסו להתחבר שוב.',
    error_apply_failed: 'החלת השינויים נכשלה.',
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

export function initI18n(): Promise<void> {
  return new Promise(resolve => {
    applyDocumentAttrs(currentLang);
    resolve();
  });
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
        showToast(t('toast_language_switch', { lang: t(`lang_${lang}`) }), 'info');
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
