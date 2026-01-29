"""
训练进度跟踪器
实时监控训练日志，计算进度并准备推送数据
"""
import threading
import time
from typing import Dict, Any, Optional, Callable
from datetime import datetime
from pathlib import Path

from utils.logger import logger


class ProgressTracker:
    """训练进度跟踪器"""
    
    def __init__(self):
        """初始化跟踪器"""
        self.training_jobs: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
    
    def start_tracking(self, elder_id: str, total_epochs: int = 3) -> str:
        """
        开始跟踪训练任务
        
        :param elder_id: 老人 ID
        :param total_epochs: 总训练轮数
        :return: 任务 ID
        """
        job_id = f"{elder_id}_{int(time.time())}"
        
        with self.lock:
            self.training_jobs[job_id] = {
                'elder_id': elder_id,
                'job_id': job_id,
                'status': 'preparing',  # preparing, training, completed, failed
                'progress': 0,
                'current_epoch': 0,
                'total_epochs': total_epochs,
                'current_step': 0,
                'total_steps': 0,
                'start_time': datetime.now().isoformat(),
                'end_time': None,
                'eta': None,
                'error': None,
                'logs': []
            }
        
        logger.info(f"开始跟踪训练任务: {job_id}")
        return job_id
    
    def update_progress(self, job_id: str, **kwargs):
        """
        更新训练进度
        
        :param job_id: 任务 ID
        :param kwargs: 更新的字段
        """
        with self.lock:
            if job_id not in self.training_jobs:
                logger.warning(f"任务不存在: {job_id}")
                return
            
            job = self.training_jobs[job_id]
            
            # 更新字段
            for key, value in kwargs.items():
                if key in job:
                    job[key] = value
            
            # 计算进度百分比
            if 'current_epoch' in kwargs or 'total_epochs' in kwargs:
                total = job['total_epochs']
                current = job['current_epoch']
                if total > 0:
                    job['progress'] = int((current / total) * 100)
            
            # 计算 ETA
            if job['status'] == 'training' and job['progress'] > 0:
                elapsed = (datetime.now() - datetime.fromisoformat(job['start_time'])).total_seconds()
                remaining = (elapsed / job['progress']) * (100 - job['progress'])
                job['eta'] = self._format_duration(remaining)
    
    def add_log(self, job_id: str, log_message: str):
        """
        添加日志消息
        
        :param job_id: 任务 ID
        :param log_message: 日志消息
        """
        with self.lock:
            if job_id in self.training_jobs:
                self.training_jobs[job_id]['logs'].append({
                    'timestamp': datetime.now().isoformat(),
                    'message': log_message
                })
                
                # 只保留最近 50 条日志
                if len(self.training_jobs[job_id]['logs']) > 50:
                    self.training_jobs[job_id]['logs'] = self.training_jobs[job_id]['logs'][-50:]
    
    def complete_tracking(self, job_id: str, success: bool = True, error: str = None):
        """
        完成训练跟踪
        
        :param job_id: 任务 ID
        :param success: 是否成功
        :param error: 错误信息（如果失败）
        """
        with self.lock:
            if job_id not in self.training_jobs:
                return
            
            job = self.training_jobs[job_id]
            job['end_time'] = datetime.now().isoformat()
            job['status'] = 'completed' if success else 'failed'
            job['progress'] = 100 if success else job['progress']
            job['error'] = error
            
            if success:
                logger.info(f"训练任务完成: {job_id}")
            else:
                logger.error(f"训练任务失败: {job_id}, 错误: {error}")
    
    def get_progress(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        获取训练进度
        
        :param job_id: 任务 ID
        :return: 进度信息
        """
        with self.lock:
            if job_id in self.training_jobs:
                return self.training_jobs[job_id].copy()
        return None
    
    def get_elder_latest_job(self, elder_id: str) -> Optional[Dict[str, Any]]:
        """
        获取老人的最新训练任务
        
        :param elder_id: 老人 ID
        :return: 最新任务信息
        """
        with self.lock:
            elder_jobs = [
                job for job in self.training_jobs.values()
                if job['elder_id'] == elder_id
            ]
            
            if elder_jobs:
                # 按开始时间排序，返回最新的
                elder_jobs.sort(key=lambda x: x['start_time'], reverse=True)
                return elder_jobs[0].copy()
        
        return None
    
    def list_active_jobs(self) -> list:
        """
        列出所有活跃的训练任务
        
        :return: 活跃任务列表
        """
        with self.lock:
            return [
                job.copy() for job in self.training_jobs.values()
                if job['status'] in ['preparing', 'training']
            ]
    
    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """
        清理旧的训练任务记录
        
        :param max_age_hours: 最大保留时间（小时）
        """
        cutoff_time = time.time() - (max_age_hours * 3600)
        
        with self.lock:
            jobs_to_remove = []
            
            for job_id, job in self.training_jobs.items():
                start_time = datetime.fromisoformat(job['start_time']).timestamp()
                if start_time < cutoff_time and job['status'] in ['completed', 'failed']:
                    jobs_to_remove.append(job_id)
            
            for job_id in jobs_to_remove:
                del self.training_jobs[job_id]
            
            if jobs_to_remove:
                logger.info(f"清理了 {len(jobs_to_remove)} 个旧训练任务记录")
    
    def monitor_log_file(self, job_id: str, log_file_path: str, 
                        callback: Optional[Callable] = None):
        """
        监控日志文件并更新进度
        
        :param job_id: 任务 ID
        :param log_file_path: 日志文件路径
        :param callback: 进度更新回调函数
        """
        def _monitor():
            log_path = Path(log_file_path)
            
            if not log_path.exists():
                logger.warning(f"日志文件不存在: {log_file_path}")
                return
            
            with open(log_path, 'r', encoding='utf-8') as f:
                # 移到文件末尾
                f.seek(0, 2)
                
                while True:
                    line = f.readline()
                    
                    if not line:
                        # 检查任务是否还在运行
                        job = self.get_progress(job_id)
                        if not job or job['status'] not in ['preparing', 'training']:
                            break
                        time.sleep(0.5)
                        continue
                    
                    # 解析日志行并更新进度
                    self._parse_log_line(job_id, line.strip())
                    
                    if callback:
                        callback(self.get_progress(job_id))
        
        # 在新线程中运行监控
        monitor_thread = threading.Thread(target=_monitor, daemon=True)
        monitor_thread.start()
    
    def _parse_log_line(self, job_id: str, line: str):
        """
        解析日志行并提取进度信息
        
        :param job_id: 任务 ID
        :param line: 日志行
        """
        # 添加日志
        self.add_log(job_id, line)
        
        # 解析 epoch 信息（示例格式: "Epoch 2/3"）
        if 'epoch' in line.lower():
            parts = line.lower().split('epoch')
            if len(parts) > 1:
                try:
                    epoch_info = parts[1].strip().split('/')[0].strip()
                    current_epoch = int(epoch_info)
                    self.update_progress(job_id, current_epoch=current_epoch)
                except:
                    pass
        
        # 解析步骤信息（示例格式: "Step 100/1000"）
        if 'step' in line.lower():
            parts = line.lower().split('step')
            if len(parts) > 1:
                try:
                    step_parts = parts[1].strip().split('/')
                    current_step = int(step_parts[0].strip())
                    if len(step_parts) > 1:
                        total_steps = int(step_parts[1].strip())
                        self.update_progress(job_id, current_step=current_step, total_steps=total_steps)
                except:
                    pass
    
    @staticmethod
    def _format_duration(seconds: float) -> str:
        """
        格式化时间长度
        
        :param seconds: 秒数
        :return: 格式化的字符串
        """
        if seconds < 60:
            return f"{int(seconds)}秒"
        elif seconds < 3600:
            return f"{int(seconds / 60)}分钟"
        else:
            hours = int(seconds / 3600)
            minutes = int((seconds % 3600) / 60)
            return f"{hours}小时{minutes}分钟"


# 全局进度跟踪器实例
progress_tracker = ProgressTracker()


if __name__ == '__main__':
    # 测试进度跟踪器
    tracker = ProgressTracker()
    
    # 创建测试任务
    job_id = tracker.start_tracking('LXM19580312M', total_epochs=5)
    print(f"创建任务: {job_id}")
    
    # 模拟训练进度更新
    for epoch in range(1, 6):
        time.sleep(1)
        tracker.update_progress(job_id, status='training', current_epoch=epoch)
        tracker.add_log(job_id, f"正在训练 Epoch {epoch}/5")
        
        progress = tracker.get_progress(job_id)
        print(f"进度: {progress['progress']}%, ETA: {progress.get('eta', 'N/A')}")
    
    # 完成任务
    tracker.complete_tracking(job_id, success=True)
    final_progress = tracker.get_progress(job_id)
    print(f"任务完成: {final_progress['status']}")
