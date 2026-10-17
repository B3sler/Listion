import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Logger, ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module.js'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set (see backend/.env.example)')
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // In production the backend is only reachable through nginx, which forwards the
  // client's address. Without this every request carries nginx's IP and all users
  // share one rate-limit bucket.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }

  app.use(helmet())
  app.use(cookieParser())
  app.use(express.json())
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
  app.setGlobalPrefix('api')
  // whitelist entfernt unbekannte Felder (z.B. id/user) aus Request-Bodies
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Listion API')
    .setDescription('OpenAPI documentation for the Listion Backend')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config, { deepScanRoutes: true })
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    useGlobalPrefix: true,
  })

  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  await app.listen(port)
  Logger.log(`Backend running on http://localhost:${port}`, 'Bootstrap')
  Logger.log(`Swagger UI:       http://localhost:${port}/api/docs`, 'Swagger')
}

bootstrap()
