# Nexus Terminal

**Nexus Terminal** is a local-first, AI-powered collaborative environment where multiple AI personas (Architect, Engineer, Critic) share a single state context to solve complex problems. It acts as a "War Room" for LLMs.

## Core Philosophy
Unlike standard chat interfaces where context is linear, Nexus Terminal revolves around a **Shared Context Board**. Agents don't just talk to you; they "see" the active file, the current objective, and a shared scratchpad.

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS (Cyberpunk/Terminal Aesthetic)
- **AI Provider**: Google GenAI SDK (`@google/genai`)
- **State**: Local State + LocalStorage Persistence (No external database)

## Features
- **Gemini 3.0 Pro Core**: The application is supervised by a "Brain" that monitors chat and file changes to auto-update objectives.
- **Multi-Persona Agents**: Distinct roles (Architect, Engineer, Critic) with specialized prompt instructions.
- **Live Context Board**: A shared mutable state that all agents reference before generating responses.
- **Voice Uplink**: Web Speech API integration for push-to-talk commands.
- **Diff Detection**: Smart monitoring of the active file to trigger AI synthesis automatically.
- **Resilience**: Robust error handling for API limits and network issues.

## Setup
1. Clone the repository.
2. Create a `.env` file with `API_KEY=your_gemini_api_key`.
3. Run the development server.
