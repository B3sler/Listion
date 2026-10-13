import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { User } from './modules/user/user.entity.js'
import { UserService } from './modules/user/user.service.js'
import { AuthController } from './modules/user/auth.controller.js'
import { Bit } from './modules/bit/bit.entity.js'
import { BitService } from './modules/bit/bit.service.js'
import { BitController } from './modules/bit/bit.controller.js'
import { BitConnection } from './modules/connection/connection.entity.js'
import { ConnectionService } from './modules/connection/connection.service.js'
import { ConnectionController } from './modules/connection/connection.controller.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }) as unknown as import('@nestjs/common').DynamicModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'listion',
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || 'listion',
      entities: [User, Bit, BitConnection],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([User, Bit, BitConnection]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AppController, AuthController, BitController, ConnectionController],
  providers: [AppService, UserService, BitService, ConnectionService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
