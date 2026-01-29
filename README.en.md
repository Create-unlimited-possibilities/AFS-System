# AFS System (Artificial Flashlight Simulation)

[中文文档](README.md) | [English Version](README.en.md)

## Project Overview

Artificial Flashlight Simulation System (AFS) is a digital memory heritage system designed for seniors. It creates personalized digital archives to help elderly users record their life stories and utilizes AI technology to train personalized conversational models. This allows the AI to communicate with warmth and familiarity,陪伴ing seniors as they revisit precious memories.

## Core Features

### 1. Digital Memory Archive
- Unique 16-digit专属 ID for each senior
- Record fundamental information and emotional memories
- Structured storage for future review and传承

### 2. AI Training and Conversation
- Personalized AI models trained on memory data (Ollama + LoRA)
-专属 AI communicates warmly and亲切ly with seniors
- Continuously learning to better understand stories and emotions

### 3. Collaborative Filling Mechanism
- Family and friends can assist seniors via ID and email verification
- Multi-user collaboration to完善 memory archives
- Age-friendly design to reduce usage barriers

### 4. Security and Privacy Protection
- Strict identity verification and权限 management
- Encrypted data storage for privacy保障
- Compliant with personal information protection regulations

### 5. Multi-Device Support
- Responsive web design for PC and mobile devices
- Intuitive user interface for easy操作
- Future extensibility to mini-programs, APPs, etc.

## Technical Architecture

The system adopts a modern front-end and back-end分离 architecture with the following main technology stack:

- **Frontend**: HTML5 + Bootstrap 5 + Vanilla JS
- **Backend**: Node.js + Express.js
- **AI Service**: Ollama + Python + LoRA fine-tuning
- **Database**: MongoDB
- **Deployment**: Docker + Docker Compose

The system consists of multiple service modules:
- `client`: User frontend interface
- `server`: Backend API service
- `modelserver`: AI model training and inference service
- `mongoserver`: MongoDB database service

## Quick Start

### Environment Requirements

- Docker and Docker Compose
- Recommended configuration: Linux/macOS/Windows (WSL2) + NVIDIA GPU (for AI training acceleration)

### Local Deployment

1. Clone the project and navigate to the directory
   ```bash
   git clone <your-repo-url>
   cd afs-system
   ```

2. Configure environment variables
   ```bash
   cp .env.example .env
   # Edit .env file to configure MongoDB and JWT keys
   ```

3. Start all services
   ```bash
   docker-compose up -d
   ```

4. Access the application
   - Frontend: http://localhost:8080
   - API Documentation: http://localhost:3001/api-docs
   - Ollama API: http://localhost:11435

### Usage Flow

1. **Account Registration**: Register with email, system auto-generates专属 ID
2. **Fill Archive**: Log in and answer basic and emotional questions to create memory archive
3. **Collaborative Filling**: Share ID with family/friends to invite assistance
4. **Model Training**: System trains personalized AI model based on archive data
5. **Warm Conversation**: Engage in温馨 interactions with专属 AI to revisit memories

## Development Guide

### Project Structure

```
afs-system/
├── client/          # Frontend web interface
├── server/          # Backend API service
├── modelserver/     # AI model training and inference service
├── mongoserver/     # MongoDB configuration and initialization
├── docker-compose.yml  # Container orchestration configuration
└── README.md        # Project documentation
```

### Local Development

1. Install dependencies
   ```bash
   # Backend API service
   cd server && npm install
   
   # AI model service
   cd modelserver && pip install -r requirements.txt
   ```

2. Start services
   ```bash
   # Start MongoDB (Docker recommended for development)
   docker-compose up -d mongoserver
   
   # Start backend API
   cd server && npm run dev
   
   # Start frontend (live preview)
   cd client && npx live-server --port=8080
   ```

3. AI model local development
   ```bash
   # Start Ollama (requires GPU support)
   ollama serve
   
   # See modelserver/README.md for training and inference details
   ```

## Contribution Guidelines

Issues and Pull Requests are welcome!

## License

This project is licensed under the MIT License.

## Contact

- Project Maintainer: AFS Team
- Version: 1.0.0