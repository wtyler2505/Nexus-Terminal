# Nexus Terminal

**Nexus Terminal** is a local-first, AI-powered collaborative development environment ("War Room") where multiple AI personas (Architect, Engineer, Critic) share a single mutable state context to build software or solve complex problems.

It is designed to solve the "context fragmentation" problem by forcing all agents to read from and write to a shared "Context Board" rather than relying solely on chat history.

## 🚀 Key Features

### 🧠 Gemini 3.0 Pro Core
The application is supervised by a central "Brain" (Nexus Core) running on `gemini-3-pro-preview`. It monitors the conversation and file changes to automatically synthesize and update the project's **Objective** and **Scratchpad**.

### 👥 Multi-Persona Swarm
- **Architect** (`gemini-3-pro-preview`): Uses "Thinking Mode" to plan high-level system design.
- **Engineer** (`gemini-2.5-flash`): Writes code and implements tasks.
- **Critic** (`gemini-2.5-flash`): Audits code for bugs and security risks.
- **User** (You): The Director who guides the swarm.

### ⚡ Smart Features
- **Live Context Board**: A mutable shared state (Objective, Scratchpad, Active File) that agents can read/write via tools.
- **Diff Detection**: Automatically detects significant code changes (using LCS algorithm) and triggers the Core to re-sync the state.
- **Voice Uplink**: Integrated Web Speech API for Push-to-Talk voice commands.
- **Priority Queueing**: Agents respond sequentially based on dynamic priority settings (High/Normal/Low).
- **System Audit Trail**: A chronological log of every system event, error, and agent action, filterable by role.

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS (Cyberpunk/Terminal Aesthetic)
- **AI**: Google GenAI SDK (`@google/genai`)
- **State**: React State + LocalStorage (No Backend)

## 📦 Setup

1. **Clone & Install**
   ```bash
   git clone [repo-url]
   cd nexus-terminal
   npm install
   ```

2. **Configure API Key**
   Create a `.env` file in the root:
   ```env
   API_KEY=your_google_genai_api_key_here
   ```

3. **Run**
   ```bash
   npm run dev
   ```

## 🎮 Usage Guide

1. **Set an Objective**: Type in the "Primary Directive" box (e.g., "Build a Snake Game in Python").
2. **Assign Tasks**: Talk to the **Architect** (`@Architect`) to create a plan in the Scratchpad.
3. **Execute**: The **Engineer** (`@Engineer`) will pick up the plan and write code to the "Active Artifact".
4. **Review**: The **Critic** (`@Critic`) will review the code.
5. **Sync**: If the agents get out of sync, hit the **"EXECUTE SYNC"** button to force the Core to realign the state.

## 🔒 Privacy & Persistence
- **Local-First**: All state, chat history, and settings are stored in your browser's `localStorage`.
- **API Privacy**: Data is sent to Google Gemini API for processing but is not stored on any intermediate server.
- **Reset**: You can wipe all local data via the Settings Menu ("Factory Reset").