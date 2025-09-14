# Listion Backend (NestJS)

Entwicklungs-Setup:
- TypeScript, ESLint (Flat), Prettier, Jest (ts-jest)
- Dev-Server: ts-node-dev
- Endpoints:
  - GET /api/ping -> { ok: true, app: APP_NAME }
  - GET /api/hello -> { message: 'Hello from Backend' }

Skripte:
- npm run dev — Start im Watch-Modus (http://localhost:3000)
- npm run build — Transpiliert nach dist/
- npm test — Jest-Tests
- npm run lint, npm run type-check

Umgebungsvariablen:
- APP_NAME (Default: Listion)
- PORT (Default: 3000)

Beispiel:
cp .env.example .env
npm install
npm run dev
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

