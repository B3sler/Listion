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
import { Packet } from './modules/packet/packet.entity.js'
import { PacketService } from './modules/packet/packet.service.js'
import { PacketController } from './modules/packet/packet.controller.js'
import { Dependency } from './modules/dependency/dependency.entity.js'

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
      entities: [User, Bit, Packet, Dependency],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([User, Bit, Packet, Dependency]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AppController, AuthController, BitController, PacketController],
  providers: [
    AppService,
    UserService,
    BitService,
    PacketService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
