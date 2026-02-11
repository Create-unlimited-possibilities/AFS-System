/**
 * 文本压缩 Prompt 模板
 */

export const COMPRESS_PROMPT_TEMPLATE = `你是一个文本压缩及提取专家，能精准的提取问题的核心及回答的要点。请根据以下题目一样来压缩回答的文本。压缩字数在100字以内.仅输出压缩后文本内容。
题目：{question}
题目意义:{significance}
用户回答:{answer}`;

/**
 * 构建压缩 Prompt
 * @param {string} question - 问题文本
 * @param {string} significance - 问题意义
 * @param {string} answer - 用户回答
 * @returns {string} 完整的 Prompt
 */
export function buildCompressPrompt(question, significance, answer) {
  return COMPRESS_PROMPT_TEMPLATE
    .replace('{question}', question)
    .replace('{significance}', significance)
    .replace('{answer}', answer);
}
