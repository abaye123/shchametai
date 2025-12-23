# ShchametAI - Chess Application

## Project Overview

**ShchametAI** is a cross-platform chess application built with Angular 21 and Tauri, featuring a complete chess engine, AI-powered move suggestions via Google Gemini, and full internationalization support (Hebrew RTL/English LTR).

## Technical Architecture

### Frontend Stack
- **Framework**: Angular 21 (standalone components)
- **UI**: TailwindCSS for responsive design
- **State Management**: Angular Signals
- **Internationalization**: Custom i18n service with RTL/LTR support

### Desktop Integration
- **Platform**: Tauri 2.x (Rust backend)
- **Build Targets**: Windows, macOS, Linux

### Core Features

#### Chess Engine (`chess-engine.service.ts`)
- Complete move validation (legal moves, check, checkmate)
- Game state management (board position, move history, captured pieces)
- Special move support (castling, en passant, pawn promotion)
- Stalemate and checkmate detection

#### Computer Opponent (`computer-opponent.service.ts`)
- Three difficulty levels: Easy, Medium, Hard
- Position evaluation algorithm
- Move generation and selection logic

#### AI Integration (`app.component.ts`)
- Google Gemini 2.5 Flash API for strategic move recommendations
- Context-aware suggestions based on current board state
- Multilingual response support (Hebrew/English)

#### Audio System (`sound.service.ts`)
- Sound effects for moves, captures, and game events
- Hebrew audio narration for accessibility

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend Framework | Angular 21 |
| Desktop Runtime | Tauri 2.9.6 |
| Styling | TailwindCSS |
| AI Model | Google Gemini 2.5 Flash |
| Languages | TypeScript 5.9.3 |
| Build Tool | Vite 6.2.0 |
| Backend | Rust (via Tauri) |

## Installation & Setup

### Prerequisites
- Node.js (v18+)
- Rust (for Tauri builds)
- Gemini API Key (for AI features)

### Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure API Key**
   
   Create `.env.local` file:
   ```
   API_KEY=your_gemini_api_key_here
   ```

3. **Run web development server**
   ```bash
   npm run dev
   ```

4. **Run Tauri desktop application**
   ```bash
   npm run tauri:dev
   ```

### Build for Production

**Web Build**
```bash
npm run build
```

**Desktop Build**
```bash
npm run tauri:build
```

## Project Structure

```
shchametai/
├── src/
│   ├── app.component.ts          # Main application component
│   ├── components/
│   │   └── board.component.ts    # Chess board rendering
│   ├── services/
│   │   ├── chess-engine.service.ts       # Chess logic
│   │   ├── computer-opponent.service.ts  # AI opponent
│   │   ├── i18n.service.ts              # Internationalization
│   │   └── sound.service.ts             # Audio system
│   └── assets/                   # Audio files
├── src-tauri/                    # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs              # Tauri entry point
│   │   └── lib.rs               # Library code
│   └── tauri.conf.json          # Tauri configuration
├── package.json                  # Node dependencies
└── angular.json                  # Angular configuration
```

## Game Modes

### Human vs Human
Two players alternate turns on the same device.

### Human vs Computer
Play against the AI with configurable difficulty:
- **Easy**: Random valid moves
- **Medium**: Basic position evaluation
- **Hard**: Advanced position evaluation with material and positional factors

## Features

✅ Complete chess rules implementation  
✅ Move validation and illegal move prevention  
✅ Check, checkmate, and stalemate detection  
✅ Computer opponent with three difficulty levels  
✅ AI-powered move suggestions via Gemini  
✅ Hebrew and English language support  
✅ RTL/LTR text direction handling  
✅ Sound effects and audio narration  
✅ Captured pieces display  
✅ Move history tracking  
✅ Responsive cross-platform UI  
✅ Offline functionality (except AI hints)  

## Internationalization

The application supports:
- **Hebrew (עברית)**: RTL layout with Hebrew piece names and audio
- **English**: LTR layout with standard notation

Switch languages via the settings panel.

## License

Private project - All rights reserved.

## Links

- GitHub Repository: https://github.com/abaye123/shchametai
