/**
 * 句子分割工具
 * 将文本按句子分割，保留标点符号
 *
 * @author AFS Team
 * @version 1.0.0
 */

/**
 * 将文本按句子分割（以。！？为分隔符）
 * @param {string} text - 输入文本
 * @returns {string[]} 句子数组（保留标点符号）
 */
export function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') return [];

  // 使用正则分割，保留分隔符
  const sentences = text.split(/([。！？])/).filter(s => s.trim());

  // 组合句子和标点符号
  const combinedSentences = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || '');
    if (sentence.trim()) {
      combinedSentences.push(sentence.trim());
    }
  }

  return combinedSentences;
}

export default splitIntoSentences;
