import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Rooms M2-a — guest auth + room lifecycle', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0, '0.0.0.0');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseUrl = `http://localhost:${port}`;
    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ─── helpers ──────────────────────────────────────────
  async function newGuest(
    nickname: string,
  ): Promise<{ token: string; userId: string; nickname: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/guest')
      .send({ nickname })
      .expect(200);
    return {
      token: res.body.accessToken,
      userId: res.body.user.id,
      nickname: res.body.user.guestNickname,
    };
  }

  function openSocket(token: string): Socket {
    return io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
  }

  function connectAndWait(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('connect timeout')),
        5000,
      );
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function emitAck<T = unknown>(
    socket: Socket,
    event: string,
    payload?: unknown,
  ): Promise<{ ok: boolean; data?: T; error?: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`ack timeout for ${event}`)),
        5000,
      );
      socket.emit(event, payload ?? {}, (response: unknown) => {
        clearTimeout(timer);
        resolve(response as { ok: boolean; data?: T; error?: string });
      });
    });
  }

  function waitForMatching<T>(
    socket: Socket,
    event: string,
    predicate: (data: T) => boolean,
    timeoutMs = 5000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (data: T) => {
        if (predicate(data)) {
          socket.off(event, handler);
          clearTimeout(timer);
          resolve(data);
        }
      };
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`event ${event} matching predicate timeout`));
      }, timeoutMs);
      socket.on(event, handler);
    });
  }

  function disconnectAll(...sockets: Socket[]) {
    for (const s of sockets) s.disconnect();
  }

  // ─── POSITIVE FLOW ────────────────────────────────────
  it('positive: 4 guests — create → join → ready → startGame → READY_CHECK', async () => {
    const A = await newGuest('alice');
    const B = await newGuest('bob');
    const C = await newGuest('carol');
    const D = await newGuest('dave');

    const sa = openSocket(A.token);
    const sb = openSocket(B.token);
    const sc = openSocket(C.token);
    const sd = openSocket(D.token);

    await Promise.all([
      connectAndWait(sa),
      connectAndWait(sb),
      connectAndWait(sc),
      connectAndWait(sd),
    ]);

    const created = await emitAck<{ roomId: string; code: string }>(
      sa,
      'createRoom',
      { maxPlayers: 4 },
    );
    expect(created.ok).toBe(true);
    expect(created.data?.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    const code = created.data!.code;

    expect((await emitAck(sb, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sc, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sd, 'joinRoom', { code })).ok).toBe(true);

    expect((await emitAck(sb, 'playerReady', { ready: true })).ok).toBe(true);
    expect((await emitAck(sc, 'playerReady', { ready: true })).ok).toBe(true);
    expect((await emitAck(sd, 'playerReady', { ready: true })).ok).toBe(true);

    // startGame → status READY_CHECK
    const startGameRoomUpdate = waitForMatching<{
      status: string;
      members: { userId: string; ready: boolean }[];
    }>(sa, 'roomUpdated', (r) => r.status === 'READY_CHECK');

    const startRes = await emitAck(sa, 'startGame');
    expect(startRes.ok).toBe(true);

    const roomState = await startGameRoomUpdate;
    expect(roomState.status).toBe('READY_CHECK');
    // host + 3 ready members
    expect(roomState.members).toHaveLength(4);
    const hostMember = roomState.members.find(
      (m) => m.userId === A.userId,
    );
    const nonHosts = roomState.members.filter((m) => m.userId !== A.userId);
    expect(hostMember?.ready).toBe(true);
    expect(nonHosts.every((m) => m.ready)).toBe(true);

    disconnectAll(sa, sb, sc, sd);
  }, 30_000);

  // ─── NEGATIVE: 5th player on full room ────────────────
  it('negative: 5번째(E) joinRoom → maxPlayers=4 면 FULL 거부', async () => {
    const A = await newGuest('alice2');
    const B = await newGuest('bob2');
    const C = await newGuest('carol2');
    const D = await newGuest('dave2');
    const E = await newGuest('eve2');

    const sa = openSocket(A.token);
    const sb = openSocket(B.token);
    const sc = openSocket(C.token);
    const sd = openSocket(D.token);
    const se = openSocket(E.token);

    await Promise.all([
      connectAndWait(sa),
      connectAndWait(sb),
      connectAndWait(sc),
      connectAndWait(sd),
      connectAndWait(se),
    ]);

    const created = await emitAck<{ code: string }>(sa, 'createRoom', {
      maxPlayers: 4,
    });
    const code = created.data!.code;
    expect((await emitAck(sb, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sc, 'joinRoom', { code })).ok).toBe(true);
    expect((await emitAck(sd, 'joinRoom', { code })).ok).toBe(true);

    const eRes = await emitAck(se, 'joinRoom', { code });
    expect(eRes.ok).toBe(false);
    expect(eRes.error).toBe('FULL');

    disconnectAll(sa, sb, sc, sd, se);
  }, 30_000);

  // ─── NEGATIVE: host playerReady ──────────────────────
  it('negative: 호스트가 playerReady → HOST_CANT_READY', async () => {
    const A = await newGuest('alice3');
    const B = await newGuest('bob3');
    const sa = openSocket(A.token);
    const sb = openSocket(B.token);
    await Promise.all([connectAndWait(sa), connectAndWait(sb)]);

    const created = await emitAck<{ code: string }>(sa, 'createRoom', {
      maxPlayers: 4,
    });
    await emitAck(sb, 'joinRoom', { code: created.data!.code });

    const res = await emitAck(sa, 'playerReady', { ready: true });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('HOST_CANT_READY');

    disconnectAll(sa, sb);
  }, 30_000);

  // ─── NEGATIVE: B not ready, host startGame ───────────
  it('negative: 비호스트 한 명 ready=false 인 상태 startGame → NOT_ALL_READY', async () => {
    const A = await newGuest('alice4');
    const B = await newGuest('bob4');
    const C = await newGuest('carol4');
    const D = await newGuest('dave4');

    const sa = openSocket(A.token);
    const sb = openSocket(B.token);
    const sc = openSocket(C.token);
    const sd = openSocket(D.token);
    await Promise.all([
      connectAndWait(sa),
      connectAndWait(sb),
      connectAndWait(sc),
      connectAndWait(sd),
    ]);

    const created = await emitAck<{ code: string }>(sa, 'createRoom', {
      maxPlayers: 4,
    });
    const code = created.data!.code;
    await emitAck(sb, 'joinRoom', { code });
    await emitAck(sc, 'joinRoom', { code });
    await emitAck(sd, 'joinRoom', { code });

    // joinRoom 정책상 비호스트는 자동 ready=true 로 등록됨.
    // B 만 명시적으로 ready=false 로 되돌려 NOT_ALL_READY 시나리오 재현.
    await emitAck(sb, 'playerReady', { ready: false });

    const res = await emitAck(sa, 'startGame');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NOT_ALL_READY');

    disconnectAll(sa, sb, sc, sd);
  }, 30_000);

  // ─── NEGATIVE: only 3 players, host startGame ────────
  it('negative: players.length=3 에서 startGame → TOO_FEW_PLAYERS', async () => {
    const A = await newGuest('alice5');
    const B = await newGuest('bob5');
    const C = await newGuest('carol5');

    const sa = openSocket(A.token);
    const sb = openSocket(B.token);
    const sc = openSocket(C.token);
    await Promise.all([
      connectAndWait(sa),
      connectAndWait(sb),
      connectAndWait(sc),
    ]);

    const created = await emitAck<{ code: string }>(sa, 'createRoom', {
      maxPlayers: 8,
    });
    await emitAck(sb, 'joinRoom', { code: created.data!.code });
    await emitAck(sc, 'joinRoom', { code: created.data!.code });
    await emitAck(sb, 'playerReady', { ready: true });
    await emitAck(sc, 'playerReady', { ready: true });

    const res = await emitAck(sa, 'startGame');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('TOO_FEW_PLAYERS');

    disconnectAll(sa, sb, sc);
  }, 30_000);

  // ─── connection auth ────────────────────────────────
  it('negative: 토큰 없이 WS 연결 → 즉시 disconnect', async () => {
    const s = io(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000);
      s.once('disconnect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    expect(s.connected).toBe(false);
    s.disconnect();
  }, 10_000);

  // ─── nickname validation (HTTP) ─────────────────────
  it('negative: nickname 1자 → HTTP 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/guest')
      .send({ nickname: 'a' })
      .expect(400);
  });

  it('negative: nickname 13자 → HTTP 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/guest')
      .send({ nickname: 'aaaaaaaaaaaaa' })
      .expect(400);
  });

  it('negative: nickname 특수문자 → HTTP 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/guest')
      .send({ nickname: 'bad@user' })
      .expect(400);
  });

  it('positive: nickname 한글 → 200 + JWT + User row', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/guest')
      .send({ nickname: '마피아킬러' })
      .expect(200);
    expect(res.body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(res.body.user.guestNickname).toBe('마피아킬러');
    const row = await prisma.user.findUnique({ where: { id: res.body.user.id } });
    expect(row?.guestNickname).toBe('마피아킬러');
  });
});
