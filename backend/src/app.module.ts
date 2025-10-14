import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { User } from './user.entity'
import { UserService } from './user.service'
import { AuthController } from './auth.controller'
import { Bit } from './entities/bit.entity'
import { BitService } from './services/bit.service'
import { BitController } from './controllers/bit.controller'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }) as unknown as import('@nestjs/common').DynamicModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'listion',
      password: process.env.DB_PASS || 'listion1221',
      database: process.env.DB_NAME || 'listion',
      entities: [User, Bit],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User, Bit]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecret',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AppController, AuthController, BitController],
  providers: [AppService, UserService, BitService],
})
export class AppModule {}
