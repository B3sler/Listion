import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { User } from './user.entity'
import { UserService } from './user.service'
import { AuthController } from './auth.controller'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }) as unknown as import('@nestjs/common').DynamicModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'listion',
      entities: [User],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecret',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AppController, AuthController],
  providers: [AppService, UserService],
})
export class AppModule {}
