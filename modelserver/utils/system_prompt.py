"""
System Prompt 生成器
基于老人的记忆数据动态生成个性化 system prompt
"""
import random
from typing import List, Dict, Any

from config.config_loader import config


class SystemPromptGenerator:
    """System Prompt 生成器"""
    
    def __init__(self):
        """初始化生成器"""
        self.template = config.get_prompt_template()
    
    def generate(self, elder_name: str, memories: List[Dict[str, Any]] = None,
                num_examples: int = 3) -> str:
        """
        生成个性化的 system prompt
        
        :param elder_name: 老人姓名
        :param memories: 老人的记忆数据列表（可选）
        :param num_examples: 在 prompt 中引用的记忆示例数量
        :return: 生成的 system prompt
        """
        # 使用配置模板替换老人姓名
        base_prompt = self.template.replace('{{elder_name}}', elder_name)
        
        # 如果提供了记忆数据，随机选择几条作为示例
        if memories and len(memories) > 0:
            # 随机选择 n 条记忆
            sample_size = min(num_examples, len(memories))
            sampled_memories = random.sample(memories, sample_size)
            
            # 构建记忆示例文本
            memory_examples = "\n\n你记得的一些真实故事包括："
            for i, memory in enumerate(sampled_memories, 1):
                question = memory.get('question', '')
                answer = memory.get('answer', '')
                if question and answer:
                    # 截取答案前100字作为示例
                    answer_preview = answer[:100] + ('...' if len(answer) > 100 else '')
                    memory_examples += f"\n{i}. 当被问到「{question}」时，你会说：「{answer_preview}」"
            
            base_prompt += memory_examples
        
        return base_prompt
    
    def generate_chat_system_prompt(self, elder_name: str, 
                                   conversation_context: List[Dict[str, str]] = None) -> str:
        """
        为实时聊天生成 system prompt（可包含对话上下文）
        
        :param elder_name: 老人姓名
        :param conversation_context: 最近的对话历史（可选）
        :return: 生成的 system prompt
        """
        base_prompt = self.template.replace('{{elder_name}}', elder_name)
        
        # 添加对话上下文提示
        if conversation_context and len(conversation_context) > 0:
            context_text = "\n\n你们刚才聊到了："
            for msg in conversation_context[-3:]:  # 只保留最近3轮对话
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                if role == 'user':
                    context_text += f"\n家人问：{content}"
                elif role == 'assistant':
                    context_text += f"\n你回答：{content}"
            
            base_prompt += context_text
        
        return base_prompt
    
    def generate_modelfile_system(self, elder_name: str) -> str:
        """
        生成 Ollama Modelfile 格式的 SYSTEM 指令
        
        :param elder_name: 老人姓名
        :return: Modelfile SYSTEM 指令文本
        """
        prompt = self.template.replace('{{elder_name}}', elder_name)
        # 转义引号
        prompt = prompt.replace('"', '\\"')
        return f'SYSTEM """{prompt}"""'
    
    def customize_prompt(self, elder_name: str, custom_traits: Dict[str, Any]) -> str:
        """
        根据老人的特定特征定制 system prompt
        
        :param elder_name: 老人姓名
        :param custom_traits: 自定义特征字典，如 {"personality": "幽默", "hobby": "下棋"}
        :return: 定制化的 system prompt
        """
        base_prompt = self.template.replace('{{elder_name}}', elder_name)
        
        # 添加个性化特征
        if custom_traits:
            trait_text = "\n\n你的特点："
            
            if 'personality' in custom_traits:
                trait_text += f"\n- 性格：{custom_traits['personality']}"
            
            if 'hobby' in custom_traits:
                trait_text += f"\n- 爱好：{custom_traits['hobby']}"
            
            if 'catchphrase' in custom_traits:
                trait_text += f"\n- 常说的话：「{custom_traits['catchphrase']}」"
            
            if 'life_motto' in custom_traits:
                trait_text += f"\n- 人生格言：「{custom_traits['life_motto']}」"
            
            base_prompt += trait_text
        
        return base_prompt


if __name__ == '__main__':
    # 测试 system prompt 生成
    generator = SystemPromptGenerator()
    
    # 测试基础生成
    basic_prompt = generator.generate("李小明")
    print("=== 基础 System Prompt ===")
    print(basic_prompt)
    print()
    
    # 测试带记忆示例的生成
    sample_memories = [
        {"question": "你的童年在哪里度过？", "answer": "我在江南水乡长大，小时候经常在河边玩耍..."},
        {"question": "你最难忘的家庭聚会？", "answer": "1985年春节全家团聚，那时候孩子们还小..."},
        {"question": "你对年轻人有什么建议？", "answer": "要脚踏实地，不要急功近利..."}
    ]
    
    memory_prompt = generator.generate("李小明", sample_memories, num_examples=2)
    print("=== 带记忆示例的 System Prompt ===")
    print(memory_prompt)
    print()
    
    # 测试定制化生成
    custom_prompt = generator.customize_prompt("李小明", {
        "personality": "幽默风趣",
        "hobby": "下象棋、写书法",
        "catchphrase": "慢慢来，不着急"
    })
    print("=== 定制化 System Prompt ===")
    print(custom_prompt)
