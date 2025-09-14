import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api')

  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  await app.listen(port)
  Logger.log(`Backend läuft auf http://localhost:${port}`, 'Bootstrap')
}

bootstrap()
