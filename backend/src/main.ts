import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api')

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Listion API')
    .setDescription('OpenAPI-Dokumentation für das Listion Backend')
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
  Logger.log(`Backend läuft auf http://localhost:${port}`, 'Bootstrap')
  Logger.log(`Swagger UI:       http://localhost:${port}/api/docs`, 'Swagger')
}

bootstrap()
