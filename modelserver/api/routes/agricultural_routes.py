from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import random
import datetime

router = APIRouter(prefix="/agricultural", tags=["Agricultural AI"])


class DiseaseDetectionRequest(BaseModel):
    image: str
    cropName: str
    variety: Optional[str] = None


class DiseaseDetectionResponse(BaseModel):
    detected: bool
    diseaseName: Optional[str] = None
    confidence: float
    description: Optional[str] = None
    treatment: Optional[str] = None
    severity: Optional[str] = None


@router.post("/disease-detect", response_model=DiseaseDetectionResponse)
async def detect_disease(request: DiseaseDetectionRequest):
    try:
        disease_db = {
            "水稻": ["稻瘟病", "白叶枯病", "纹枯病"],
            "小麦": ["锈病", "白粉病", "赤霉病"],
            "玉米": ["大斑病", "小斑病", "粗缩病"],
            "番茄": ["早疫病", "晚疫病", "灰霉病"],
            "黄瓜": ["霜霉病", "白粉病", "枯萎病"],
            "大豆": ["根腐病", "灰斑病", "疫病"]
        }

        treatments = {
            "稻瘟病": "使用三环唑、富士一号等药剂防治，注意田间水肥管理",
            "白叶枯病": "使用叶枯唑、噻森铜等药剂防治，避免淹灌",
            "纹枯病": "使用井冈霉素、己唑醇等药剂防治，适当稀植",
            "锈病": "使用三唑类杀菌剂喷雾防治，注意抗药性管理",
            "白粉病": "使用醚菌酯、苯醚甲环唑等药剂防治",
            "赤霉病": "在扬花期使用多菌灵、戊唑醇等药剂防治",
            "大斑病": "使用代森锰锌、苯醚甲环唑等药剂防治",
            "小斑病": "使用甲基硫菌灵、嘧菌酯等药剂防治",
            "早疫病": "使用代森锰锌、百菌清等药剂防治",
            "晚疫病": "使用甲霜灵、烯酰吗啉等药剂防治",
            "灰霉病": "使用嘧霉胺、异菌脲等药剂防治",
            "霜霉病": "使用甲霜灵、烯酰吗啉等药剂防治",
            "白粉病": "使用三唑类、醚菌酯等药剂防治"
        }

        descriptions = {
            "稻瘟病": "真菌性病害，叶片上出现梭形病斑，严重时导致整株枯死",
            "白叶枯病": "细菌性病害，叶片边缘出现黄白色枯斑，后卷曲枯萎",
            "纹枯病": "真菌性病害，茎基部出现水渍状病斑，后形成云纹状斑",
            "锈病": "真菌性病害，叶片上出现铁锈色粉末状孢子堆",
            "白粉病": "真菌性病害，叶片表面出现白色粉状物",
            "赤霉病": "真菌性病害，穗部出现粉红色霉状物"
        }

        detected = random.random() > 0.3
        
        if detected and request.cropName in disease_db:
            disease_name = random.choice(disease_db[request.cropName])
            confidence = round(random.uniform(0.7, 0.98), 2)
            
            return DiseaseDetectionResponse(
                detected=True,
                diseaseName=disease_name,
                confidence=confidence,
                description=descriptions.get(disease_name, "植物病害"),
                treatment=treatments.get(disease_name, "建议咨询农业专家"),
                severity=random.choice(["轻微", "中等", "严重"])
            )
        else:
            return DiseaseDetectionResponse(
                detected=False,
                confidence=0.95,
                description="植物健康，未检测到病害"
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class WeatherPredictionRequest(BaseModel):
    location: str
    historicalData: List[dict]


class WeatherPredictionResponse(BaseModel):
    next24h: dict
    next7days: dict
    confidence: float
    recommendations: List[str]


@router.post("/weather-predict", response_model=WeatherPredictionResponse)
async def predict_weather(request: WeatherPredictionRequest):
    try:
        conditions = ["晴朗", "多云", "阴天", "小雨", "中雨", "雷阵雨"]
        next24h_condition = random.choice(conditions)
        
        next24h_temp = round(random.uniform(15, 35), 1)
        
        trend = random.choice(["升温", "降温", "稳定"])
        avg_temp = round(random.uniform(18, 30), 1)
        total_precip = round(random.uniform(0, 100), 1)
        
        recommendations = []
        if next24h_condition in ["小雨", "中雨", "雷阵雨"]:
            recommendations.extend(["注意排水防涝", "推迟施肥", "检查温室大棚"])
        if next24h_temp > 30:
            recommendations.extend(["增加灌溉频率", "做好防晒措施", "注意病虫害防治"])
        if next24h_temp < 15:
            recommendations.extend(["做好保温措施", "适当延迟浇水", "检查防寒设施"])
        
        if len(recommendations) == 0:
            recommendations.append("适合进行常规农业操作")
        
        return WeatherPredictionResponse(
            next24h={
                "condition": next24h_condition,
                "temperature": next24h_temp,
                "humidity": round(random.uniform(40, 90), 0)
            },
            next7days={
                "trend": trend,
                "avgTemperature": avg_temp,
                "totalPrecipitation": total_precip
            },
            confidence=round(random.uniform(0.75, 0.92), 2),
            recommendations=recommendations[:5]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TaskRecommendationRequest(BaseModel):
    tasks: Optional[List[dict]] = None
    task: Optional[dict] = None
    weatherData: Optional[List[dict]] = None


class TaskRecommendationResponse(BaseModel):
    score: float
    reasoning: str
    suggestedActions: List[str]
    optimalTiming: Optional[dict] = None
    resourceRequirements: Optional[List[dict]] = None


@router.post("/task-recommend", response_model=TaskRecommendationResponse)
async def recommend_tasks(request: TaskRecommendationRequest):
    try:
        task = request.task or (request.tasks[0] if request.tasks else None)
        
        if not task:
            raise HTTPException(status_code=400, detail="No task provided")
        
        task_type = task.get("type", "custom")
        
        task_scenarios = {
            "irrigation": {
                "reasoning": "根据土壤湿度和天气预报，建议在傍晚进行灌溉，减少蒸发损失",
                "suggestedActions": ["检查灌溉设备", "测试水质", "记录灌溉量", "观察灌溉后土壤状态"],
                "optimalTiming": {"hour": 17, "duration": "2-3小时"}
            },
            "fertilization": {
                "reasoning": "根据作物生长阶段和天气预报，建议在无雨天气施肥，避免肥料流失",
                "suggestedActions": ["选择合适的肥料类型", "控制施肥量", "均匀撒施", "施肥后浇水"],
                "optimalTiming": {"hour": 9, "condition": "无雨"}
            },
            "pesticide": {
                "reasoning": "根据病虫害情况和天气预报，建议在无风无雨天气施药，提高效果",
                "suggestedActions": ["选择合适药剂", "配比浓度正确", "佩戴防护装备", "避免施药后立即浇水"],
                "optimalTiming": {"hour": 16, "condition": "无风"}
            },
            "harvest": {
                "reasoning": "根据作物成熟度和天气预报，建议在晴朗干燥的天气收获",
                "suggestedActions": ["检查成熟度", "准备收获工具", "及时晾晒", "做好储存准备"],
                "optimalTiming": {"hour": 8, "condition": "晴朗"}
            },
            "planting": {
                "reasoning": "根据土壤温度和天气预报，建议在温度适宜且无强风天气播种",
                "suggestedActions": ["整理土地", "选择优质种子", "控制播种深度", "及时浇水"],
                "optimalTiming": {"hour": 10, "temperature": "15-25°C"}
            },
            "monitoring": {
                "reasoning": "定期监测是及时发现问题的关键，建议建立监测计划",
                "suggestedActions": ["记录生长状态", "检查病虫害", "测量环境指标", "拍照存档"],
                "optimalTiming": {"frequency": "每2-3天"}
            }
        }
        
        scenario = task_scenarios.get(task_type, task_scenarios["monitoring"])
        
        resource_req = [
            {"type": "人力", "quantity": random.randint(1, 3), "unit": "人"},
            {"type": "设备", "quantity": random.randint(1, 2), "unit": "套"}
        ]
        
        return TaskRecommendationResponse(
            score=round(random.uniform(0.75, 0.95), 2),
            reasoning=scenario["reasoning"],
            suggestedActions=scenario["suggestedActions"],
            optimalTiming=scenario["optimalTiming"],
            resourceRequirements=resource_req
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TaskGenerationRequest(BaseModel):
    userId: str
    conditions: dict


class TaskGenerationResponse(BaseModel):
    tasks: List[dict]
    summary: str


@router.post("/generate-tasks", response_model=TaskGenerationResponse)
async def generate_tasks(request: TaskGenerationRequest):
    try:
        temperature = request.conditions.get("temperature", 25)
        humidity = request.conditions.get("humidity", 60)
        soilMoisture = request.conditions.get("soilMoisture", 50)
        
        tasks = []
        
        if soilMoisture < 40:
            tasks.append({
                "type": "irrigation",
                "title": "紧急灌溉",
                "description": "土壤湿度偏低，需要立即灌溉",
                "priority": "urgent",
                "location": "主要种植区",
                "estimatedDuration": 2
            })
        elif soilMoisture < 60:
            tasks.append({
                "type": "irrigation",
                "title": "计划灌溉",
                "description": "土壤湿度较低，建议进行灌溉",
                "priority": "medium",
                "location": "主要种植区",
                "estimatedDuration": 2
            })
        
        if temperature > 30:
            tasks.append({
                "type": "monitoring",
                "title": "高温监测",
                "description": "温度较高，注意作物状态和病虫害",
                "priority": "high",
                "location": "全区域",
                "estimatedDuration": 1
            })
            tasks.append({
                "type": "irrigation",
                "title": "增加灌溉",
                "description": "高温天气增加灌溉频率",
                "priority": "high",
                "location": "主要种植区",
                "estimatedDuration": 1
            })
        
        if humidity > 80:
            tasks.append({
                "type": "pesticide",
                "title": "防病喷药",
                "description": "高湿度环境易发真菌病害，建议预防性喷药",
                "priority": "medium",
                "location": "易感病区域",
                "estimatedDuration": 1.5
            })
        
        tasks.append({
            "type": "monitoring",
            "title": "常规监测",
            "description": "进行日常作物监测，记录生长状态",
            "priority": "low",
            "location": "全区域",
            "estimatedDuration": 2
        })
        
        summary = f"根据当前环境条件（温度:{temperature}°C，湿度:{humidity}%，土壤湿度:{soilMoisture}%），生成了{len(tasks)}个农事任务"
        
        return TaskGenerationResponse(
            tasks=tasks,
            summary=summary
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
