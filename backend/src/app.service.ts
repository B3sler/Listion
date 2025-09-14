import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getPing() {
    return { ok: true, app: process.env.APP_NAME || 'Listion' }
  }

  getHello() {
    return { message: 'Hello from Backend' }
  }
}

