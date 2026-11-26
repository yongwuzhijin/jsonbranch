export type WorkbenchLocale = 'zh' | 'en'

const zh = {
  format: '格式化',
  expandAll: '全部展开',
  collapseAll: '全部折叠',
  lineNumbers: '行号',
  keepEscapes: '保留转义',
  clear: '清空',
  copy: '复制',
  copyPath: '复制路径',
  copyPair: '复制键值对',
  copyValue: '复制值',
  delete: '删除',
  undo: '撤销',
  search: '搜索键和值',
  empty: '没有内容',
  copyFailed: '复制失败',
  previous: '上一处',
  next: '下一处',
  resize: '调整分栏',
  matchSuffix: '处',
  expandNode: '展开节点',
  collapseNode: '折叠节点',
  decreaseFont: (current: number) => `减小字号，当前 ${current}`,
  increaseFont: (current: number) => `增大字号，当前 ${current}`,
  fontSaveFailed: '字号未能记在本机'
}

const en: typeof zh = {
  format: 'Format',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  lineNumbers: 'Line numbers',
  keepEscapes: 'Keep escapes',
  clear: 'Clear',
  copy: 'Copy',
  copyPath: 'Copy path',
  copyPair: 'Copy pair',
  copyValue: 'Copy value',
  delete: 'Delete',
  undo: 'Undo',
  search: 'Search keys and values',
  empty: 'Nothing to show',
  copyFailed: 'Copy failed',
  previous: 'Previous match',
  next: 'Next match',
  resize: 'Resize panes',
  matchSuffix: 'matches',
  expandNode: 'Expand node',
  collapseNode: 'Collapse node',
  decreaseFont: (current: number) => `Decrease font size, current ${current}`,
  increaseFont: (current: number) => `Increase font size, current ${current}`,
  fontSaveFailed: 'Font size was not saved on this device.'
}

export function messages(locale: WorkbenchLocale): typeof zh {
  return locale === 'en' ? en : zh
}
