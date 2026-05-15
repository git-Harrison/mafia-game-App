// dev-bots.e2e — devSpawnBots WS 이벤트의 가드(production/disabled), 호스트 권한,
// 정상 스폰 + roomUpdated broadcast 를 한 사이클로 검증.
//
// 환경변수 가드는 process.env 를 직접 토글해도 안전 — service 의 isEnabled() 가 매 호출
// 평가하므로 같은 서버 인스턴스에서 on/off 시나리오 다 커버 가능.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('DevBots e2e — devSpawnBots WS 이벤트', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  const ORIGINAL_ENV = { ...process.env };

  beforeAll(async () => {
    // 본 e2e 는 dev mode 가정. AppModule 부팅 후 env 토글이 service.isEnabled() 에 반영됨.
    process.env.ENABLE_DEV_BOTS = 'true';
    delete process.env.NODE_ENV; // production 아님

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '0.0.0.0');
    const addr = app.getHttpServer().address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    baseUrl = `http://localhost:${port}`;
    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    process.env = { ...ORIGINAL_ENV };
    await app.close();
  });

  async function newGuest(
    nickname: string,
  ): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/guest')
      .send({ nickname })
      .expect(200);
    return { token: res.body.accessToken, userId: res.body.user.id };
  }

  function openSocket(token: string): Socket {
    return io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
  }
  function connectAndWait(s: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect timeout')), 5000);
      s.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      s.once('connect_error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    });
  }
  function emitAck<T = unknown>(
    socket: Socket,
    event: string,
    payload?: unknown,
  ): Promise<{ ok: boolean; data?: T; error?: string }> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`ack timeout ${event}`)), 5000);
      socket.emit(event, payload ?? {}, (response: unknown) => {
        clearTimeout(t);
        resolve(response as any);
      });
    });
  }
  function waitForMatching<T>(
    socket: Socket,
    event: string,
    predicate: (d: T) => boolean,
    timeoutMs = 5000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (d: T) => {
        if (predicate(d)) {
          socket.off(event, handler);
          clearTimeout(timer);
          resolve(d);
        }
      };
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`event ${event} predicate timeout`));
      }, timeoutMs);
      socket.on(event, handler);
    });
  }

  it('정상: 호스트가 devSpawnBots count=3 → roomUpdated 멤버 4명, 봇 모두 ready, isBot row INSERT', async () => {
    process.env.ENABLE_DEV_BOTS = 'true';

    const host = await newGuest('hostdev1');
    const sa = openSocket(host.token);
    await connectAndWait(sa);

    const created = await emitAck<{ roomId: string; code: string }>(
      sa,
      'createRoom',
      { maxPlayers: 8 },
    );
    expect(created.ok).toBe(true);

    // roomUpdated 가 host + 3 봇 = 4 명으로 갱신되는 것을 기다림.
    const roomUpdated = waitForMatching<{
      members: { userId: string; ready: boolean }[];
    }>(sa, 'roomUpdated', (r) => r.members.length === 4);

    const spawn = await emitAck<{
      spawned: Array<{ userId: string; nickname: string }>;
    }>(sa, 'devSpawnBots', { count: 3 });
    expect(spawn.ok).toBe(true);
    expect(spawn.data?.spawned).toHaveLength(3);

    const room = await roomUpdated;
    expect(room.members).toHaveLength(4);
    // host 외 멤버는 모두 ready=true.
    const bots = room.members.filter((m) => m.userId !== host.userId);
    expect(bots).toHaveLength(3);
    expect(bots.every((m) => m.ready)).toBe(true);

    // Prisma 에 isBot=true row 가 실제 INSERT 되었는지 확인.
    for (const b of spawn.data!.spawned) {
      const row = await prisma.user.findUnique({ where: { id: b.userId } });
      expect(row?.isBot).toBe(true);
      expect(row?.guestNickname).toMatch(/^Bot-/);
    }

    sa.disconnect();
  }, 30_000);

  it('가드: NODE_ENV=production 일 때 devSpawnBots → DEV_BOTS_DISABLED', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEV_BOTS = 'true';

    const host = await newGuest('hostdev2');
    const sa = openSocket(host.token);
    await connectAndWait(sa);

    await emitAck(sa, 'createRoom', { maxPlayers: 4 });
    const r = await emitAck(sa, 'devSpawnBots', { count: 3 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('DEV_BOTS_DISABLED');

    sa.disconnect();
    // 원복
    delete process.env.NODE_ENV;
  }, 30_000);

  it('가드: ENABLE_DEV_BOTS=false → DEV_BOTS_DISABLED', async () => {
    process.env.ENABLE_DEV_BOTS = 'false';
    delete process.env.NODE_ENV;

    const host = await newGuest('hostdev3');
    const sa = openSocket(host.token);
    await connectAndWait(sa);

    await emitAck(sa, 'createRoom', { maxPlayers: 4 });
    const r = await emitAck(sa, 'devSpawnBots', { count: 3 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('DEV_BOTS_DISABLED');

    sa.disconnect();
    process.env.ENABLE_DEV_BOTS = 'true';
  }, 30_000);

  it('권한: 비호스트가 devSpawnBots → NOT_HOST', async () => {
    process.env.ENABLE_DEV_BOTS = 'true';
    delete process.env.NODE_ENV;

    const host = await newGuest('hostdev4');
    const guest = await newGuest('guestdev4');
    const sa = openSocket(host.token);
    const sb = openSocket(guest.token);
    await Promise.all([connectAndWait(sa), connectAndWait(sb)]);

    const created = await emitAck<{ code: string }>(sa, 'createRoom', {
      maxPlayers: 4,
    });
    await emitAck(sb, 'joinRoom', { code: created.data!.code });

    const r = await emitAck(sb, 'devSpawnBots', { count: 1 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('NOT_HOST');

    sa.disconnect();
    sb.disconnect();
  }, 30_000);

  it('인원 초과: count 가 자리보다 많으면 FULL', async () => {
    process.env.ENABLE_DEV_BOTS = 'true';
    delete process.env.NODE_ENV;

    const host = await newGuest('hostdev5');
    const sa = openSocket(host.token);
    await connectAndWait(sa);
    // maxPlayers=4, 호스트 1명 이미 들어있음 → count=4 는 5 명이라 거부.
    await emitAck(sa, 'createRoom', { maxPlayers: 4 });

    const r = await emitAck(sa, 'devSpawnBots', { count: 4 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('FULL');

    sa.disconnect();
  }, 30_000);

  it('default count=3: payload 미지정 → 3명 스폰', async () => {
    process.env.ENABLE_DEV_BOTS = 'true';
    delete process.env.NODE_ENV;

    const host = await newGuest('hostdev6');
    const sa = openSocket(host.token);
    await connectAndWait(sa);
    await emitAck(sa, 'createRoom', { maxPlayers: 8 });

    const r = await emitAck<{ spawned: unknown[] }>(sa, 'devSpawnBots', {});
    expect(r.ok).toBe(true);
    expect(r.data?.spawned).toHaveLength(3);

    sa.disconnect();
  }, 30_000);
});
