export function chooseLocale(language: string): 'zh' | 'en' {
  return language.toLowerCase().startsWith('en') ? 'en' : 'zh'
}
