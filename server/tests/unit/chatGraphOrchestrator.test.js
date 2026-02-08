/**
 * LangGraph编排器单元测试
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import ChatGraphOrchestrator from '../../src/services/chat/ChatGraphOrchestrator.js';
import ConversationState from '../../src/services/chat/state/ConversationState.js';

describe('ChatGraphOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new ChatGraphOrchestrator();
  });

  describe('generateSessionId', () => {
    it('应该生成唯一的会话ID', () => {
      const id1 = orchestrator.generateSessionId();
      const id2 = orchestrator.generateSessionId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^chat_\d+_[a-z0-9]+$/);
    });
  });

  describe('state management', () => {
    it('应该正确初始化状态', () => {
      const state = new ConversationState({
        userId: 'user123',
        userName: '测试用户',
        interlocutor: {
          id: 'interlocutor123',
          relationType: 'stranger'
        }
      });

      expect(state.userId).toBe('user123');
      expect(state.userName).toBe('测试用户');
      expect(state.interlocutor.relationType).toBe('stranger');
      expect(state.messages).toEqual([]);
      expect(state.errors).toEqual([]);
    });

    it('应该正确添加消息', () => {
      const state = new ConversationState();
      state.addMessage('user', '你好');
      state.addMessage('assistant', '你好！');

      expect(state.messages.length).toBe(2);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[0].content).toBe('你好');
      expect(state.messages[1].role).toBe('assistant');
    });

    it('应该正确添加错误', () => {
      const state = new ConversationState();
      const error = new Error('测试错误');
      state.addError(error);

      expect(state.errors.length).toBe(1);
      expect(state.errors[0].message).toBe('测试错误');
    });
  });

  describe('node execution', () => {
    it('应该正确执行input_processor节点', async () => {
      const state = new ConversationState({
        currentInput: '  测试消息  '
      });

      const { inputProcessorNode } = await import('../../src/services/chat/nodes/inputProcessor.js');
      await inputProcessorNode(state);

      expect(state.metadata.inputProcessor).toBeDefined();
      expect(state.metadata.inputProcessor.inputLength).toBe(8);
      expect(state.metadata.inputProcessor.processedInput).toBe('测试消息');
      expect(state.metadata.inputProcessor.inputWords).toBe(1);
    });

    it('应该正确处理空输入', async () => {
      const state = new ConversationState({
        currentInput: ''
      });

      const { inputProcessorNode } = await import('../../src/services/chat/nodes/inputProcessor.js');
      await inputProcessorNode(state);

      expect(state.errors.length).toBeGreaterThan(0);
    });
  });
});
