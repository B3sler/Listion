import { AppService } from './app.service'

describe('AppService', () => {
  it('should return ping payload', () => {
    const service = new AppService()
    const res = service.getPing()
    expect(res).toEqual({ ok: true, app: 'Listion' })
  })

  it('should return hello message', () => {
    const service = new AppService()
    expect(service.getHello()).toEqual({ message: 'Hello from Backend' })
  })
})

