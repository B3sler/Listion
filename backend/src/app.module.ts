import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'

@Module({
  imports: [
    (ConfigModule.forRoot({ isGlobal: true }) as unknown as import('@nestjs/common').DynamicModule),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
